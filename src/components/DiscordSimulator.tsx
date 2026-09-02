import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Hash,
  Upload,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Eye,
  Trash2
} from 'lucide-react';

interface DiscordSimulatorProps {
  onRefreshData: () => void;
}

export const DiscordSimulator: React.FC<DiscordSimulatorProps> = ({ onRefreshData }) => {
  const [activeChannel, setActiveChannel] = useState<'verify-me' | 'profile-manager' | 'applications' | 'rules'>('verify-me');
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: string }>({
    id: 'user_alex_mercer',
    name: 'Alex Mercer',
    email: 'demo1@example.invalid',
    role: 'unverified'
  });

  // State for onboarding session
  const [session, setSession] = useState<any>(null);
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailVerificationResult, setEmailVerificationResult] = useState<{ success: boolean; message: string } | null>(null);

  // Resume upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Onboarding wizard states
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<string>('NAME_REQUIRED');
  const [stagedName, setStagedName] = useState('');
  const [stagedTimezone, setStagedTimezone] = useState('America/New_York');
  const [rulesAgreed, setRulesAgreed] = useState(false);
  const [safetyAgreed, setSafetyAgreed] = useState(false);
  const [activationResult, setActivationResult] = useState<any>(null);

  // Ephemeral responses
  const [ephemeralNotice, setEphemeralNotice] = useState<{ title: string; body: string; type?: 'info' | 'success' | 'error' } | null>(null);

  // Applications list for admin channel
  const [applications, setApplications] = useState<any[]>([]);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/onboarding/session/${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        setMember(data.member);
        if (data.member?.name) setStagedName(data.member.name);
        if (data.member?.timezone) setStagedTimezone(data.member.timezone);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/applications');
      if (res.ok) {
        const data = await res.json();
        setApplications(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSession();
    if (activeChannel === 'applications') {
      fetchApplications();
    }
  }, [currentUser.id, activeChannel]);

  // Handle email verification modal submit
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setEmailVerificationResult(null);

    try {
      const res = await fetch('/api/onboarding/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordUserId: currentUser.id,
          email: emailInput
        })
      });

      const data = await res.json();
      if (data.success) {
        setEmailVerificationResult({
          success: true,
          message: '✓ Identity verified against approved applicant registry. You may now upload your resume.'
        });
        setShowEmailModal(false);
        await fetchSession();
        onRefreshData();
      } else {
        setEmailVerificationResult({
          success: false,
          message: data.error || 'Verification failed.'
        });
      }
    } catch (err: any) {
      setEmailVerificationResult({
        success: false,
        message: 'Something went wrong while completing your onboarding. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Resume File Upload
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const res = await fetch('/api/onboarding/upload-resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            discordUserId: currentUser.id,
            filename: file.name,
            mimeType: file.type || 'application/pdf',
            base64Data: base64
          })
        });

        const data = await res.json();
        if (data.success) {
          setEphemeralNotice({
            title: 'RESUME STORED SECURELY',
            body: `✓ Version ${data.resume.version} saved (${data.resume.filename}). SHA-256 hash: ${data.resume.sha256Hash.substring(0, 16)}...`,
            type: 'success'
          });
          await fetchSession();
          onRefreshData();
          // Open the onboarding wizard
          setShowWizard(true);
          setWizardStep('NAME_REQUIRED');
        } else {
          setUploadError(data.error || 'Failed to upload resume.');
        }
      } catch (err: any) {
        setUploadError('Failed to upload file to storage service.');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Complete Onboarding Steps
  const handleStepSubmit = async (step: string, payload: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/complete-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordUserId: currentUser.id,
          step,
          data: payload
        })
      });
      const data = await res.json();
      if (data.success) {
        setWizardStep(data.nextStep);
        await fetchSession();
        onRefreshData();
      } else {
        alert(data.error || 'Error completing step');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Final Activation
  const handleFinalActivation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordUserId: currentUser.id })
      });
      const data = await res.json();
      if (data.success) {
        setActivationResult(data);
        setShowWizard(false);
        await fetchSession();
        onRefreshData();
      } else {
        alert(data.error || 'Activation failed');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isEmailVerified = session && session.currentStep !== 'EMAIL_REQUIRED';
  const isMemberActive = member && member.membershipStatus === 'ACTIVE';

  return (
    <div className="flex flex-col lg:flex-row h-[740px] bg-[#0c0c0e] rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
      {/* Discord Left Channel Sidebar */}
      <div className="w-full lg:w-64 bg-[#111114] border-r border-zinc-800 flex flex-col justify-between">
        <div>
          {/* Server Header */}
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-md bg-zinc-900 border border-zinc-700 flex items-center justify-center font-serif font-black text-amber-500">
                ⚔️
              </div>
              <div>
                <div className="text-xs font-bold tracking-wider text-zinc-100 uppercase font-mono">JOBLESS EMPIRE</div>
                <div className="text-[10px] text-zinc-400 font-mono">Official Onboarding Gateway</div>
              </div>
            </div>
          </div>

          {/* User Switcher Persona */}
          <div className="p-3 border-b border-zinc-800 bg-[#09090b]/50">
            <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1.5">Active Persona</label>
            <select
              className="w-full text-xs font-mono bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-amber-500"
              value={currentUser.id}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'user_alex_mercer') {
                  setCurrentUser({ id: 'user_alex_mercer', name: 'Alex Mercer', email: 'demo1@example.invalid', role: 'unverified' });
                  setEmailInput('demo1@example.invalid');
                } else if (val === 'user_samantha') {
                  setCurrentUser({ id: 'user_samantha', name: 'Samantha Vance', email: 'demo2@example.invalid', role: 'unverified' });
                  setEmailInput('demo2@example.invalid');
                } else if (val === 'discord_demo_active_user') {
                  setCurrentUser({ id: 'discord_demo_active_user', name: 'Elena Rostova', email: 'founder@example.invalid', role: 'member' });
                  setEmailInput('founder@example.invalid');
                } else {
                  setCurrentUser({ id: 'user_guest_unregistered', name: 'Random Guest', email: 'stranger@gmail.com', role: 'guest' });
                  setEmailInput('stranger@gmail.com');
                }
                setActivationResult(null);
                setEphemeralNotice(null);
              }}
            >
              <option value="user_alex_mercer">Alex Mercer (Approved: APP#DEMO-001)</option>
              <option value="user_samantha">Samantha Vance (Approved: APP#DEMO-002)</option>
              <option value="discord_demo_active_user">Elena Rostova (Active Member JEMP#001)</option>
              <option value="user_guest_unregistered">Unregistered Guest (Stranger)</option>
            </select>
          </div>

          {/* Channels List */}
          <div className="p-2 space-y-1">
            <div className="px-2 pt-2 text-[10px] font-mono uppercase tracking-wider text-zinc-400">Gateway Channels</div>
            
            <button
              onClick={() => setActiveChannel('verify-me')}
              className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded text-xs font-mono text-left transition-colors ${
                activeChannel === 'verify-me' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              <span className="text-zinc-400">#</span>
              <span>verify-me</span>
              {!isMemberActive && (
                <span className="ml-auto w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveChannel('profile-manager')}
              className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded text-xs font-mono text-left transition-colors ${
                activeChannel === 'profile-manager' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              <span className="text-zinc-400">#</span>
              <span>profile-manager</span>
              {isMemberActive && (
                <span className="ml-auto text-[10px] text-amber-400 font-mono">ACTIVE</span>
              )}
            </button>

            <div className="px-2 pt-4 text-[10px] font-mono uppercase tracking-wider text-zinc-400">Admin Channels</div>

            <button
              onClick={() => setActiveChannel('applications')}
              className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded text-xs font-mono text-left transition-colors ${
                activeChannel === 'applications' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              <span className="text-zinc-400">#</span>
              <span>applications</span>
              <span className="ml-auto text-[9px] bg-red-950/80 text-red-300 px-1.5 py-0.5 rounded border border-red-800/60 font-mono">ADMIN</span>
            </button>

            <div className="px-2 pt-4 text-[10px] font-mono uppercase tracking-wider text-zinc-400">Community</div>

            <button
              onClick={() => setActiveChannel('rules')}
              className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded text-xs font-mono text-left transition-colors ${
                activeChannel === 'rules' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              <span className="text-zinc-400">#</span>
              <span>rules</span>
            </button>
          </div>
        </div>

        {/* Current Discord User Bar */}
        <div className="p-3 bg-[#09090b] border-t border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs text-zinc-300 font-mono">
              {currentUser.name[0]}
            </div>
            <div className="truncate">
              <div className="text-xs font-medium text-zinc-200 truncate">{currentUser.name}</div>
              <div className="text-[10px] text-zinc-400 font-mono truncate">
                {isMemberActive ? member?.jempId : '@Unverified'}
              </div>
            </div>
          </div>
          <button
            onClick={fetchSession}
            title="Refresh Session"
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Discord Chat Area */}
      <div className="flex-1 flex flex-col bg-[#0f0f12] overflow-y-auto">
        {/* Channel Header Bar */}
        <div className="h-12 border-b border-zinc-800 px-4 flex items-center justify-between bg-[#111114]/80 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <span className="text-zinc-400 font-mono text-base">#</span>
            <span className="text-sm font-bold text-zinc-200 font-mono">{activeChannel}</span>
            <span className="text-xs text-zinc-400 font-mono ml-2 hidden sm:inline">
              {activeChannel === 'verify-me' && '— Single persistent verification gateway for new applicants.'}
              {activeChannel === 'profile-manager' && '— Private identity, resume management, and proof-of-work status.'}
              {activeChannel === 'applications' && '— Administrator whitelist stream & vetting decisions.'}
              {activeChannel === 'rules' && '— Community standards, integrity protocols & safety agreements.'}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[11px] font-mono text-zinc-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />
            <span>JEMP BOT ONLINE</span>
          </div>
        </div>

        {/* Channel Content */}
        <div className="flex-1 p-4 lg:p-6 space-y-6">

          {/* CHANNEL 1: #verify-me */}
          {activeChannel === 'verify-me' && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Persistent Bot Message Envelope */}
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center font-bold text-amber-500 shrink-0">
                  ⚔️
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-zinc-100 font-mono">Jobless Empire Bot</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-mono font-semibold">BOT</span>
                    <span className="text-[10px] text-zinc-400 font-mono">Persistent Card</span>
                  </div>

                  {/* EMBED CARD: #verify-me (As specified in Section 6 & 39) */}
                  <div className="bg-[#141418] border-l-4 border-amber-600 rounded-r-lg p-5 border border-zinc-800 space-y-4 shadow-xl">
                    <div className="text-sm font-bold tracking-widest text-zinc-100 uppercase font-mono flex items-center space-x-2">
                      <span>⚔️ JOBLESS EMPIRE</span>
                    </div>

                    <div className="text-xs font-semibold text-zinc-300 font-mono tracking-wider">
                      VERIFY YOUR IDENTITY
                    </div>

                    <div className="text-xs text-zinc-300 leading-relaxed font-sans space-y-2">
                      <p>
                        Before entering the Empire, verify the email address used during your application.
                      </p>
                      <p>
                        Your email will be securely checked against the approved applicant registry.
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 flex flex-wrap gap-2.5">
                      <button
                        onClick={() => {
                          setShowEmailModal(true);
                          setEmailVerificationResult(null);
                        }}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-mono font-medium rounded transition-colors flex items-center space-x-2 border border-zinc-700"
                      >
                        <span>🔐</span>
                        <span>VERIFY EMAIL</span>
                      </button>

                      <button
                        onClick={() => {
                          setEphemeralNotice({
                            title: 'HOW IT WORKS',
                            body: '1. Submit application at despair.us\n2. Admin approves application and whitelists email\n3. Join Discord as @Unverified\n4. Verify application email in #verify-me\n5. Upload verified resume (PDF/DOC/DOCX)\n6. Complete community rules & timezone\n7. Receive permanent sequential JEMP# identifier\n8. Synchronized with @Member role',
                            type: 'info'
                          });
                        }}
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-mono rounded transition-colors border border-zinc-800"
                      >
                        <span>ℹ️</span>
                        <span>HOW IT WORKS</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-zinc-800/80 text-[10px] text-zinc-400 font-mono flex items-center justify-between">
                      <span>No job. Still building.</span>
                      <span className="text-zinc-400">despair.us</span>
                    </div>
                  </div>

                  {/* CRITICAL RULE: Resume upload MUST NOT appear before successful email verification! */}
                  {isEmailVerified && (
                    <div className="bg-[#141418] border-l-4 border-emerald-500 rounded-r-lg p-5 border border-zinc-800 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>✓ EMAIL VERIFIED</span>
                      </div>

                      <div className="text-xs text-zinc-300 leading-relaxed space-y-1">
                        <p className="font-semibold text-zinc-200">Your application has been verified against the registry.</p>
                        <p className="text-zinc-400">
                          Next step: Upload your current resume to complete your Jobless Empire profile. Your resume remains private.
                        </p>
                      </div>

                      {/* Dropzone / Upload area */}
                      <div className="border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg p-4 text-center transition-colors bg-zinc-900/40">
                        <input
                          type="file"
                          id="resume-upload"
                          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(e.target.files[0]);
                            }
                          }}
                        />
                        <label htmlFor="resume-upload" className="cursor-pointer block space-y-2">
                          <Upload className="w-6 h-6 text-zinc-400 mx-auto" />
                          <div className="text-xs font-mono text-zinc-200">
                            {isUploading ? 'Validating & Hashing SHA-256...' : 'Click to select or drag & drop resume'}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono">
                            Allowed: PDF, DOC, DOCX • Max 10MB • SHA-256 verified
                          </div>
                        </label>
                      </div>

                      {uploadError && (
                        <div className="text-xs text-red-400 font-mono bg-red-950/30 border border-red-900/50 p-2 rounded">
                          {uploadError}
                        </div>
                      )}

                      {/* If resume is uploaded, continue button */}
                      {member?.currentResumeId && (
                        <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
                          <span className="text-xs font-mono text-zinc-400">Resume uploaded &amp; stored.</span>
                          <button
                            onClick={() => {
                              setShowWizard(true);
                              setWizardStep('NAME_REQUIRED');
                            }}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-zinc-900 font-mono text-xs font-bold rounded transition-colors flex items-center space-x-1.5"
                          >
                            <span>COMPLETE ONBOARDING</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Activated Welcome Card (Section 41) */}
                  {isMemberActive && (
                    <div className="bg-[#141418] border-l-4 border-amber-400 rounded-r-lg p-5 border border-zinc-800 space-y-4 animate-in fade-in duration-300">
                      <div className="text-sm font-bold tracking-widest text-amber-400 font-mono flex items-center space-x-2">
                        <span>⚔️ WELCOME TO THE EMPIRE</span>
                      </div>

                      <div className="text-xs font-mono text-zinc-300 space-y-1">
                        <div className="text-zinc-400">IDENTITY VERIFIED</div>
                        <div className="text-lg font-black text-zinc-100 font-mono tracking-wider">{member.jempId}</div>
                        <div className="text-emerald-400 font-semibold">STATUS: ACTIVE</div>
                      </div>

                      <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                        Your profile is ready. Your work starts here. Leave your trail.
                      </p>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setActiveChannel('profile-manager')}
                          className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-mono rounded border border-zinc-700"
                        >
                          🪪 VIEW PROFILE
                        </button>
                        <button
                          onClick={() => setActiveChannel('rules')}
                          className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-mono rounded border border-zinc-800"
                        >
                          🧭 EXPLORE THE EMPIRE
                        </button>
                      </div>

                      <div className="pt-2 border-t border-zinc-800 text-[10px] text-zinc-400 font-mono">
                        No job. Still building. • despair.us
                      </div>
                    </div>
                  )}

                  {/* Ephemeral Notice Display */}
                  {ephemeralNotice && (
                    <div className="bg-zinc-900/90 border border-zinc-700/80 rounded p-4 text-xs font-mono space-y-2 relative">
                      <div className="flex items-center justify-between text-zinc-200 font-bold border-b border-zinc-800 pb-1">
                        <span>{ephemeralNotice.title}</span>
                        <span className="text-[10px] text-zinc-400 font-normal">Only you can see this • Ephemeral</span>
                      </div>
                      <pre className="text-zinc-300 whitespace-pre-wrap font-sans text-xs">{ephemeralNotice.body}</pre>
                      <button
                        onClick={() => setEphemeralNotice(null)}
                        className="text-[10px] text-zinc-400 hover:text-zinc-200 underline pt-1 block"
                      >
                        Dismiss message
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CHANNEL 2: #profile-manager */}
          {activeChannel === 'profile-manager' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center font-bold text-amber-500 shrink-0">
                  ⚔️
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-zinc-100 font-mono">Jobless Empire Bot</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-mono font-semibold">BOT</span>
                    <span className="text-[10px] text-zinc-400 font-mono">Persistent Member Card</span>
                  </div>

                  {/* Section 20 Profile Manager Card */}
                  <div className="bg-[#141418] border-l-4 border-zinc-600 rounded-r-lg p-5 border border-zinc-800 space-y-4 shadow-xl">
                    <div className="text-sm font-bold tracking-widest text-zinc-100 font-mono uppercase">
                      ⚔️ YOUR JOBLESS EMPIRE PROFILE
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-900/60 rounded border border-zinc-800 font-mono text-xs">
                      <div>
                        <div className="text-[10px] text-zinc-400">JEMP IDENTIFIER</div>
                        <div className="font-bold text-amber-400 text-sm">{member?.jempId || 'Not Assigned'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-400">STATUS</div>
                        <div className={`font-bold ${member?.membershipStatus === 'ACTIVE' ? 'text-emerald-400' : 'text-zinc-300'}`}>
                          {member?.membershipStatus || 'UNVERIFIED'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-400">PRIMARY TIMEZONE</div>
                        <div className="text-zinc-300">{member?.timezone || 'Not set'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-400">CURRENT RESUME</div>
                        <div className="text-zinc-300">{member?.currentResumeId ? 'v1 • Current' : 'None active'}</div>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-400 font-mono">
                      Sensitive member and resume references are delivered ephemerally.
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        onClick={() => {
                          if (!member) {
                            setEphemeralNotice({
                              title: 'PROFILE ERROR',
                              body: 'No active profile found. Verify your email in #verify-me first.',
                              type: 'error'
                            });
                            return;
                          }
                          setEphemeralNotice({
                            title: `MEMBER IDENTITY: ${member.jempId || 'ONBOARDING'}`,
                            body: `Name: ${member.name}\nJEMP#: ${member.jempId || 'Pending'}\nStatus: ${member.membershipStatus}\nTimezone: ${member.timezone || 'Not set'}\nApplication Reference: ${member.applicationId}\nRules Accepted: ${member.rulesVersionAccepted || 'Pending'}`,
                            type: 'info'
                          });
                        }}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded border border-zinc-700"
                      >
                        🪪 VIEW PROFILE
                      </button>

                      <button
                        onClick={() => {
                          const input = document.getElementById('update-resume-input');
                          input?.click();
                        }}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded border border-zinc-700"
                      >
                        📄 UPDATE RESUME
                      </button>
                      <input
                        type="file"
                        id="update-resume-input"
                        className="hidden"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload(e.target.files[0]);
                          }
                        }}
                      />

                      <button
                        onClick={async () => {
                          if (!member) return;
                          const res = await fetch(`/api/members/${member.id}`);
                          if (res.ok) {
                            const data = await res.json();
                            const historyText = data.resumeHistory
                              ?.map((h: any) => `• v${h.version} [${h.status}] - ${h.filename} (Uploaded: ${new Date(h.uploadedAt).toLocaleDateString()})`)
                              .join('\n') || 'No versions found.';
                            setEphemeralNotice({
                              title: 'RESUME REVISION HISTORY',
                              body: historyText,
                              type: 'info'
                            });
                          }
                        }}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded border border-zinc-700"
                      >
                        🗂️ RESUME HISTORY
                      </button>

                      <button
                        onClick={async () => {
                          if (!confirm('Are you sure you want to remove your active resume? It will be archived and removed from your active profile.')) return;
                          const res = await fetch('/api/onboarding/remove-resume', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ discordUserId: currentUser.id })
                          });
                          const data = await res.json();
                          if (data.success) {
                            setEphemeralNotice({
                              title: 'RESUME REMOVED',
                              body: `✓ Active resume (v${data.removedVersion}) has been archived and removed from your profile.`,
                              type: 'info'
                            });
                            await fetchSession();
                            onRefreshData();
                          } else {
                            alert(data.error || 'Failed to remove resume');
                          }
                        }}
                        className="px-3 py-1.5 bg-red-950/50 hover:bg-red-900/60 text-red-300 text-xs font-mono rounded border border-red-900/60"
                      >
                        🗑️ REMOVE RESUME
                      </button>
                    </div>

                    <div className="pt-2 border-t border-zinc-800/80 text-[10px] text-zinc-400 font-mono">
                      No job. Still building. • despair.us
                    </div>
                  </div>

                  {ephemeralNotice && (
                    <div className="bg-zinc-900 border border-zinc-700 rounded p-4 text-xs font-mono space-y-2">
                      <div className="flex items-center justify-between text-zinc-200 font-bold border-b border-zinc-800 pb-1">
                        <span>{ephemeralNotice.title}</span>
                        <span className="text-[10px] text-zinc-400 font-normal">Ephemeral response</span>
                      </div>
                      <pre className="text-zinc-300 whitespace-pre-wrap font-sans text-xs">{ephemeralNotice.body}</pre>
                      <button onClick={() => setEphemeralNotice(null)} className="text-[10px] text-zinc-400 hover:text-zinc-200 underline pt-1 block">
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CHANNEL 3: #applications (Admin Channel) */}
          {activeChannel === 'applications' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="p-3 bg-red-950/20 border border-red-900/40 rounded text-xs font-mono text-red-300 flex items-center justify-between">
                <span>🛡️ Restricted Admin Channel: Member applications &amp; whitelist status</span>
                <button onClick={fetchApplications} className="flex items-center space-x-1 hover:text-white">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="space-y-4">
                {applications.map((app) => (
                  <div key={app.id} className="bg-[#141418] border border-zinc-800 rounded-lg p-4 space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className="font-bold text-zinc-100">{app.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          app.status === 'APPROVED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : app.status === 'REVOKED'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-zinc-300">
                      <div>
                        <div className="text-[10px] text-zinc-400">APPLICANT</div>
                        <div>{app.applicantName}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-400">EMAIL (MASKED)</div>
                        <div>{app.email ? app.email.replace(/(.{1})(.*)(@.*)/, '$1***$3') : '***@***'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-400">NOTES</div>
                        <div className="truncate">{app.notes || 'None'}</div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-zinc-800">
                      {app.status === 'APPROVED' ? (
                        <button
                          onClick={async () => {
                            if (!confirm(`Revoke approval for application ${app.id}?`)) return;
                            await fetch(`/api/applications/${app.id}/revoke`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ reason: 'Admin revoked via Discord card' })
                            });
                            fetchApplications();
                            onRefreshData();
                          }}
                          className="px-3 py-1 bg-red-950/60 hover:bg-red-900/80 text-red-300 text-xs rounded border border-red-800"
                        >
                          REVOKE
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            await fetch(`/api/applications/${app.id}/restore`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({})
                            });
                            fetchApplications();
                            onRefreshData();
                          }}
                          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded border border-zinc-700"
                        >
                          RESTORE
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CHANNEL 4: #rules */}
          {activeChannel === 'rules' && (
            <div className="max-w-2xl mx-auto space-y-4 font-mono text-xs text-zinc-300 bg-[#141418] p-6 rounded-lg border border-zinc-800">
              <div className="text-sm font-bold text-zinc-100 uppercase tracking-widest border-b border-zinc-800 pb-2">
                ⚔️ JOBLESS EMPIRE — COMMUNITY &amp; SAFETY RULES v1.0
              </div>

              <div className="space-y-4 pt-2 text-zinc-300 font-sans leading-relaxed">
                <div>
                  <div className="font-bold text-zinc-100 font-mono text-xs">RULE 1 — PROOF OF WORK</div>
                  <p className="text-xs text-zinc-400">All member contributions and project milestones must leave an auditable, verifiable trail on the canonical Timeline.</p>
                </div>

                <div>
                  <div className="font-bold text-zinc-100 font-mono text-xs">RULE 2 — CONFIDENTIALITY &amp; CLIENT PRIVACY</div>
                  <p className="text-xs text-zinc-400">Client details, repository contents, and financial interactions are strictly confidential. Unauthorized disclosure is grounds for immediate termination.</p>
                </div>

                <div>
                  <div className="font-bold text-zinc-100 font-mono text-xs">RULE 3 — TRUTH IN EVIDENCE</div>
                  <p className="text-xs text-zinc-400">Financial receipts, code commits, and project claims must be completely truthful. Forged credentials or deceptive proof-of-work are prohibited.</p>
                </div>

                <div>
                  <div className="font-bold text-zinc-100 font-mono text-xs">RULE 4 — NO GUARANTEES</div>
                  <p className="text-xs text-zinc-400">Participation does not guarantee work, client contracts, or specific income. You build what you earn.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL 1: Email Verification Modal (Section 7) */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#141418] border border-zinc-700 rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="text-sm font-bold text-zinc-100 font-mono uppercase">
                Jobless Empire Identity Verification
              </div>
              <button onClick={() => setShowEmailModal(false)} className="text-zinc-400 hover:text-zinc-200 text-lg">
                ×
              </button>
            </div>

            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div>
                <label className="text-xs font-mono text-zinc-300 block mb-1">
                  Email used for your Jobless Empire application
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@domain.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                />
                <div className="text-[10px] text-zinc-400 font-mono mt-1">
                  Private check against whitelist. Rate-limited to prevent enumeration.
                </div>
              </div>

              {emailVerificationResult && !emailVerificationResult.success && (
                <div className="p-3 bg-red-950/40 border border-red-900/60 rounded text-xs text-red-300 font-sans leading-relaxed">
                  {emailVerificationResult.message}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-zinc-950 font-mono text-xs font-bold rounded flex items-center space-x-1"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Submit Verification</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Formal Onboarding Wizard (Section 24) */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#141418] border border-zinc-700 rounded-xl p-6 w-full max-w-lg space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <div className="text-sm font-bold text-zinc-100 font-mono uppercase">
                  Formal Empire Onboarding
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">Step: {wizardStep}</div>
              </div>
              <button onClick={() => setShowWizard(false)} className="text-zinc-400 hover:text-zinc-200 text-lg">
                ×
              </button>
            </div>

            {/* STEP 1: Name */}
            {wizardStep === 'NAME_REQUIRED' && (
              <div className="space-y-4">
                <p className="text-xs text-zinc-300">
                  What name would you like Jobless Empire to associate with your member profile and proof-of-work records?
                </p>
                <input
                  type="text"
                  value={stagedName}
                  onChange={(e) => setStagedName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                  placeholder="Your full or preferred builder name"
                />
                <button
                  onClick={() => handleStepSubmit('NAME_REQUIRED', { name: stagedName })}
                  disabled={!stagedName.trim() || loading}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-zinc-950 font-mono text-xs font-bold rounded"
                >
                  Confirm Name &amp; Continue
                </button>
              </div>
            )}

            {/* STEP 2: Timezone */}
            {wizardStep === 'TIMEZONE_REQUIRED' && (
              <div className="space-y-4">
                <p className="text-xs text-zinc-300">
                  Select your primary IANA timezone for team synchronization and project coordination:
                </p>
                <select
                  value={stagedTimezone}
                  onChange={(e) => setStagedTimezone(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="America/New_York">America/New_York (UTC-5)</option>
                  <option value="America/Chicago">America/Chicago (UTC-6)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                  <option value="Europe/London">Europe/London (UTC+0)</option>
                  <option value="Europe/Berlin">Europe/Berlin (UTC+1)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
                  <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                  <option value="Australia/Sydney">Australia/Sydney (UTC+11)</option>
                </select>
                <button
                  onClick={() => handleStepSubmit('TIMEZONE_REQUIRED', { timezone: stagedTimezone })}
                  disabled={loading}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-zinc-950 font-mono text-xs font-bold rounded"
                >
                  Set Timezone &amp; Continue
                </button>
              </div>
            )}

            {/* STEP 3: Rules */}
            {wizardStep === 'RULES_REQUIRED' && (
              <div className="space-y-4">
                <p className="text-xs text-zinc-300">
                  Before entering the Empire, confirm that you have read and agree to the community rules and code of conduct:
                </p>
                <div className="p-3 bg-zinc-900/80 rounded border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                  <div>✓ Honest proof-of-work documentation</div>
                  <div>✓ Strict confidentiality of client and peer data</div>
                  <div>✓ No unauthorized side deals or malicious activity</div>
                </div>
                <label className="flex items-center space-x-2 text-xs text-zinc-300 font-mono cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rulesAgreed}
                    onChange={(e) => setRulesAgreed(e.target.checked)}
                    className="rounded border-zinc-700 text-amber-600 focus:ring-0"
                  />
                  <span>I have read, understood, and agree to Community Rules v1.0</span>
                </label>
                <button
                  onClick={() => handleStepSubmit('RULES_REQUIRED', { rulesAccepted: rulesAgreed })}
                  disabled={!rulesAgreed || loading}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-zinc-950 font-mono text-xs font-bold rounded"
                >
                  Confirm &amp; Proceed
                </button>
              </div>
            )}

            {/* STEP 4: Safety */}
            {wizardStep === 'SAFETY_REQUIRED' && (
              <div className="space-y-4">
                <p className="text-xs text-zinc-300">
                  Acknowledge security, privacy, and truth-in-work standards:
                </p>
                <div className="p-3 bg-zinc-900/80 rounded border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                  <div>• Client information is strictly private</div>
                  <div>• Credentials must never be shared</div>
                  <div>• Participation does not guarantee work or income</div>
                </div>
                <label className="flex items-center space-x-2 text-xs text-zinc-300 font-mono cursor-pointer">
                  <input
                    type="checkbox"
                    checked={safetyAgreed}
                    onChange={(e) => setSafetyAgreed(e.target.checked)}
                    className="rounded border-zinc-700 text-amber-600 focus:ring-0"
                  />
                  <span>I acknowledge and accept the safety obligations</span>
                </label>
                <button
                  onClick={() => handleStepSubmit('SAFETY_REQUIRED', { safetyAcknowledged: safetyAgreed })}
                  disabled={!safetyAgreed || loading}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-zinc-950 font-mono text-xs font-bold rounded"
                >
                  Confirm Safety &amp; Continue
                </button>
              </div>
            )}

            {/* STEP 5 & 6: JEMP# Assignment & Activation */}
            {(wizardStep === 'JEMP_CONFIRMATION' || wizardStep === 'ACTIVATION_PENDING') && (
              <div className="space-y-4">
                <div className="text-center py-4 space-y-2">
                  <div className="text-2xl">⚔️</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono">
                    PERMANENT JEMP# IDENTITY
                  </div>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Your JEMP# is your permanent Jobless Empire member identity and proof-of-work reference across all bots.
                  </p>
                </div>

                <button
                  onClick={handleFinalActivation}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-zinc-950 font-mono text-xs font-black tracking-wider uppercase rounded shadow-lg"
                >
                  {loading ? 'ALLOCATING JEMP# &amp; ACTIVATING...' : 'ACTIVATE MEMBERSHIP'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
