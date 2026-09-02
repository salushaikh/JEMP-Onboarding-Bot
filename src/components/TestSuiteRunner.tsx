import React, { useState } from 'react';
import { Play, CheckCircle2, XCircle, Clock, ShieldCheck, RefreshCw } from 'lucide-react';

export const TestSuiteRunner: React.FC = () => {
  const [testResults, setTestResults] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'PASSED' | 'FAILED'>('ALL');

  const handleRunTests = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/tests/run');
      if (res.ok) {
        const data = await res.json();
        setTestResults(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  const filteredList = (testResults?.results || []).filter((r: any) => {
    if (filter === 'PASSED') return r.passed;
    if (filter === 'FAILED') return !r.passed;
    return true;
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header Banner */}
      <div className="bg-[#111114] p-4 rounded-xl border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-zinc-100 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            <span>SECTION 51 — 38 AUTOMATED SYSTEM VERIFICATION TESTS</span>
          </h2>
          <p className="text-zinc-400 font-sans text-xs mt-0.5">
            Full compliance suite testing rate limiting, email enumeration defense, resume storage, concurrency, and idempotent JEMP# sequence allocation.
          </p>
        </div>

        <button
          onClick={handleRunTests}
          disabled={running}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-zinc-950 font-black rounded flex items-center space-x-2 shrink-0 transition-colors shadow-lg"
        >
          {running ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>RUNNING SUITE (38 TESTS)...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>RUN COMPLETE TEST SUITE</span>
            </>
          )}
        </button>
      </div>

      {/* Stats Cards */}
      {testResults && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-[#111114] rounded-lg border border-zinc-800">
            <div className="text-[10px] text-zinc-400 uppercase">Total Tests</div>
            <div className="text-lg font-bold text-zinc-100 mt-1">{testResults.total}</div>
          </div>
          <div className="p-3 bg-[#111114] rounded-lg border border-zinc-800">
            <div className="text-[10px] text-zinc-400 uppercase">Tests Passed</div>
            <div className="text-lg font-bold text-emerald-400 mt-1 flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>{testResults.passed}</span>
            </div>
          </div>
          <div className="p-3 bg-[#111114] rounded-lg border border-zinc-800">
            <div className="text-[10px] text-zinc-400 uppercase">Tests Failed</div>
            <div className={`text-lg font-bold mt-1 flex items-center space-x-1 ${testResults.failed > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
              <XCircle className="w-4 h-4" />
              <span>{testResults.failed}</span>
            </div>
          </div>
          <div className="p-3 bg-[#111114] rounded-lg border border-zinc-800">
            <div className="text-[10px] text-zinc-400 uppercase">Total Execution Time</div>
            <div className="text-lg font-bold text-zinc-100 mt-1 flex items-center space-x-1">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span>{testResults.durationMs} ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Tests Results Table */}
      <div className="bg-[#111114] border border-zinc-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <span className="font-bold text-zinc-200">TEST CASES &amp; ASSERTION LOG</span>

          {testResults && (
            <div className="flex space-x-1">
              {(['ALL', 'PASSED', 'FAILED'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono ${
                    filter === f ? 'bg-zinc-800 text-zinc-100 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {!testResults ? (
          <div className="text-center py-12 space-y-3">
            <ShieldCheck className="w-10 h-10 text-zinc-600 mx-auto" />
            <div className="text-zinc-300 font-bold">Suite Ready to Execute</div>
            <p className="text-zinc-500 max-w-md mx-auto font-sans text-xs">
              Click &quot;RUN COMPLETE TEST SUITE&quot; to execute all 38 automated test cases covering authentication, resume versioning, race conditions, and timeline events.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredList.map((test: any) => (
              <div
                key={test.id}
                className="p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-lg flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start space-x-3">
                  <div className="pt-0.5">
                    {test.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-zinc-400 text-[10px]">#{test.id}</span>
                      <span className="font-bold text-zinc-200">{test.name}</span>
                      <span className="text-[10px] bg-zinc-800 px-1.5 py-0.2 rounded text-zinc-400">
                        {test.category}
                      </span>
                    </div>
                    <div className="text-zinc-400 font-sans text-[11px]">{test.details}</div>
                  </div>
                </div>

                <div className="text-[10px] text-zinc-400 shrink-0 font-mono">
                  {test.durationMs} ms
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
