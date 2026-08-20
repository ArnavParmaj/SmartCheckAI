import { useApp } from '../context/AppContext';

const SEVERITY_CONFIG = {
  success: { bg: 'bg-secondary-fixed', border: 'border-secondary', icon: 'check_circle', iconColor: 'text-secondary', textColor: 'text-secondary' },
  warning: { bg: 'bg-tertiary-fixed/50', border: 'border-tertiary-fixed-dim', icon: 'warning', iconColor: 'text-tertiary-container', textColor: 'text-on-tertiary-fixed-variant' },
  error: { bg: 'bg-error-container', border: 'border-error', icon: 'error', iconColor: 'text-error', textColor: 'text-error' },
  info: { bg: 'bg-primary-fixed/20', border: 'border-primary-fixed', icon: 'info', iconColor: 'text-primary', textColor: 'text-on-surface' },
};

const ACTOR_CONFIG = {
  system: { bg: 'bg-primary-fixed', icon: 'smart_toy', iconColor: 'text-primary' },
  teacher: { bg: 'bg-secondary-fixed', icon: 'person', iconColor: 'text-secondary' },
};

export default function AuditTrailView() {
  const { auditEvents } = useApp();

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      <div>
        <h1 className="text-headline-md font-bold text-on-surface">Audit Trail</h1>
        <p className="text-body-sm text-on-surface-variant">Complete log of AI evaluations, teacher actions, and score changes.</p>
      </div>

      {/* Legend */}
      <div className="card p-4 flex flex-wrap gap-3">
        {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <span className={`material-symbols-outlined text-[16px] ${config.iconColor}`}>{config.icon}</span>
            <span className="capitalize">{key}</span>
          </div>
        ))}
        <div className="ml-auto flex gap-3">
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-primary">smart_toy</span>
            AI System
          </div>
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-secondary">person</span>
            Teacher
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-outline-variant bg-surface-bright">
          <p className="text-label-md font-semibold text-on-surface">{auditEvents.length} events logged</p>
        </div>

        <div className="divide-y divide-outline-variant">
          {auditEvents.map((event, index) => {
            const sev = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.info;
            const actor = ACTOR_CONFIG[event.actorType] || ACTOR_CONFIG.teacher;

            return (
              <div key={event.id} className={`flex gap-4 p-5 ${sev.bg} border-l-4 ${sev.border} hover:brightness-95 transition-all`}>
                {/* Timeline dot */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full ${actor.bg} flex items-center justify-center`}>
                    <span className={`material-symbols-outlined text-[16px] ${actor.iconColor}`}>{actor.icon}</span>
                  </div>
                  {index < auditEvents.length - 1 && <div className="w-0.5 flex-1 bg-outline-variant mt-2" />}
                </div>

                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[18px] ${sev.iconColor}`}>{sev.icon}</span>
                      <p className="text-label-md font-bold text-on-surface">{event.event}</p>
                    </div>
                    <span className="text-[11px] text-on-surface-variant flex-shrink-0">{formatTime(event.timestamp)}</span>
                  </div>

                  <p className="text-body-sm text-on-surface mt-1">{event.detail}</p>

                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">{event.actorType === 'system' ? 'smart_toy' : 'person'}</span>
                      {event.actor}
                    </span>
                    {event.examTitle && (
                      <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">description</span>
                        {event.examTitle}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
