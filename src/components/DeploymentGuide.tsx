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
  HardDrive,
  Box
} from 'lucide-react';

export const DeploymentGuide: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [generatedSecret, setGeneratedSecret] = useState('');
  const [activeSection, setActiveSection] = useState<
    'faq' | 'discord' | 'database' | 'docker' | 'hosting'
  >('docker');

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
            onClick={() => setActiveSection('docker')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5 ${
              activeSection === 'docker'
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>4. Windows &amp; Docker (PostgreSQL)</span>
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
            <span>5. Cloud Hosting</span>
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

            {/* Item 1: Timeline Service URL & Shared Ecosystem */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-100 text-xs">
                  Q1: What is <code className="text-amber-400">TIMELINE_SERVICE_URL</code> and the Canonical Architecture?
                </span>
                <span className="px-2 py-0.5 bg-zinc-800 text-emerald-400 rounded text-[10px]">Canonical Architecture</span>
              </div>
              <p className="text-zinc-300 font-sans leading-relaxed">
                <strong>Plain English:</strong> JEMP is a system of multiple bots (Onboarding, Timeline / Proof-of-Work, Brainstorming, Tasks, Client/Hiring) connected to the <strong>same shared PostgreSQL database</strong>. There is strictly <strong>one canonical source of truth</strong> for the entire ecosystem.
              </p>
              <div className="p-3 bg-black/40 border border-zinc-800 rounded text-[11px] space-y-1.5 text-zinc-300">
                <p className="text-amber-300 font-bold">
                  🔗 How the Bots Share Data:
                </p>
                <p>
                  1. <strong>Shared PostgreSQL (Recommended):</strong> When all bots share the same PostgreSQL database, the <code>timeline_events</code> table is the single canonical source of truth. The Onboarding bot writes directly to it upon approval, rule acceptance, and membership activation.
                </p>
                <p>
                  2. <strong>Timeline Companion Service (Optional):</strong> If you run the Timeline Bot as a standalone microservice with an API, <code>TIMELINE_SERVICE_URL</code> is its endpoint (e.g. <code>http://localhost:3001</code>).
                </p>
                <p>
                  3. <strong>Standalone Dev (Compatibility Buffer):</strong> If you run the Onboarding bot in local dev without PostgreSQL, events are buffered in the local compatibility store and can be synced anytime via the Database Inspector.
                </p>
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
                <strong>Plain English:</strong> It is a shared authentication token between this Onboarding bot and your Timeline bot service so an unauthorized caller cannot inject spoofed events.
              </p>
              <p className="text-zinc-300 font-sans leading-relaxed">
                <strong>How do you get it?</strong> You invent any secret passphrase you want (for example: <code className="text-amber-300">jemp-shared-secret-2026</code>) and place the identical value in both bots' <code className="text-zinc-300">.env</code> files! If connecting via shared PostgreSQL directly, you don't even need this token.
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
                  <span>Enable Privileged Gateway Intents (MANDATORY)</span>
                </div>
                <div className="text-zinc-300 font-sans space-y-1.5">
                  <p>In the <strong>Bot</strong> tab, scroll down to <strong>Privileged Gateway Intents</strong> and enable both:</p>
                  <div className="p-2 bg-black/40 border border-zinc-800 rounded space-y-1 text-xs">
                    <div className="text-emerald-400 flex items-center space-x-1.5 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Server Members Intent (Required for guildMemberAdd &amp; auto-posting verification card when user joins)</span>
                    </div>
                    <div className="text-emerald-400 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Message Content Intent (Required to process attachments and commands)</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-400/90 font-mono">
                    *If Server Members Intent is off in the Dev Portal, Discord will block join events and the bot won't know when members join!*
                  </p>
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

      {/* SECTION 4: WINDOWS DOCKER & POSTGRESQL SETUP */}
      {activeSection === 'docker' && (
        <div className="space-y-4">
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide flex items-center space-x-2">
                  <Box className="w-4 h-4 text-amber-400" />
                  <span>Local Windows Setup with Docker &amp; PostgreSQL</span>
                </h3>
                <p className="text-zinc-400 text-xs font-sans mt-0.5">
                  Complete, turnkey guide to run PostgreSQL and the Onboarding Bot in Docker on Windows.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 rounded text-[11px] font-bold self-start sm:self-auto">
                RECOMMENDED ARCHITECTURE
              </span>
            </div>

            {/* Architecture Diagram Callout */}
            <div className="p-4 bg-black/60 border border-zinc-800 rounded-xl space-y-2">
              <div className="text-[11px] font-bold text-zinc-300 flex items-center space-x-2">
                <Server className="w-3.5 h-3.5 text-amber-400" />
                <span>What Runs on Your Windows Laptop:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-400 text-xs">Container 1: jemp-postgres</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Port 5432</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-sans">
                    Official PostgreSQL 16. Persistent volume <code>jemp_postgres_data</code>. Schema auto-initialized from <code>schema.sql</code>. Shared by all JEMP bots.
                  </p>
                </div>

                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-400 text-xs">Container 2: jemp-onboarding-bot</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Port 3000</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-sans">
                    Runs the Discord Bot gateway and Web Control Panel. Connects to PostgreSQL directly via internal Docker network <code>jemp_shared_network</code>.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 1 */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-zinc-100 font-bold text-xs">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">1</span>
                <span>Install Docker Desktop on Windows</span>
              </div>
              <p className="text-zinc-300 font-sans text-xs pl-7">
                Download and install <strong>Docker Desktop</strong> from{' '}
                <a
                  href="https://www.docker.com/products/docker-desktop"
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 hover:underline"
                >
                  docker.com
                </a>
                . Ensure <strong>"Use WSL 2 instead of Hyper-V"</strong> is enabled (recommended default). Start Docker Desktop and wait until the whale icon shows green "Running".
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-zinc-100 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">2</span>
                  <span>Configure Environment File (.env)</span>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `copy .env.example .env\nnotepad .env`,
                      'copy-env-cmd'
                    )
                  }
                  className="text-amber-400 hover:text-amber-300 flex items-center space-x-1 text-[11px]"
                >
                  {copiedKey === 'copy-env-cmd' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'copy-env-cmd' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-zinc-300 font-sans text-xs pl-7">
                In PowerShell or Command Prompt in the project folder, copy <code>.env.example</code> to <code>.env</code>:
              </p>
              <pre className="p-2.5 bg-black border border-zinc-800 rounded text-[11px] text-zinc-200 ml-7 overflow-x-auto">
{`copy .env.example .env
notepad .env`}
              </pre>
              <p className="text-zinc-400 font-sans text-xs pl-7">
                Set your <code>DISCORD_TOKEN</code> and <code>DISCORD_CLIENT_ID</code>. The database variables are already pre-configured to match the Docker PostgreSQL container (user: <code>postgres</code>, password: <code>jemp_secret_password_2026</code>).
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-zinc-100 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">3</span>
                  <span>Launch Everything with Docker Compose</span>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `docker compose up -d --build`,
                      'docker-up-cmd'
                    )
                  }
                  className="text-amber-400 hover:text-amber-300 flex items-center space-x-1 text-[11px]"
                >
                  {copiedKey === 'docker-up-cmd' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'docker-up-cmd' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-zinc-300 font-sans text-xs pl-7">
                Run this single command in PowerShell inside your project folder:
              </p>
              <pre className="p-2.5 bg-black border border-zinc-800 rounded text-[11px] text-amber-300 font-bold ml-7 overflow-x-auto">
{`docker compose up -d --build`}
              </pre>
              <div className="p-3 bg-black/40 border border-zinc-800 rounded text-[11px] text-zinc-300 ml-7 space-y-1">
                <div className="text-emerald-400 font-bold">✨ What Docker automatically handles for you:</div>
                <div>1. Spawns PostgreSQL 16 container with a persistent Windows Docker volume.</div>
                <div>2. Executes <code>schema.sql</code> to create all 9 canonical tables, indexes, and sequential JEMP# generator.</div>
                <div>3. Compiles the TypeScript bot and mounts it on port 3000.</div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-zinc-100 font-bold text-xs">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">4</span>
                <span>Verify Status &amp; Open Web Dashboard</span>
              </div>
              <div className="space-y-2 pl-7">
                <p className="text-zinc-300 font-sans text-xs">
                  Verify containers in PowerShell:
                </p>
                <pre className="p-2.5 bg-black border border-zinc-800 rounded text-[11px] text-zinc-200 overflow-x-auto">
{`docker compose ps`}
                </pre>
                <p className="text-zinc-300 font-sans text-xs">
                  Then open your browser on your Windows laptop:
                </p>
                <a
                  href="http://localhost:3000"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded hover:bg-amber-500/30 text-xs font-bold"
                >
                  <span>Open Web Control Panel (http://localhost:3000)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Step 5: Connecting from Windows DB tools */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-zinc-100 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">5</span>
                  <span>Connect to PostgreSQL via DBeaver, pgAdmin or CLI</span>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `docker exec -it jemp-postgres psql -U postgres -d jobless_empire`,
                      'psql-cmd'
                    )
                  }
                  className="text-amber-400 hover:text-amber-300 flex items-center space-x-1 text-[11px]"
                >
                  {copiedKey === 'psql-cmd' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'psql-cmd' ? 'Copied' : 'Copy CLI'}</span>
                </button>
              </div>
              <p className="text-zinc-300 font-sans text-xs pl-7">
                Because port <code>5432</code> is exposed to your Windows host, you can connect from any desktop database tool:
              </p>
              <div className="ml-7 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 bg-black border border-zinc-800 rounded">
                  <div className="text-zinc-500 text-[10px]">HOST</div>
                  <div className="text-zinc-200 font-bold">localhost</div>
                </div>
                <div className="p-2 bg-black border border-zinc-800 rounded">
                  <div className="text-zinc-500 text-[10px]">PORT</div>
                  <div className="text-zinc-200 font-bold">5432</div>
                </div>
                <div className="p-2 bg-black border border-zinc-800 rounded">
                  <div className="text-zinc-500 text-[10px]">DATABASE</div>
                  <div className="text-zinc-200 font-bold">jobless_empire</div>
                </div>
                <div className="p-2 bg-black border border-zinc-800 rounded">
                  <div className="text-zinc-500 text-[10px]">USER / PASSWORD</div>
                  <div className="text-zinc-200 font-bold">postgres / jemp_secret_password_2026</div>
                </div>
              </div>
              <p className="text-zinc-400 font-sans text-xs pl-7">
                Or inspect tables directly in PowerShell:
              </p>
              <pre className="p-2.5 bg-black border border-zinc-800 rounded text-[11px] text-zinc-200 ml-7 overflow-x-auto">
{`docker exec -it jemp-postgres psql -U postgres -d jobless_empire
# Inside psql, type: \\dt
# Then try: SELECT * FROM members;`}
              </pre>
            </div>

            {/* Step 6: Multi-Bot Ecosystem Sharing */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
              <div className="font-bold text-zinc-100 text-xs flex items-center space-x-2">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>How Future JEMP Bots Connect to this PostgreSQL Container</span>
              </div>
              <p className="text-zinc-300 font-sans text-xs leading-relaxed">
                When you deploy companion bots (Timeline Bot, Tasks Bot, Projects Bot):
              </p>
              <ul className="list-disc list-inside text-zinc-400 font-sans text-xs space-y-1 pl-1">
                <li>They can join the same Docker network: <code className="text-amber-300">jemp_shared_network</code>.</li>
                <li>Set their database host to <code className="text-zinc-200">jemp-postgres</code> on port <code className="text-zinc-200">5432</code>.</li>
                <li>They immediately read and write to the same canonical tables without any data syncing needed!</li>
              </ul>
            </div>

            {/* Common Docker Management Commands */}
            <div className="p-4 bg-black border border-zinc-800 rounded-xl space-y-2">
              <div className="text-zinc-400 text-[11px] font-bold">USEFUL DOCKER COMMANDS FOR WINDOWS:</div>
              <pre className="text-zinc-300 font-mono text-[11px] leading-relaxed overflow-x-auto">
{`# View real-time logs of the bot:
docker compose logs -f onboarding-bot

# View database logs:
docker compose logs -f postgres

# Stop containers without losing data:
docker compose stop

# Restart containers:
docker compose start

# Rebuild after making code edits:
docker compose up -d --build`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: HOSTING & COMMANDS */}
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
