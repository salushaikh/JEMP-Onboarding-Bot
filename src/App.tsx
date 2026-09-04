import React, { useState, useEffect } from 'react';
import {
  Shield,
  Layers,
  Database,
  Terminal,
  Activity,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Sliders,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { DiscordSimulator } from './components/DiscordSimulator.tsx';
import { AdminWhitelist } from './components/AdminWhitelist.tsx';
import { DatabaseInspector } from './components/DatabaseInspector.tsx';
import { ReconciliationPanel } from './components/ReconciliationPanel.tsx';
import { TestSuiteRunner } from './components/TestSuiteRunner.tsx';
import { SlashCommandConsole } from './components/SlashCommandConsole.tsx';
import { DeploymentGuide } from './components/DeploymentGuide.tsx';
import { PermIdSetupModal } from './components/PermIdSetupModal.tsx';
import { Hash, Sparkles } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'simulator' | 'whitelist' | 'database' | 'reconcile' | 'tests' | 'terminal' | 'guide'
  >('simulator');

  const [health, setHealth] = useState<any>(null);
  const [permConfig, setPermConfig] = useState<any>(null);
  const [showPermModal, setShowPermModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchHealth = async () => {
    try {
      const [hRes, pRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/config/perm-id')
      ]);
      if (hRes.ok) {
        setHealth(await hRes.json());
      }
      if (pRes.ok) {
        setPermConfig(await pRes.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, [refreshTrigger]);

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSeedDemo = async () => {
    await fetch('/api/demo/seed', { method: 'POST' });
    triggerRefresh();
  };

  const handleClearDemo = async () => {
    if (!confirm('Clear all demo data from database?')) return;
    await fetch('/api/demo/clear', { method: 'POST' });
    triggerRefresh();
  };

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 font-sans selection:bg-amber-500 selection:text-black">
      {/* Top Philosophical / Brand Header */}
      <header className="border-b border-zinc-800 bg-[#0c0c0f]/90 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          {/* Brand & Philosophy */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center font-black text-amber-500 text-lg shadow-inner">
              ⚔️
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm font-bold tracking-widest text-zinc-100 uppercase">
                  JOBLESS EMPIRE
                </span>
                <span className="text-[10px] font-mono text-amber-500/90 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40 font-bold">
                  JEMP // ONBOARDING &amp; MEMBERSHIP BOT
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                NO JOB. STILL BUILDING. • YOUR WORK SHOULD LEAVE A TRAIL.
              </p>
            </div>
          </div>

          {/* System Status Indicators & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <div className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded flex items-center space-x-1.5 text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>DB: {health?.database?.isConnected ? 'ACTIVE' : 'READY'}</span>
            </div>

            {/* Permanent ID Precedence Button / Indicator */}
            <button
              onClick={() => setShowPermModal(true)}
              title="Click to customize Permanent ID Precedence &amp; Digits"
              className="px-2.5 py-1 bg-amber-950/30 hover:bg-amber-900/40 border border-amber-500/40 rounded flex items-center space-x-1.5 text-amber-300 transition-colors"
            >
              <Hash className="w-3 h-3 text-amber-400" />
              <span className="font-bold">
                {permConfig?.preview || `JEMP#${String(health?.database?.currentJempSequence || 1).padStart(3, '0')}`}
              </span>
              <span className="text-[9px] text-amber-400/80 bg-amber-950 px-1 py-0.2 rounded border border-amber-800/60">
                Setup
              </span>
            </button>

            <button
              onClick={handleSeedDemo}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 hover:text-white transition-colors"
            >
              Seed Demo
            </button>

            <button
              onClick={handleClearDemo}
              className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/50 border border-red-900/60 rounded text-red-300 transition-colors"
            >
              Clear Demo
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex space-x-1 overflow-x-auto border-t border-zinc-800/60 text-xs font-mono">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors flex items-center space-x-2 shrink-0 ${
              activeTab === 'simulator'
                ? 'border-amber-500 text-amber-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <span>💬</span>
            <span>DISCORD BOT SIMULATOR</span>
          </button>

          <button
            onClick={() => setActiveTab('whitelist')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors flex items-center space-x-2 shrink-0 ${
              activeTab === 'whitelist'
                ? 'border-amber-500 text-amber-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>APPROVED WHITELIST (/onboard add)</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors flex items-center space-x-2 shrink-0 ${
              activeTab === 'database'
                ? 'border-amber-500 text-amber-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>SYSTEM OF RECORD (LOCAL DB)</span>
          </button>

          <button
            onClick={() => setActiveTab('reconcile')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors flex items-center space-x-2 shrink-0 ${
              activeTab === 'reconcile'
                ? 'border-amber-500 text-amber-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>RECONCILIATION ENGINE</span>
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors flex items-center space-x-2 shrink-0 ${
              activeTab === 'tests'
                ? 'border-amber-500 text-amber-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>38 AUTOMATED TESTS</span>
          </button>

          <button
            onClick={() => setActiveTab('terminal')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors flex items-center space-x-2 shrink-0 ${
              activeTab === 'terminal'
                ? 'border-amber-500 text-amber-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>SLASH COMMAND TERMINAL</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors flex items-center space-x-2 shrink-0 ${
              activeTab === 'guide'
                ? 'border-amber-500 text-amber-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-300">🚀 BEGINNER SETUP GUIDE</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'simulator' && <DiscordSimulator onRefreshData={triggerRefresh} />}
        {activeTab === 'whitelist' && <AdminWhitelist onRefreshData={triggerRefresh} refreshTrigger={refreshTrigger} />}
        {activeTab === 'database' && <DatabaseInspector onRefreshData={triggerRefresh} refreshTrigger={refreshTrigger} />}
        {activeTab === 'reconcile' && <ReconciliationPanel onRefreshData={triggerRefresh} refreshTrigger={refreshTrigger} />}
        {activeTab === 'tests' && <TestSuiteRunner />}
        {activeTab === 'terminal' && <SlashCommandConsole onRefreshData={triggerRefresh} />}
        {activeTab === 'guide' && <DeploymentGuide />}
      </main>

      {/* Permanent ID Setup Modal */}
      <PermIdSetupModal
        isOpen={showPermModal}
        onClose={() => setShowPermModal(false)}
        onConfigSaved={() => {
          fetchHealth();
          triggerRefresh();
        }}
      />

      {/* Footer (despair.us aesthetic) */}
      <footer className="border-t border-zinc-800/80 mt-12 py-8 bg-[#09090b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
          <div className="flex items-center space-x-2">
            <span>⚔️ JOBLESS EMPIRE</span>
            <span>•</span>
            <span>despair.us</span>
            <span>•</span>
            <span>SHARED SERVICE ARCHITECTURE</span>
          </div>
          <div>
            <span>NO JOB. STILL BUILDING.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
