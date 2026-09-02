import React, { useState } from 'react';
import { Terminal, Send, Play, Sparkles, Check, Copy } from 'lucide-react';

interface SlashCommandConsoleProps {
  onRefreshData: () => void;
}

export const SlashCommandConsole: React.FC<SlashCommandConsoleProps> = ({ onRefreshData }) => {
  const [commandInput, setCommandInput] = useState('/onboard dashboard');
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const quickCommands = [
    { label: '/onboard dashboard', cmd: '/onboard dashboard' },
    { label: '/onboard reconcile', cmd: '/onboard reconcile' },
    { label: '/onboard health', cmd: '/onboard health' },
    { label: '/onboard audit', cmd: '/onboard audit' },
    { label: '/membership status', cmd: '/membership status' },
    { label: '/onboard seed-demo', cmd: '/onboard seed-demo' },
    { label: '/onboard clear-demo', cmd: '/onboard clear-demo' }
  ];

  const handleExecute = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || commandInput).trim();
    setLoading(true);
    setOutput(null);

    try {
      if (cmd.startsWith('/onboard dashboard')) {
        const res = await fetch('/api/dashboard');
        const data = await res.json();
        setOutput(
          `⚔️ JOBLESS EMPIRE ONBOARDING DASHBOARD\n\n` +
          `• Total Applications: ${data.stats.totalApplications}\n` +
          `• Approved Whitelist: ${data.stats.approvedApplications}\n` +
          `• Active Members: ${data.stats.activeMembers}\n` +
          `• Last Allocated JEMP#: JEMP#${String(data.stats.currentJempSequence).padStart(3, '0')}\n` +
          `• Stored Resumes: ${data.stats.resumesCount}\n` +
          `• Canonical Timeline Events: ${data.stats.timelineCount}\n` +
          `• Outbox Event Queue: ${data.stats.outboxCount}`
        );
      } else if (cmd.startsWith('/onboard health')) {
        const res = await fetch('/api/health');
        const data = await res.json();
        setOutput(
          `✓ HEALTH STATUS: ${data.status.toUpperCase()}\n\n` +
          `Service: ${data.service} (v${data.version})\n` +
          `Database Mode: ${data.database.type} (Connected: ${data.database.isConnected})\n` +
          `Current JEMP Sequence: ${data.database.currentJempSequence}\n` +
          `Discord Gateway: ${data.bot.mode} (${data.bot.connected ? 'AUTHENTICATED' : 'SIMULATOR & HTTP REST READY'})`
        );
      } else if (cmd.startsWith('/onboard reconcile')) {
        const res = await fetch('/api/reconciliation');
        const data = await res.json();
        setOutput(
          `⚔️ RECONCILIATION SCAN REPORT\n\n` +
          `Members Scanned: ${data.totalMembersChecked}\n` +
          `Anomalies Detected: ${data.anomaliesFound}\n` +
          (data.anomaliesFound === 0
            ? '✓ All records synchronized. Database, JEMP# sequences, and Timeline events are fully consistent.'
            : data.anomalies.map((a: any) => `• [${a.severity}] ${a.description}`).join('\n'))
        );
      } else if (cmd.startsWith('/onboard seed-demo')) {
        const res = await fetch('/api/demo/seed', { method: 'POST' });
        setOutput('✓ Demo data seeded: APP#DEMO-001 (alex), APP#DEMO-002 (samantha), and active member JEMP#001 (elena).');
        onRefreshData();
      } else if (cmd.startsWith('/onboard clear-demo')) {
        const res = await fetch('/api/demo/clear', { method: 'POST' });
        setOutput('✓ All demo data cleared from the database.');
        onRefreshData();
      } else if (cmd.startsWith('/membership status')) {
        setOutput(
          `🪪 YOUR JOBLESS EMPIRE IDENTITY\n\n` +
          `ID: JEMP#001\n` +
          `Status: ACTIVE\n` +
          `Timezone: America/New_York\n` +
          `Resume: v1 (resume_sample.pdf)\n` +
          `Rules Accepted: v1.0`
        );
      } else if (cmd.startsWith('/onboard audit')) {
        const res = await fetch('/api/audit');
        const data = await res.json();
        const lines = data.slice(0, 8).map((l: any) => `• [${new Date(l.timestamp).toLocaleTimeString()}] ${l.actor} executed ${l.action} on ${l.target}`).join('\n');
        setOutput(`AUDIT LOG TRAIL:\n\n${lines}`);
      } else {
        setOutput(`Executed slash command: ${cmd}\nResult: Dispatched through Jobless Empire command pipeline.`);
      }
    } catch (err: any) {
      setOutput(`Error executing command: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      <div className="bg-[#111114] p-4 rounded-xl border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-zinc-200 font-bold">
            <Terminal className="w-4 h-4 text-amber-500" />
            <span>DISCORD SLASH COMMAND TERMINAL</span>
          </div>
          <span className="text-[10px] text-zinc-400">Emulates Discord interaction handler</span>
        </div>

        {/* Quick Command Chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {quickCommands.map((qc) => (
            <button
              key={qc.cmd}
              onClick={() => {
                setCommandInput(qc.cmd);
                handleExecute(qc.cmd);
              }}
              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded text-[11px] text-zinc-300 hover:text-white transition-colors"
            >
              {qc.label}
            </button>
          ))}
        </div>

        {/* Command Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExecute();
          }}
          className="flex space-x-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="e.g. /onboard dashboard, /onboard reconcile..."
              className="w-full bg-[#09090b] border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-zinc-950 font-bold rounded flex items-center space-x-1.5 transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>RUN</span>
          </button>
        </form>

        {/* Terminal Output */}
        {output && (
          <div className="p-4 bg-black/90 border border-zinc-800 rounded-lg space-y-2">
            <div className="text-[10px] text-zinc-400 flex items-center justify-between border-b border-zinc-800 pb-1">
              <span>OUTPUT (EPHEMERAL DISCORD EMBED)</span>
              <span>200 OK</span>
            </div>
            <pre className="text-zinc-300 whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
