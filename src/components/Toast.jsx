import { useApp } from '../context/AppContext';

export default function Toast() {
  const { notification } = useApp();
  if (!notification) return null;

  const config = {
    success: { bg: 'bg-secondary-fixed border-secondary', icon: 'check_circle', iconColor: 'text-secondary', textColor: 'text-secondary' },
    info: { bg: 'bg-primary-fixed border-primary-fixed-dim', icon: 'info', iconColor: 'text-primary', textColor: 'text-on-surface' },
    warning: { bg: 'bg-tertiary-fixed border-tertiary-fixed-dim', icon: 'warning', iconColor: 'text-tertiary-container', textColor: 'text-on-surface' },
    error: { bg: 'bg-error-container border-error', icon: 'error', iconColor: 'text-error', textColor: 'text-error' },
  }[notification.type] || { bg: 'bg-surface-container border-outline-variant', icon: 'info', iconColor: 'text-primary', textColor: 'text-on-surface' };

  return (
    <div className={`fixed bottom-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-modal animate-fadeIn max-w-xs ${config.bg}`}>
      <span className={`material-symbols-outlined text-[20px] ${config.iconColor}`}>{config.icon}</span>
      <p className={`text-body-sm font-medium ${config.textColor}`}>{notification.message}</p>
    </div>
  );
}
