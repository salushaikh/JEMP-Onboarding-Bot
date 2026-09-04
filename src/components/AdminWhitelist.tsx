import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Search, Shield, CheckCircle, XCircle, RotateCcw, Filter, Calendar, RefreshCw } from 'lucide-react';

interface AdminWhitelistProps {
  onRefreshData: () => void;
  refreshTrigger?: number;
}

export const AdminWhitelist: React.FC<AdminWhitelistProps> = ({ onRefreshData, refreshTrigger }) => {
  const [applications, setApplications] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add application modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [appId, setAppId] = useState(`APP#${Math.floor(1000 + Math.random() * 9000)}`);
  const [applicantName, setApplicantName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [expiration, setExpiration] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchApps = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const res = await fetch('/api/applications');
      if (res.ok) {
        const data = await res.json();
        setApplications(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!quiet) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();
    const interval = setInterval(() => {
      fetchApps(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchApps, refreshTrigger]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: appId,
          applicantName,
          email,
          notes,
          expiration: expiration || undefined,
          adminActor: 'admin_dashboard'
        })
      });

      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setApplicantName('');
        setEmail('');
        setNotes('');
        setExpiration('');
        setAppId(`APP#${Math.floor(1000 + Math.random() * 9000)}`);
        await fetchApps();
        onRefreshData();
      } else {
        setFormError(data.error || 'Failed to approve application.');
      }
    } catch (err: any) {
      setFormError('Server error while saving application.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    const reason = prompt('Enter reason for revoking whitelist approval:');
    if (!reason) return;

    try {
      const res = await fetch(`/api/applications/${id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, adminActor: 'admin_dashboard' })
      });
      if (res.ok) {
        await fetchApps();
        onRefreshData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/applications/${id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminActor: 'admin_dashboard' })
      });
      if (res.ok) {
        await fetchApps();
        onRefreshData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.email && app.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header with Search and Add button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#111114] p-4 rounded-xl border border-zinc-800">
        <div>
          <h2 className="text-sm font-mono font-bold text-zinc-100 flex items-center space-x-2">
            <Shield className="w-4 h-4 text-amber-500" />
            <span>APPROVED APPLICATION REGISTRY (WHITELIST)</span>
          </h2>
          <p className="text-xs text-zinc-400 font-sans mt-0.5">
            Only applications explicitly approved here are eligible for Discord email verification and onboarding.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => { fetchApps(false); onRefreshData(); }}
            title="Refresh Whitelist Data"
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 rounded font-mono text-xs flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-500' : ''}`} />
            <span className="hidden sm:inline">REFRESH</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-zinc-950 font-mono text-xs font-bold rounded flex items-center space-x-1.5 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>APPROVE APPLICANT (/onboard add)</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by ID, name, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#111114] border border-zinc-800 rounded pl-9 pr-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-zinc-400 text-[11px]">STATUS:</span>
          {['ALL', 'APPROVED', 'PENDING', 'REVOKED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                statusFilter === st
                  ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-[#111114] border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs text-zinc-300">
            <thead className="bg-[#09090b] border-b border-zinc-800 text-[11px] text-zinc-400 uppercase">
              <tr>
                <th className="py-3 px-4">Application ID</th>
                <th className="py-3 px-4">Applicant Name</th>
                <th className="py-3 px-4">Approved Email</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Vetting Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-zinc-400 font-sans text-xs">
                    No applications found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => (
                  <tr key={app.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-zinc-100">{app.id}</td>
                    <td className="py-3 px-4 text-zinc-200">{app.applicantName}</td>
                    <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                      {app.email || 'None'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          app.status === 'APPROVED'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                            : app.status === 'REVOKED'
                            ? 'bg-red-950/80 text-red-300 border border-red-800/80'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-400 max-w-xs truncate font-sans text-[11px]">
                      {app.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {app.status === 'APPROVED' ? (
                        <button
                          onClick={() => handleRevoke(app.id)}
                          title="Revoke Whitelist"
                          className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-900/60 rounded text-[10px] transition-colors"
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestore(app.id)}
                          title="Restore Approval"
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded text-[10px] transition-colors"
                        >
                          Restore
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

      {/* MODAL: Add Approved Application */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#141418] border border-zinc-700 rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="text-sm font-bold text-zinc-100 font-mono uppercase flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-amber-500" />
                <span>Approve Applicant (/onboard add)</span>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-200 text-lg">
                ×
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-zinc-300 block mb-1">Application ID</label>
                <input
                  type="text"
                  required
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-500"
                  placeholder="APP#0042"
                />
              </div>

              <div>
                <label className="text-zinc-300 block mb-1">Applicant Name</label>
                <input
                  type="text"
                  required
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-500"
                  placeholder="Elena Rostova"
                />
              </div>

              <div>
                <label className="text-zinc-300 block mb-1">Approved Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-500"
                  placeholder="applicant@domain.com"
                />
              </div>

              <div>
                <label className="text-zinc-300 block mb-1">Internal Vetting Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-500"
                  placeholder="Senior Rust / Systems builder, verified GitHub"
                />
              </div>

              <div>
                <label className="text-zinc-300 block mb-1">Whitelist Expiration (Optional)</label>
                <input
                  type="datetime-local"
                  value={expiration}
                  onChange={(e) => setExpiration(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {formError && (
                <div className="p-2.5 bg-red-950/40 border border-red-900/60 rounded text-red-300 text-[11px]">
                  {formError}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold rounded"
                >
                  {loading ? 'Saving...' : 'Add to Whitelist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
