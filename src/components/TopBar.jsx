import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { checkBackendHealth } from '../lib/backendApi';

export default function TopBar() {
  const { user, logout, navigate, isDark, toggleDark, setSidebarOpen } = useApp();
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'connected' | 'disconnected'
  const [backendLatency, setBackendLatency] = useState(null);

  const verifyBackend = async () => {
    setBackendStatus('checking');
    const start = Date.now();
    try {
      const res = await checkBackendHealth();
      if (res?.status === 'ok') {
        setBackendLatency(Date.now() - start);
        setBackendStatus('connected');
      } else {
        setBackendStatus('disconnected');
      }
    } catch {
      setBackendStatus('disconnected');
    }
  };

  useEffect(() => {
    verifyBackend();
    const interval = setInterval(verifyBackend, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const notifications = [
    { id: 1, text: '3 submissions flagged for review in Final Physics Paper', time: '5 min ago', unread: true },
    { id: 2, text: 'AI processing complete for History Quiz #4', time: '1 hour ago', unread: true },
    { id: 3, text: 'Results exported successfully', time: '2 hours ago', unread: false },
  ];

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 h-14 bg-surface-container-lowest border-b border-outline-variant z-30 flex items-center px-4 gap-3 shadow-nav">
      {/* Mobile hamburger */}
      <button
        className="md:hidden p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
      </button>

      {/* Page title breadcrumb area */}
      <div className="flex-1 flex items-center gap-2">
        {/* Live Backend Indicator Badge */}
        <button
          onClick={verifyBackend}
          title="Click to re-check AI Engine connection"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            backendStatus === 'connected'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
              : backendStatus === 'checking'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              backendStatus === 'connected'
                ? 'bg-emerald-500 animate-pulse'
                : backendStatus === 'checking'
                ? 'bg-amber-500 animate-ping'
                : 'bg-rose-500'
            }`}
          />
          <span className="hidden sm:inline font-mono">
            {backendStatus === 'connected'
              ? `AI Engine: Online (${backendLatency}ms)`
              : backendStatus === 'checking'
              ? 'Connecting AI Engine...'
              : 'AI Engine: Offline'}
          </span>
        </button>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-1">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          title={isDark ? 'Light Mode' : 'Dark Mode'}
        >
          <span className="material-symbols-outlined text-[20px]">
            {isDark ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant relative"
            onClick={() => { setShowNotifPanel(v => !v); setShowProfile(false); }}
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />
          </button>

          {showNotifPanel && (
            <div className="absolute right-0 top-12 w-80 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-modal animate-fadeIn z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
                <span className="text-label-md font-semibold text-on-surface">Notifications</span>
                <button onClick={() => setShowNotifPanel(false)} className="text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <div className="divide-y divide-outline-variant max-h-72 overflow-y-auto scrollbar-thin">
                {notifications.map(n => (
                  <div key={n.id} className={`px-4 py-3 hover:bg-surface-container-low transition-colors cursor-pointer ${n.unread ? 'bg-primary-fixed/20' : ''}`}>
                    <p className="text-body-sm text-on-surface leading-snug">{n.text}</p>
                    <p className="text-[11px] text-on-surface-variant mt-1">{n.time}</p>
                    {n.unread && <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full mt-1" />}
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-outline-variant">
                <button className="text-sm text-primary font-medium hover:underline" onClick={() => setShowNotifPanel(false)}>
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            className="flex items-center gap-2 p-1 pl-2 rounded-full hover:bg-surface-container-high transition-colors"
            onClick={() => { setShowProfile(v => !v); setShowNotifPanel(false); }}
          >
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-on-primary text-xs font-bold">
                {(user?.name || user?.email || 'Teacher').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2) || 'T'}
              </span>
            </div>
            <span className="hidden sm:block text-body-sm font-medium text-on-surface max-w-[120px] truncate">
              {(user?.name || user?.email || 'Teacher').split(' ')[0]}
            </span>
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant mr-1">expand_more</span>
          </button>

          {showProfile && (
            <div className="absolute right-0 top-11 w-56 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-modal animate-fadeIn z-50 overflow-hidden">
              <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant">
                <p className="text-label-md font-semibold text-on-surface">{user?.name}</p>
                <p className="text-body-sm text-on-surface-variant">{user?.role}</p>
                <p className="text-[11px] text-on-surface-variant">{user?.school}</p>
              </div>
              <div className="py-1">
                <button 
                  onClick={() => { navigate('settings'); setShowProfile(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-surface-container-low text-body-sm text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">person</span>
                  My Profile
                </button>
                <button 
                  onClick={() => { navigate('settings'); setShowProfile(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-surface-container-low text-body-sm text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">settings</span>
                  Settings
                </button>
                <div className="border-t border-outline-variant my-1" />
                <button
                  onClick={() => { setShowProfile(false); logout(); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-error-container text-body-sm text-error transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {(showNotifPanel || showProfile) && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => { setShowNotifPanel(false); setShowProfile(false); }}
        />
      )}
    </header>
  );
}
