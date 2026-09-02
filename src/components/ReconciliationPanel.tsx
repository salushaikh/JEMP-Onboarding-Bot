import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, ShieldCheck, Wrench } from 'lucide-react';

interface ReconciliationPanelProps {
  onRefreshData: () => void;
}

export const ReconciliationPanel: React.FC<ReconciliationPanelProps> = ({ onRefreshData }) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [repairingId, setRepairingId] = useState<string | null>(null);

  const runScan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reconciliation');
      if (res.ok) {
        setReport(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runScan();
  }, []);

  const handleRepair = async (anomalyId: string) => {
    setRepairingId(anomalyId);
    try {
      const res = await fetch('/api/reconciliation/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anomalyId, adminActor: 'admin_reconciliation' })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✓ Repair successful: ${data.message}`);
        await runScan();
        onRefreshData();
      } else {
        alert(`Repair notice: ${data.message}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRepairingId(null);
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header Banner */}
      <div className="bg-[#111114] p-4 rounded-xl border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-zinc-100 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            <span>RECONCILIATION ENGINE (/onboard reconcile)</span>
          </h2>
          <p className="text-zinc-400 font-sans text-xs mt-0.5">
            Audit consistency across PostgreSQL database, Discord Gateway role bindings, and canonical Timeline events.
          </p>
        </div>

        <button
          onClick={runScan}
          disabled={loading}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold rounded flex items-center space-x-2 shrink-0 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>RUN FULL AUDIT SCAN</span>
        </button>
      </div>

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-[#111114] rounded-lg border border-zinc-800">
            <div className="text-[10px] text-zinc-400 uppercase">Members Scanned</div>
            <div className="text-lg font-bold text-zinc-100 mt-1">{report.totalMembersChecked}</div>
          </div>
          <div className="p-3 bg-[#111114] rounded-lg border border-zinc-800">
            <div className="text-[10px] text-zinc-400 uppercase">Anomalies Detected</div>
            <div className={`text-lg font-bold mt-1 ${report.anomaliesFound > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {report.anomaliesFound}
            </div>
          </div>
          <div className="p-3 bg-[#111114] rounded-lg border border-zinc-800">
            <div className="text-[10px] text-zinc-400 uppercase">Missing JEMP#</div>
            <div className="text-lg font-bold text-zinc-100 mt-1">{report.summary.missingJempIds}</div>
          </div>
          <div className="p-3 bg-[#111114] rounded-lg border border-zinc-800">
            <div className="text-[10px] text-zinc-400 uppercase">Timeline Gaps</div>
            <div className="text-lg font-bold text-zinc-100 mt-1">{report.summary.timelineGaps}</div>
          </div>
        </div>
      )}

      {/* Anomalies List */}
      <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <span className="font-bold text-zinc-200">DETECTED ANOMALIES &amp; REPAIR ACTIONS</span>
          {report && (
            <span className="text-[10px] text-zinc-400">
              Last Scan: {new Date(report.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>

        {report && report.anomalies.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
            <div className="font-bold text-zinc-200 text-sm">All Records Synchronized</div>
            <p className="text-zinc-400 font-sans max-w-sm mx-auto text-xs">
              No role discrepancies, missing JEMP# sequences, or timeline gaps detected. The database and Discord state are in perfect alignment.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {report?.anomalies.map((anom: any) => (
              <div
                key={anom.id}
                className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        anom.severity === 'HIGH'
                          ? 'bg-red-950 text-red-300 border border-red-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {anom.severity}
                    </span>
                    <span className="font-bold text-zinc-200">{anom.category}</span>
                  </div>
                  <div className="text-zinc-300 font-sans text-xs">{anom.description}</div>
                  <div className="text-[10px] text-amber-400 font-mono">
                    Suggested Fix: {anom.suggestedFix}
                  </div>
                </div>

                <button
                  onClick={() => handleRepair(anom.id)}
                  disabled={repairingId === anom.id}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded text-xs flex items-center space-x-1.5 shrink-0 transition-colors"
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-500" />
                  <span>{repairingId === anom.id ? 'Repairing...' : 'Safe Repair'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
