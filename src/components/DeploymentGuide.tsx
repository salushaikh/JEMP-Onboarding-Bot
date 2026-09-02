import React, { useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Key,
  Shield,
  Server,
  Database,
  ExternalLink,
  Copy,
  Check,
  Terminal,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  HardDrive
} from 'lucide-react';

export const DeploymentGuide: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [generatedSecret, setGeneratedSecret] = useState('');
  const [activeSection, setActiveSection] = useState<
    'faq' | 'discord' | 'database' | 'hosting'
  >('faq');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const generateRandomKey = () => {
    const chars = 'abcdef0123456789';
    let res = '';
    for (let i = 0; i < 32; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedSecret(res);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header Banner */}
      <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-amber-400 font-bold text-sm uppercase">
              🚀 Beginner's Master Guide
            </span>
            <span className="px-2 py-0.5 bg-amber-950/40 text-amber-300 border border-amber-800/40 rounded text-[10px]">
              ZERO-TO-HERO SETUP
            </span>
          </div>
          <p className="text-zinc-400 text-xs font-sans mt-1">
            Complete guide for hosting, Discord bot credentials, Timeline ecosystem variables, and local database storage.
          </p>
        </div>

        {/* Section switcher pills */}
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <button
            onClick={() => setActiveSection('faq')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5 ${
              activeSection === 'faq'
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>1. Timeline &amp; Secrets FAQ</span>
          </button>

          <button
            onClick={() => setActiveSection('discord')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5 ${
              activeSection === 'discord'
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>2. Discord Bot Setup</span>
          </button>

          <button
            onClick={() => setActiveSection('database')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5 ${
              activeSection === 'database'
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>3. Local DB &amp; Resumes</span>
          </button>

          <button
            onClick={() => setActiveSection('hosting')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5 ${
              activeSection === 'hosting'
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>4. Hosting &amp; Running</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: TIMELINE, SECRET & ENCRYPTION KEY EXPLAINER */}
      {activeSection === 'faq' && (
        <div className="space-y-4">
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide flex items-center space-x-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Answers to Your Questions: Timeline URL, Secret &amp; Encryption Key</span>
            </h3>

            {/* Item 1: Timeline Service URL */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-100 text-xs">
                  Q1: What is <code className="text-amber-400">TIMELINE_SERVICE_URL</code> and how do I get it?
                </span>
                <span className="px-2 py-0.5 bg-zinc-800 text-emerald-400 rounded text-[10px]">Optional</span>
              </div>
              <p className="text-zinc-300 font-sans leading-relaxed">
                <strong>Plain English:</strong> In the Jobless Empire vision, there is a second bot called the <em>Timeline Bot</em> (responsible for recording proof-of-work achievements). If you run both bots on the same server or across servers, <code className="text-amber-300">TIMELINE_SERVICE_URL</code> is simply the web address of that companion bot (e.g. <code className="text-zinc-300">http://localhost:3001</code>).
              </p>
              <div className="p-3 bg-black/40 border border-zinc-800 rounded text-[11px] text-emerald-300">
                💡 <strong>Do you need it right now? NO!</strong> If you don't have the Timeline bot running yet, <strong>leave it blank</strong>. This Onboarding bot stores all timeline events and achievements locally in its own local database (`timelineEvents` table) without needing any external server.
              </div>
            </div>

            {/* Item 2: Timeline Service Secret */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-100 text-xs">
                  Q2: What is <code className="text-amber-400">TIMELINE_SERVICE_SECRET</code> and how do I get it?
                </span>
                <span className="px-2 py-0.5 bg-zinc-800 text-emerald-400 rounded text-[10px]">Optional</span>
              </div>
              <p className="text-zinc-300 font-sans leading-relaxed">
                <strong>Plain English:</strong> It is simply a shared password between this Onboarding bot and your Timeline bot so a stranger cannot forge timeline events.
              </p>
              <p className="text-zinc-300 font-sans leading-relaxed">
                <strong>How do you get it?</strong> You do not get it from Discord or any website. You literally invent any secret passphrase you want (for example: <code className="text-amber-300">my-secret-timeline-token-2026</code>) and write that same word in both bots' <code className="text-zinc-300">.env</code> files! If you have no Timeline bot, leave it blank.
              </p>
            </div>

            {/* Item 3: Encryption Key */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-100 text-xs">
                  Q3: What should I input for <code className="text-amber-400">ENCRYPTION_KEY</code>?
                </span>
                <span className="px-2 py-0.5 bg-amber-950/40 text-amber-300 border border-amber-800/40 rounded text-[10px]">Required</span>
              </div>
              <p className="text-zinc-300 font-sans leading-relaxed">
                <strong>Plain English:</strong> This is a 32-character secret key used by the bot to encrypt sensitive data (such as emails or resume hashes) with industry-standard AES-256 encryption.
              </p>
              <div className="p-3 bg-black/40 border border-zinc-800 rounded space-y-2">
                <div className="text-zinc-400 text-[11px]">
                  You can type any 32-character string, or click below to generate one immediately:
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedSecret || 'jemp_master_key_default_32_bytes_len'}
                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-amber-400 font-mono text-xs focus:outline-none"
                  />
                  <button
                    onClick={generateRandomKey}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded flex items-center space-x-1 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Key</span>
                  </button>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        generatedSecret || 'jemp_master_key_default_32_bytes_len',
                        'enc'
                      )
                    }
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded flex items-center space-x-1 transition-colors"
                  >
                    {copiedKey === 'enc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'enc' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: DISCORD DEVELOPER PORTAL SETUP */}
      {activeSection === 'discord' && (
        <div className="space-y-4">
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide flex items-center space-x-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Discord Developer Portal &amp; Permissions (Step-by-Step)</span>
              </h3>
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 flex items-center space-x-1 transition-colors"
              >
                <span>Discord Dev Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Step 1 */}
              <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">1</span>
                  <span>Create Application &amp; Bot Token</span>
                </div>
                <ul className="list-disc list-inside text-zinc-300 font-sans space-y-1 pl-1">
                  <li>Click <strong>New Application</strong> &rarr; name it <code>Jobless Empire Onboarding</code>.</li>
                  <li>Click <strong>Bot</strong> in the left sidebar.</li>
                  <li>Click <strong>Reset Token</strong> &rarr; Copy your token to <code>DISCORD_TOKEN</code>.</li>
                  <li>In General Information, copy <strong>Application ID</strong> to <code>DISCORD_CLIENT_ID</code>.</li>
                </ul>
              </div>

              {/* Step 2 */}
              <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">2</span>
                  <span>Enable Privileged Gateway Intents</span>
                </div>
                <div className="text-zinc-300 font-sans space-y-1.5">
                  <p>In the <strong>Bot</strong> tab, scroll down to <strong>Privileged Gateway Intents</strong> and enable:</p>
                  <div className="p-2 bg-black/40 border border-zinc-800 rounded space-y-1 text-xs">
                    <div className="text-emerald-400 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Server Members Intent (Required to assign Member roles)</span>
                    </div>
                    <div className="text-emerald-400 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Message Content Intent (Required to process verification)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">3</span>
                  <span>Generate Bot Invite URL</span>
                </div>
                <ul className="list-disc list-inside text-zinc-300 font-sans space-y-1 pl-1">
                  <li>In the left sidebar, click <strong>OAuth2</strong> &rarr; <strong>URL Generator</strong>.</li>
                  <li>Under Scopes, check: <code>bot</code> and <code>applications.commands</code>.</li>
                  <li>Under Bot Permissions, select: <code>Administrator</code> (or <code>Manage Roles</code>, <code>Manage Channels</code>, <code>Send Messages</code>, <code>Attach Files</code>).</li>
                  <li>Copy the URL at the bottom, paste it into your browser, and select your server!</li>
                </ul>
              </div>

              {/* Step 4 */}
              <div className="p-4 bg-zinc-900/60 border border-amber-500/30 rounded-xl space-y-2 bg-amber-950/10">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">4</span>
                  <span>Crucial: Discord Role Hierarchy</span>
                </div>
                <div className="text-zinc-300 font-sans space-y-1 text-xs">
                  <p className="text-amber-200">
                    ⚠️ <strong>Top Beginner Pitfall:</strong> Discord does not allow a bot to grant any role that sits above the bot's own role!
                  </p>
                  <p>
                    Go to <strong>Server Settings &rarr; Roles</strong>. Drag your Bot's role to the TOP (above <code>Member</code> and <code>Unverified</code>).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: LOCAL DB & RESUMES */}
      {activeSection === 'database' && (
        <div className="space-y-4">
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide flex items-center space-x-2">
              <HardDrive className="w-4 h-4 text-amber-400" />
              <span>Local Database &amp; Resume Storage (No Object Storage Needed)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Local Zero-Config */}
              <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Option A: Zero-Config Embedded Database</span>
                </div>
                <p className="text-zinc-300 font-sans text-xs">
                  You do not need to install anything! The bot includes an atomic, restart-safe durable database persisted to <code>.jemp_data.json</code>.
                </p>
                <div className="p-2.5 bg-black/40 border border-zinc-800 rounded text-[11px] text-zinc-400">
                  Runs instantly out-of-the-box. All applications, members, JEMP# sequences, timeline events, and resumes persist across restarts.
                </div>
              </div>

              {/* Local PostgreSQL */}
              <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <Database className="w-4 h-4" />
                  <span>Option B: Local PostgreSQL Database</span>
                </div>
                <p className="text-zinc-300 font-sans text-xs">
                  If you have PostgreSQL running locally, specify individual parameters in <code>.env</code>:
                </p>
                <pre className="p-2.5 bg-black/50 border border-zinc-800 rounded text-[10px] text-amber-300 overflow-x-auto">
{`DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=jobless_empire`}
                </pre>
              </div>
            </div>

            {/* Resume Storage Clarification */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
              <div className="font-bold text-zinc-100 text-xs">
                📄 How Resumes are Stored (No S3 / No Cloud Storage Needed)
              </div>
              <p className="text-zinc-300 font-sans text-xs leading-relaxed">
                As requested, we completely eliminated the need for external AWS S3, Cloudflare R2, or remote object storage. When an applicant uploads a PDF or DOCX file:
              </p>
              <ol className="list-decimal list-inside text-zinc-400 font-sans text-xs space-y-1 pl-1">
                <li>The bot validates file type (PDF/DOC/DOCX), max 10MB size, and computes a SHA-256 checksum.</li>
                <li>The binary file is converted to a base64 payload and stored <strong>directly inside the local database row</strong>.</li>
                <li>Admins can download or inspect the stored resume directly via the Database Inspector or the API endpoint <code>/api/resumes/:id/download</code>.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: HOSTING & COMMANDS */}
      {activeSection === 'hosting' && (
        <div className="space-y-4">
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-amber-400" />
              <span>Hosting &amp; Running the Bot</span>
            </h3>

            <div className="space-y-3">
              <div className="text-xs text-zinc-300 font-sans">
                Below are the exact commands to clone, configure, and launch the bot:
              </div>

              <div className="p-4 bg-black border border-zinc-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                  <span>TERMINAL COMMANDS</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `# 1. Install dependencies\nnpm install\n\n# 2. Copy and edit environment variables\ncp .env.example .env\n\n# 3. Start development server & bot\nnpm run dev\n\n# 4. Or build for production\nnpm run build\nnpm start`,
                        'cli'
                      )
                    }
                    className="flex items-center space-x-1 text-amber-400 hover:text-amber-300"
                  >
                    {copiedKey === 'cli' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cli' ? 'Copied' : 'Copy Commands'}</span>
                  </button>
                </div>
                <pre className="text-zinc-200 font-mono text-[11px] leading-relaxed overflow-x-auto">
{`# 1. Install all dependencies
npm install

# 2. Copy environment file and fill in your DISCORD_TOKEN
cp .env.example .env

# 3. Start dev server with hot reload & API
npm run dev

# 4. Or compile and run in production mode:
npm run build
npm start`}
                </pre>
              </div>

              {/* Free/Cheap Hosting Recommendations */}
              <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
                <div className="font-bold text-zinc-100 text-xs">
                  Recommended 24/7 Cloud Hosts for Beginners:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-1">
                    <span className="font-bold text-amber-400">Railway.app</span>
                    <p className="text-[11px] text-zinc-400 font-sans">
                      Simplest setup. Connect your GitHub repo, add your <code>.env</code> variables, and it runs 24/7 automatically.
                    </p>
                  </div>
                  <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-1">
                    <span className="font-bold text-amber-400">Render.com</span>
                    <p className="text-[11px] text-zinc-400 font-sans">
                      Free tier web services and background workers with managed PostgreSQL databases.
                    </p>
                  </div>
                  <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-1">
                    <span className="font-bold text-amber-400">Self-Hosted VPS</span>
                    <p className="text-[11px] text-zinc-400 font-sans">
                      Hetzner / DigitalOcean ($4/mo) or your own home computer using Node.js &amp; PM2 (<code>pm2 start server.ts</code>).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
