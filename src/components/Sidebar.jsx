import { useApp } from '../context/AppContext';

const navItems = [
  { view: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
  { view: 'exams', icon: 'description', label: 'Exams' },
  { view: 'results', icon: 'analytics', label: 'Results' },
  { view: 'audit', icon: 'history_edu', label: 'Audit Trail' },
  { view: 'export', icon: 'file_download', label: 'Export' },
];

const bottomItems = [
  { view: 'settings', icon: 'settings', label: 'Settings' },
];

export default function Sidebar() {
  const { currentView, navigate, user, sidebarOpen, setSidebarOpen } = useApp();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav
        className={`
          fixed left-0 top-0 h-full bg-surface-container-lowest border-r border-outline-variant z-40
          flex flex-col transition-transform duration-300 w-64
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* Logo / Header */}
        <div className="flex items-center gap-3 px-4 pt-6 pb-4 border-b border-outline-variant">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-on-primary text-[18px]">psychology</span>
          </div>
          <div>
            <h1 className="text-label-md font-bold text-on-surface leading-tight">SmartCheckAI</h1>
            <p className="text-[11px] text-on-surface-variant">AI Exam Evaluator</p>
          </div>
          <button
            className="ml-auto p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Teacher Panel info */}
        <div className="px-4 py-3 bg-surface-container-low mx-3 mt-3 rounded-lg">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-0.5">Teacher Panel</p>
          <p className="text-body-sm text-on-surface font-medium truncate">{user?.name}</p>
          <p className="text-[11px] text-on-surface-variant truncate">{user?.academicYear}</p>
        </div>

        {/* Create exam CTA */}
        <div className="px-3 mt-3">
          <button
            onClick={() => navigate('create-exam')}
            className="btn-primary w-full justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create New Exam
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-3 mt-4 overflow-y-auto scrollbar-thin">
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider px-2 mb-2">Navigation</p>
          <ul className="flex flex-col gap-0.5">
            {navItems.map(item => (
              <li key={item.view}>
                <button
                  onClick={() => { navigate(item.view); setSidebarOpen(false); }}
                  className={`nav-item w-full text-left ${currentView === item.view ? 'active' : ''}`}
                >
                  <span className={`material-symbols-outlined text-[20px] ${currentView === item.view ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom */}
        <div className="px-3 py-3 border-t border-outline-variant">
          {bottomItems.map(item => (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              className={`nav-item w-full text-left ${currentView === item.view ? 'active' : ''}`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}

          {/* User profile */}
          <div className="flex items-center gap-2 px-2 py-2 mt-2 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-on-primary text-xs font-bold">
                {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-on-surface truncate">{user?.name}</p>
              <p className="text-[10px] text-on-surface-variant truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
