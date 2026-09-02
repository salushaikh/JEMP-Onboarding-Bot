import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { dbManager } from './src/database/index.ts';
import { storageService } from './src/storage/index.ts';
import { botService } from './src/bot/client.ts';
import {
  verifyApplicationEmail,
  addApprovedApplication,
  revokeApprovedApplication,
  restoreApprovedApplication,
  getMembership,
  addResume,
  removeResume,
  completeOnboardingStep,
  activateMembership,
  suspendMembership,
  restoreMembership,
  terminateMembership,
  getResumeHistory
} from './src/services/sharedServices.ts';
import { runReconciliationScan, executeSafeRepair } from './src/services/reconciliationService.ts';
import { runAllTests } from './src/tests/automatedTests.ts';
import { OnboardingStep } from './src/types.ts';

const PORT = 3000;

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Initialize demo data if fresh instance
  const existingApps = await dbManager.listApplications();
  if (existingApps.length === 0) {
    await dbManager.seedDemoData();
  }

  // --- API ROUTES ---

  // Health check & Bot status
  app.get('/api/health', (req, res) => {
    const dbStatus = dbManager.getStatus();
    const botStatus = botService.getStatus();
    res.json({
      status: 'ok',
      service: 'Jobless Empire — Onboarding & Membership Service',
      version: '1.0.0',
      database: dbStatus,
      bot: botStatus
    });
  });

  // Dashboard Metrics
  app.get('/api/dashboard', async (req, res) => {
    try {
      const apps = await dbManager.listApplications();
      const members = await dbManager.listMembers();
      const timeline = await dbManager.listTimelineEvents();
      const outbox = await dbManager.listOutboxEvents();
      const audit = await dbManager.listAuditLogs(20);
      const dbStatus = dbManager.getStatus();

      res.json({
        stats: {
          totalApplications: apps.length,
          approvedApplications: apps.filter(a => a.status === 'APPROVED').length,
          pendingApplications: apps.filter(a => a.status === 'PENDING').length,
          revokedApplications: apps.filter(a => a.status === 'REVOKED').length,
          totalMembers: members.length,
          activeMembers: members.filter(m => m.membershipStatus === 'ACTIVE').length,
          suspendedMembers: members.filter(m => m.membershipStatus === 'SUSPENDED').length,
          terminatedMembers: members.filter(m => m.membershipStatus === 'TERMINATED').length,
          currentJempSequence: dbStatus.currentJempSequence,
          resumesCount: dbStatus.resumesCount,
          timelineCount: timeline.length,
          outboxCount: outbox.length
        },
        applications: apps.slice(0, 10),
        recentMembers: members.slice(0, 10),
        recentTimeline: timeline.slice(0, 10),
        recentAudit: audit.slice(0, 10)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Applications endpoints
  app.get('/api/applications', async (req, res) => {
    try {
      const apps = await dbManager.listApplications();
      res.json(apps);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/applications', async (req, res) => {
    try {
      const { applicationId, applicantName, email, notes, expiration, adminActor } = req.body;
      const result = await addApprovedApplication(adminActor || 'admin_web', {
        applicationId,
        applicantName,
        email,
        notes,
        expiration
      });
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/applications/:id/revoke', async (req, res) => {
    try {
      const { reason, adminActor } = req.body;
      const result = await revokeApprovedApplication(adminActor || 'admin_web', req.params.id, reason || 'Administrative action');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/applications/:id/restore', async (req, res) => {
    try {
      const { adminActor } = req.body;
      const result = await restoreApprovedApplication(adminActor || 'admin_web', req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Members endpoints
  app.get('/api/members', async (req, res) => {
    try {
      const members = await dbManager.listMembers();
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/members/:identifier', async (req, res) => {
    try {
      const { member, resume, application } = await getMembership(req.params.identifier);
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      const history = await getResumeHistory(member.id);
      res.json({ member, resume, application, resumeHistory: history });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/members/:identifier/suspend', async (req, res) => {
    try {
      const { reason, adminActor } = req.body;
      const result = await suspendMembership(adminActor || 'admin_web', req.params.identifier, reason || 'Suspension');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/members/:identifier/restore', async (req, res) => {
    try {
      const { adminActor } = req.body;
      const result = await restoreMembership(adminActor || 'admin_web', req.params.identifier);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/members/:identifier/terminate', async (req, res) => {
    try {
      const { reason, adminActor } = req.body;
      const result = await terminateMembership(adminActor || 'admin_web', req.params.identifier, reason || 'Termination');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Onboarding Session & Workflow
  app.get('/api/onboarding/session/:discordUserId', async (req, res) => {
    try {
      const session = await dbManager.getOnboardingSession(req.params.discordUserId);
      const member = await dbManager.findMemberByDiscordId(req.params.discordUserId);
      const resume = member ? await dbManager.getCurrentResumeForMember(member.id) : null;
      res.json({ session, member, resume });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/onboarding/verify-email', async (req, res) => {
    try {
      const { discordUserId, email } = req.body;
      const result = await verifyApplicationEmail(discordUserId, email);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/onboarding/upload-resume', async (req, res) => {
    try {
      const { discordUserId, filename, mimeType, base64Data } = req.body;
      if (!base64Data) {
        return res.status(400).json({ success: false, error: 'No file content provided' });
      }
      const buffer = Buffer.from(base64Data, 'base64');
      const result = await addResume(discordUserId, filename, mimeType, buffer);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/onboarding/remove-resume', async (req, res) => {
    try {
      const { discordUserId } = req.body;
      const result = await removeResume(discordUserId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/onboarding/complete-step', async (req, res) => {
    try {
      const { discordUserId, step, data } = req.body;
      const result = await completeOnboardingStep(discordUserId, step as OnboardingStep, data);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/onboarding/activate', async (req, res) => {
    try {
      const { discordUserId } = req.body;
      const result = await activateMembership(discordUserId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reconciliation scan & repair
  app.get('/api/reconciliation', async (req, res) => {
    try {
      const report = await runReconciliationScan();
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/reconciliation/repair', async (req, res) => {
    try {
      const { anomalyId, adminActor } = req.body;
      const result = await executeSafeRepair(adminActor || 'admin_web', anomalyId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Timeline & Outbox
  app.get('/api/timeline', async (req, res) => {
    try {
      const events = await dbManager.listTimelineEvents();
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/outbox', async (req, res) => {
    try {
      const events = await dbManager.listOutboxEvents();
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/audit', async (req, res) => {
    try {
      const logs = await dbManager.listAuditLogs(100);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Demo operations
  app.post('/api/demo/seed', async (req, res) => {
    try {
      const result = await dbManager.seedDemoData();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/demo/clear', async (req, res) => {
    try {
      const result = await dbManager.clearDemoData();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Permanent ID One-Time Setup and Configuration
  app.get('/api/config/perm-id', (req, res) => {
    try {
      const config = dbManager.getPermIdConfig();
      const preview = dbManager.previewPermId();
      res.json({
        ...config,
        preview
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/config/perm-id', (req, res) => {
    try {
      const { prefix, digitCount, currentSequence, adminActor } = req.body;
      const updated = dbManager.updatePermIdConfig({
        prefix,
        digitCount: digitCount ? parseInt(digitCount, 10) : undefined,
        currentSequence: currentSequence !== undefined ? parseInt(currentSequence, 10) : undefined
      }, adminActor || 'admin_web');
      const preview = dbManager.previewPermId();
      res.json({
        success: true,
        config: updated,
        preview
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // List all stored resumes (Local database stored metadata)
  app.get('/api/resumes', async (req, res) => {
    try {
      const resumes = await dbManager.listResumeFiles();
      // Omit heavy base64 strings from listing
      const light = resumes.map(({ dataBase64, ...rest }) => ({
        ...rest,
        hasFileData: Boolean(dataBase64)
      }));
      res.json(light);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Resume Download / Inspection Endpoint (Local Database Stored File)
  app.get('/api/resumes/:id/download', async (req, res) => {
    try {
      const resumes = await dbManager.listResumeFiles();
      const resume = resumes.find(r => r.id === req.params.id);
      if (!resume) {
        return res.status(404).json({ error: 'Resume not found' });
      }

      const buffer = await storageService.getResumeBuffer(resume.storageKey, resume.dataBase64);
      if (!buffer) {
        return res.status(404).json({ error: 'File data could not be retrieved from local database' });
      }

      res.setHeader('Content-Type', resume.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${resume.filename}"`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Run automated test suite
  app.get('/api/tests/run', async (req, res) => {
    try {
      const results = await runAllTests();
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- VITE MIDDLEWARE OR STATIC PRODUCTION SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Jobless Empire] Server and Shared Services API running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
