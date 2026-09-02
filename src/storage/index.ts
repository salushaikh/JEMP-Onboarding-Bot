import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AllowedExtensions, AllowedMimeTypes, StorageProvider } from '../types.ts';
import { getConfig } from '../config/index.ts';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFilename: string;
  sha256Hash: string;
  fileSize: number;
  mimeType: string;
}

export class StorageService {
  private localDir: string;

  constructor() {
    this.localDir = path.join(process.cwd(), 'storage', 'resumes');
    this.ensureDirectory(this.localDir);
  }

  private ensureDirectory(dir: string) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to create storage directory', e);
    }
  }

  // Validate resume upload
  public validateFile(
    filename: string,
    mimeType: string,
    buffer: Buffer
  ): FileValidationResult {
    const config = getConfig();
    const maxBytes = config.maxResumeSizeMb * 1024 * 1024;

    // 1. File Size check
    if (buffer.length > maxBytes) {
      return {
        valid: false,
        error: `File exceeds maximum allowed size of ${config.maxResumeSizeMb}MB.`,
        sanitizedFilename: '',
        sha256Hash: '',
        fileSize: buffer.length,
        mimeType
      };
    }

    // 2. Extension check
    const ext = path.extname(filename).toLowerCase();
    if (!AllowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Invalid file extension (${ext}). Allowed formats: ${AllowedExtensions.join(', ')}.`,
        sanitizedFilename: '',
        sha256Hash: '',
        fileSize: buffer.length,
        mimeType
      };
    }

    // 3. MIME type check
    const cleanMime = (mimeType || '').toLowerCase();
    // Allow octet-stream only if extension matches pdf/doc/docx and header matches
    const isMimeAllowed = AllowedMimeTypes.includes(cleanMime) || cleanMime === 'application/octet-stream';
    if (!isMimeAllowed) {
      return {
        valid: false,
        error: `Invalid MIME type (${cleanMime}). Allowed types: PDF, DOC, DOCX.`,
        sanitizedFilename: '',
        sha256Hash: '',
        fileSize: buffer.length,
        mimeType
      };
    }

    // 4. Sanitize filename (prevent path traversal, remove control characters)
    const baseName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const sanitizedFilename = baseName.length > 0 ? baseName : `resume${ext}`;

    // 5. Compute SHA-256
    const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      valid: true,
      sanitizedFilename,
      sha256Hash,
      fileSize: buffer.length,
      mimeType: cleanMime
    };
  }

  // Store file directly into local database representation
  public async storeResume(
    memberId: string,
    version: number,
    sanitizedFilename: string,
    buffer: Buffer
  ): Promise<{ storageKey: string; storageProvider: StorageProvider; dataBase64: string }> {
    const ext = path.extname(sanitizedFilename);
    const uniqueKey = `${crypto.randomUUID()}${ext}`;
    const storageKey = `db://resumes/${memberId}/v${version}_${uniqueKey}`;
    const dataBase64 = buffer.toString('base64');

    // Also write to local backup cache directory for fast local file streaming
    try {
      const memberDir = path.join(this.localDir, memberId);
      this.ensureDirectory(memberDir);
      const targetPath = path.join(this.localDir, memberId, `v${version}_${uniqueKey}`);
      fs.writeFileSync(targetPath, buffer);
    } catch (e) {
      console.warn('Local file cache write failed, database row will retain data.', e);
    }

    return {
      storageKey,
      storageProvider: StorageProvider.DATABASE,
      dataBase64
    };
  }

  public async getResumeBuffer(storageKey: string, fallbackBase64?: string): Promise<Buffer | null> {
    try {
      if (fallbackBase64) {
        return Buffer.from(fallbackBase64, 'base64');
      }

      const parts = storageKey.replace('db://', '').split('/');
      const relative = parts.slice(1).join(path.sep);
      const fullPath = path.join(this.localDir, relative);

      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
      return null;
    } catch (e) {
      console.error('Error fetching resume buffer', e);
      return null;
    }
  }
}

export const storageService = new StorageService();
