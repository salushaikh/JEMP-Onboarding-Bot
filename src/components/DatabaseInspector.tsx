import React, { useState, useEffect } from 'react';
import {
  Database,
  Users,
  FileCode,
  Clock,
  Send,
  ShieldAlert,
  CheckCircle,
  RefreshCw,
  Hash,
  Download,
  FileText,
  Sliders,
  HardDrive
} from 'lucide-react';
import { PermIdSetupModal } from './PermIdSetupModal.tsx';

interface DatabaseInspectorProps {
  onRefreshData: () => void;
}

export const DatabaseInspector: React.FC<DatabaseInspectorProps> = ({ onRefreshData }) => {
  const [subTab, setSubTab] = useState<'members' | 'resumes' | 'timeline' | 'outbox' | 'audit'>('members');
  const [members, setMembers] = useState<any[]>([]);
  const [resumes, setResumes] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [outbox, setOutbox] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [permConfig, setPermConfig] = useState<any>(null);
  const [timelineArch, setTimelineArch] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPermModal, setShowPermModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, rRes, tRes, oRes, aRes, hRes, pRes, archRes] = await Promise.all([
        fetch('/api/members'),
        fetch('/api/resumes'),
        fetch('/api/timeline'),
        fetch('/api/outbox'),
        fetch('/api/audit'),
        fetch('/api/health'),
        fetch('/api/config/perm-id'),
        fetch('/api/timeline/architecture')
      ]);

      if (mRes.ok) setMembers(await mRes.json());
      if (rRes.ok) setResumes(await rRes.json());
      if (tRes.ok) setTimeline(await tRes.json());
      if (oRes.ok) setOutbox(await oRes.json());
      if (aRes.ok) setAuditLogs(await aRes.json());
      if (hRes.ok) {
        const h = await hRes.json();
        setDbStatus(h.database);
      }
      if (pRes.ok) setPermConfig(await pRes.json());
      if (archRes.ok) setTimelineArch(await archRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCanonical = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/timeline/sync-canonical', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSyncResult(`Synced ${data.syncedCount} new event(s) (${data.alreadySyncedCount} existing) to ${data.target}.`);
        await fetchData();
      } else {
        setSyncResult('Failed to sync to canonical timeline.');
      }
    } catch (e: any) {
      setSyncResult(`Sync error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMemberAction = async (memberId: string, action: 'suspend' | 'restore' | 'terminate') => {
    let reason = '';
    if (action === 'suspend' || action === 'terminate') {
      reason = prompt(`Enter reason for member ${action}:`) || '';
      if (!reason) return;
    }

    try {
      const res = await fetch(`/api/members/${memberId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, adminActor: 'admin_inspector' })
      });
      if (res.ok) {
        await fetchData();
        onRefreshData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner: DB Connection & Permanent ID Precedence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Database Connection Info */}
        <div className="bg-[#111114] border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-zinc-200 uppercase text-[11px]">Database Engine</span>
              <span className="px-1.5 py-0.2 bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 rounded text-[9px] font-bold">
                ONLINE
              </span>
            </div>
            <div className="text-zinc-400 text-[11px] font-sans">
              {dbStatus?.connectionDetails || 'Local Durable Store (.jemp_data.json)'}
            </div>
            <div className="text-[10px] text-zinc-500">
              Granular inputs supported: <code className="text-zinc-400">DB_HOST</code>, <code className="text-zinc-400">DB_USER</code>, <code className="text-zinc-400">DB_PORT</code>, <code className="text-zinc-400">DB_NAME</code>
            </div>
          </div>
        </div>

        {/* Permanent ID Configuration Widget */}
        <div className="bg-[#111114] border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Hash className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-zinc-200 uppercase text-[11px]">Permanent ID Precedence</span>
              {permConfig?.isConfigured ? (
                <span className="px-1.5 py-0.2 bg-amber-950/60 text-amber-300 border border-amber-800/60 rounded text-[9px] font-bold">
                  CUSTOMIZED
                </span>
              ) : (
                <span className="px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded text-[9px]">
                  DEFAULT
                </span>
              )}
            </div>
            <div className="text-zinc-300 text-xs font-bold">
              Next ID Preview: <span className="text-amber-400 bg-black/40 px-2 py-0.5 rounded border border-amber-500/30">{permConfig?.preview || 'JEMP#001'}</span>
            </div>
            <div className="text-[10px] text-zinc-400">
              Prefix: <strong className="text-zinc-200">{permConfig?.prefix || 'JEMP'}</strong> • Digits: <strong className="text-zinc-200">{permConfig?.digitCount || 3}</strong> • Seq: #{permConfig?.currentSequence || 0}
            </div>
          </div>

          <button
            onClick={() => setShowPermModal(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-lg text-xs flex items-center space-x-1.5 transition-colors shrink-0"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Setup Precedence</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#111114] p-3 rounded-xl border border-zinc-800">
        <div className="flex items-center space-x-2 overflow-x-auto">
          <button
            onClick={() => setSubTab('members')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded transition-colors ${
              subTab === 'members'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>MEMBERS ({members.length})</span>
          </button>

          <button
            onClick={() => setSubTab('resumes')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded transition-colors ${
              subTab === 'resumes'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>STORED RESUMES ({resumes.length})</span>
          </button>

          <button
            onClick={() => setSubTab('timeline')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded transition-colors ${
              subTab === 'timeline'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>PROOF-OF-WORK TIMELINE ({timeline.length})</span>
          </button>

          <button
            onClick={() => setSubTab('outbox')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded transition-colors ${
              subTab === 'outbox'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>CROSS-BOT OUTBOX ({outbox.length})</span>
          </button>

          <button
            onClick={() => setSubTab('audit')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded transition-colors ${
              subTab === 'audit'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>AUDIT LOGS ({auditLogs.length})</span>
          </button>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center space-x-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded shrink-0 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* SUB-VIEW 1: MEMBERS */}
      {subTab === 'members' && (
        <div className="bg-[#111114] border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-zinc-300">
              <thead className="bg-[#09090b] border-b border-zinc-800 text-[11px] text-zinc-400 uppercase">
                <tr>
                  <th className="py-3 px-4">Permanent ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Bound Discord ID</th>
                  <th className="py-3 px-4">Timezone</th>
                  <th className="py-3 px-4">Application Ref</th>
                  <th className="py-3 px-4 text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-zinc-500">
                      No members registered in database yet.
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-amber-400">
                        {m.jempId || 'Pending'}
                      </td>
                      <td className="py-3 px-4 text-zinc-100 font-semibold">{m.name}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.membershipStatus === 'ACTIVE'
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                              : m.membershipStatus === 'SUSPENDED'
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                              : m.membershipStatus === 'TERMINATED'
                              ? 'bg-red-950/80 text-red-300 border border-red-800/80'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {m.membershipStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                        {m.discordUserId ? `<@${m.discordUserId}>` : 'Unbound'}
                      </td>
                      <td className="py-3 px-4 text-zinc-300">{m.timezone || '—'}</td>
                      <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">{m.applicationId}</td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        {m.membershipStatus === 'ACTIVE' && (
                          <button
                            onClick={() => handleMemberAction(m.id, 'suspend')}
                            className="px-2 py-1 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-900/60 rounded text-[10px]"
                          >
                            Suspend
                          </button>
                        )}
                        {m.membershipStatus === 'SUSPENDED' && (
                          <button
                            onClick={() => handleMemberAction(m.id, 'restore')}
                            className="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-900/60 rounded text-[10px]"
                          >
                            Restore
                          </button>
                        )}
                        {m.membershipStatus !== 'TERMINATED' && (
                          <button
                            onClick={() => handleMemberAction(m.id, 'terminate')}
                            className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-900/60 rounded text-[10px]"
                          >
                            Terminate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: STORED RESUMES */}
      {subTab === 'resumes' && (
        <div className="bg-[#111114] border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-3 bg-[#09090b] border-b border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-400">
              Resumes validated and stored directly in the local database (no S3 / R2 required):
            </span>
            <span className="text-[11px] text-amber-400 font-bold">
              Total Resumes: {resumes.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-zinc-300">
              <thead className="bg-[#09090b] border-b border-zinc-800 text-[11px] text-zinc-400 uppercase">
                <tr>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Member Ref</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">SHA-256 Checksum</th>
                  <th className="py-3 px-4">Storage Provider</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {resumes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-zinc-500">
                      No resume files stored yet.
                    </td>
                  </tr>
                ) : (
                  resumes.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-zinc-100 flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{r.filename}</span>
                      </td>
                      <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                        {r.memberId.slice(0, 8)}...
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-1.5 py-0.5 bg-zinc-800 text-amber-300 rounded text-[10px] font-bold">
                          v{r.version}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-300">{formatBytes(r.fileSize)}</td>
                      <td className="py-3 px-4 text-zinc-500 font-mono text-[10px]" title={r.sha256Hash}>
                        {r.sha256Hash.slice(0, 12)}...
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 rounded text-[10px]">
                          Local DB
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-400 text-[11px]">
                        {new Date(r.uploadedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={`/api/resumes/${r.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-700 rounded text-[11px] transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: TIMELINE (CANONICAL SHARED ARCHITECTURE) */}
      {subTab === 'timeline' && (
        <div className="bg-[#111114] border border-zinc-800 rounded-xl p-4 space-y-4">
          {/* Canonical Shared Architecture Notice */}
          <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-zinc-100 text-xs uppercase tracking-wider">
                  Canonical Timeline Architecture
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    timelineArch?.architectureMode === 'CANONICAL_SHARED_DATABASE'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                      : timelineArch?.architectureMode === 'CANONICAL_TIMELINE_SERVICE'
                      ? 'bg-blue-950/80 text-blue-300 border border-blue-800/80'
                      : 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                  }`}
                >
                  {timelineArch?.architectureMode === 'CANONICAL_SHARED_DATABASE'
                    ? 'CANONICAL SHARED DATABASE (ACTIVE)'
                    : timelineArch?.architectureMode === 'CANONICAL_TIMELINE_SERVICE'
                    ? 'CANONICAL TIMELINE SERVICE'
                    : 'TEMPORARY COMPATIBILITY BUFFER'}
                </span>
              </div>

              <button
                onClick={handleSyncCanonical}
                disabled={syncing}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-amber-300 border border-zinc-700 rounded text-[11px] flex items-center space-x-1.5 transition-colors self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Synchronizing...' : 'Migrate / Re-sync to Canonical'}</span>
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
              JEMP is an ecosystem of multiple bots (Onboarding, Timeline, Tasks, Projects) connected to the same database. This table is not an isolated second source of truth. All events are recorded in the canonical shared system with unique idempotency keys.
            </p>

            {syncResult && (
              <div className="text-[11px] text-emerald-400 bg-emerald-950/40 p-2 rounded border border-emerald-900/60">
                {syncResult}
              </div>
            )}
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {timeline.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                No timeline events recorded yet.
              </div>
            ) : (
              timeline.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-zinc-900/70 border border-zinc-800/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-amber-400">{item.eventType}</span>
                      {item.jempId && (
                        <span className="px-1.5 py-0.2 bg-zinc-800 text-zinc-200 rounded text-[10px] font-bold">
                          {item.jempId}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-400">source: {item.source}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          item.canonicalSource === 'SHARED_DB'
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-900/60'
                            : item.canonicalSource === 'TIMELINE_SERVICE'
                            ? 'bg-blue-950/70 text-blue-300 border border-blue-900/60'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {item.canonicalSource || 'COMPATIBILITY_BUFFER'}
                      </span>
                    </div>
                    <div className="text-zinc-300 font-sans">{item.description}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">idempotencyKey: {item.sourceEventId}</div>
                  </div>

                  <div className="text-[10px] text-zinc-400 shrink-0">
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: OUTBOX */}
      {subTab === 'outbox' && (
        <div className="bg-[#111114] border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="text-[11px] text-zinc-400 pb-2 border-b border-zinc-800">
            Transactional outbox events published for cross-bot ecosystem consumption:
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {outbox.map((ev) => (
              <div
                key={ev.id}
                className="p-3 bg-zinc-900/70 border border-zinc-800/80 rounded-lg space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400">{ev.eventType}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">
                    Status: {ev.status} • Retries: {ev.retryCount}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 font-mono">
                  Aggregate: {ev.aggregateType} ({ev.aggregateId})
                </div>
                <pre className="p-2 bg-black/40 rounded border border-zinc-800/80 text-[10px] text-zinc-300 overflow-x-auto">
                  {JSON.stringify(ev.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-VIEW 5: AUDIT */}
      {subTab === 'audit' && (
        <div className="bg-[#111114] border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="text-[11px] text-zinc-400 pb-2 border-b border-zinc-800">
            Immutable administrative audit log trail:
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 bg-zinc-900/50 border border-zinc-800/60 rounded flex items-center justify-between text-xs font-mono"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-zinc-100">{log.action}</span>
                    <span className="text-zinc-400 text-[11px]">by {log.actor}</span>
                    <span className="text-zinc-400 text-[11px]">→ {log.target}</span>
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {JSON.stringify(log.safeMetadata || {})}
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permanent ID Setup Modal */}
      <PermIdSetupModal
        isOpen={showPermModal}
        onClose={() => setShowPermModal(false)}
        onConfigSaved={() => {
          fetchData();
          onRefreshData();
        }}
      />
    </div>
  );
};
