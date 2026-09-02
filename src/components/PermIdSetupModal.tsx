import React, { useState, useEffect } from 'react';
import { Hash, Check, X, Shield, Sparkles, RefreshCw, Sliders } from 'lucide-react';

interface PermIdSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const PermIdSetupModal: React.FC<PermIdSetupModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved
}) => {
  const [prefix, setPrefix] = useState('JEMP');
  const [digitCount, setDigitCount] = useState<number>(3);
  const [currentSequence, setCurrentSequence] = useState<number>(0);
  const [isConfigured, setIsConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config/perm-id');
      if (res.ok) {
        const data = await res.json();
        setPrefix(data.prefix || 'JEMP');
        setDigitCount(data.digitCount || 3);
        setCurrentSequence(data.currentSequence || 0);
        setIsConfigured(Boolean(data.isConfigured));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      setSuccessMsg('');
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const cleanPrefix = (prefix.trim() || 'JEMP').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const nextSeq = currentSequence + 1;
  const previewNext = `${cleanPrefix}#${String(nextSeq).padStart(digitCount, '0')}`;
  const previewSubsequent = `${cleanPrefix}#${String(nextSeq + 1).padStart(digitCount, '0')}`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/config/perm-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: cleanPrefix,
          digitCount,
          currentSequence,
          adminActor: 'admin_setup'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsConfigured(true);
        setSuccessMsg(`Permanent ID precedence saved! Next member will be assigned ${previewNext}.`);
        onConfigSaved();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMsg(data.error || 'Failed to save configuration');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving setup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111114] border border-amber-500/40 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 font-mono text-zinc-200 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-100 p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 border-b border-zinc-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg">
            <Hash className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100 uppercase tracking-wide">
              Permanent ID Precedence Setup
            </h3>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              Configure the brand prefix and sequential number padding for all newly onboarded members.
            </p>
          </div>
        </div>

        {/* Live Visual Preview Card */}
        <div className="bg-[#09090b] border border-amber-500/30 rounded-xl p-4 text-center space-y-2 relative overflow-hidden">
          <div className="text-[10px] uppercase text-zinc-400 tracking-wider">
            Live Preview Format:
          </div>
          <div className="flex items-center justify-center space-x-4">
            <div className="p-3 bg-amber-950/40 border border-amber-600/50 rounded-lg text-amber-300 font-mono text-xl font-black tracking-widest shadow-inner">
              {previewNext}
            </div>
            <div className="text-zinc-600 text-sm">→</div>
            <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 font-mono text-sm tracking-wider">
              {previewSubsequent}
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 font-sans">
            Automatically allocated to each member upon completing rules &amp; safety acknowledgment.
          </p>
        </div>

        {/* Setup Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* Prefix / Precedence */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 block">
              1. ID Precedence / Prefix:
            </label>
            <div className="relative">
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                placeholder="JEMP"
                maxLength={10}
                required
                className="w-full bg-[#09090b] border border-zinc-700 focus:border-amber-500 rounded-lg px-3.5 py-2 text-sm text-amber-300 font-bold tracking-widest uppercase focus:outline-none transition-colors"
              />
              <span className="absolute right-3 top-2.5 text-xs text-zinc-500">
                e.g. JEMP, JOBLESS, EMPIRE
              </span>
            </div>
          </div>

          {/* Number of Digits Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 block">
              2. Consecutive Number Digits (Admin Choice):
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[3, 4, 5].map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setDigitCount(d)}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-colors flex flex-col items-center justify-center space-y-0.5 ${
                    digitCount === d
                      ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-sm'
                      : 'bg-[#09090b] border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span>{d} Digits {d === 3 ? '(Default)' : ''}</span>
                  <span className="text-[10px] text-zinc-500 font-mono font-normal">
                    #{'0'.repeat(d - 1)}1
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Starting / Current Sequence Number */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">
                3. Current Sequence Counter:
              </label>
              <span className="text-[10px] text-zinc-500">
                Next member will be #{String(currentSequence + 1).padStart(digitCount, '0')}
              </span>
            </div>
            <input
              type="number"
              min={0}
              max={99999}
              value={currentSequence}
              onChange={(e) => setCurrentSequence(Math.max(0, parseInt(e.target.value || '0', 10)))}
              className="w-full bg-[#09090b] border border-zinc-700 focus:border-amber-500 rounded-lg px-3.5 py-2 text-xs text-zinc-200 focus:outline-none transition-colors"
            />
          </div>

          {/* Status and Error Messages */}
          {errorMsg && (
            <div className="p-2.5 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-xs">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 bg-emerald-950/50 border border-emerald-800 rounded-lg text-emerald-300 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-bold rounded-lg text-xs tracking-wider uppercase transition-colors shadow-md flex items-center space-x-1.5"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save ID Precedence</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
