import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getStatusColor } from '../data/mockData';

const STATUSES = ['All', 'Completed', 'Processing', 'Needs Review', 'Draft'];

export default function DashboardView() {
  const { exams, navigate } = useApp();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = (exams || []).filter(e => {
    if (!e) return false;
    const matchStatus = filter === 'All' || e.status === filter;
    const title = (e.title || '').toLowerCase();
    const subject = (e.subject || '').toLowerCase();
    const query = (search || '').toLowerCase();
    const matchSearch = title.includes(query) || subject.includes(query);
    return matchStatus && matchSearch;
  });

  const validExamsWithConfidence = (exams || []).filter(e => e && typeof e.avgConfidence === 'number' && !isNaN(e.avgConfidence) && e.avgConfidence > 0);
  const avgConf = validExamsWithConfidence.length > 0
    ? Math.round(validExamsWithConfidence.reduce((sum, e) => sum + e.avgConfidence, 0) / validExamsWithConfidence.length)
    : 0;

  const stats = {
    total: (exams || []).length,
    pending: (exams || []).reduce((sum, e) => sum + (Number(e?.pendingReview) || 0), 0),
    avgConfidence: avgConf,
    completed: (exams || []).filter(e => e?.status === 'Completed').length,
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface">Dashboard</h1>
          <p className="text-body-sm text-on-surface-variant mt-0.5">Welcome back! Here's an overview of your exams.</p>
        </div>
        <button onClick={() => navigate('create-exam')} className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Create New Exam
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Exams"
          value={stats.total}
          icon="description"
          iconBg="bg-surface-container-low"
          iconColor="text-on-surface"
        />
        <StatCard
          label="Pending Review"
          value={stats.pending}
          icon="pending_actions"
          iconBg="bg-tertiary-fixed"
          iconColor="text-tertiary-container"
          trend={stats.pending > 0 ? `${stats.pending} need attention` : 'All caught up!'}
          trendColor={stats.pending > 0 ? 'text-tertiary-container' : 'text-secondary'}
        />
        <StatCard
          label="Avg AI Confidence"
          value={`${stats.avgConfidence}%`}
          icon="psychology"
          iconBg="bg-primary-fixed"
          iconColor="text-primary"
          trend="Across all exams"
          trendColor="text-on-surface-variant"
        />
        <StatCard
          label="Completed Evaluations"
          value={stats.completed}
          icon="task_alt"
          iconBg="bg-secondary-fixed"
          iconColor="text-secondary"
          trend={`${exams.length - stats.completed} remaining`}
          trendColor="text-on-surface-variant"
        />
      </div>

      {/* Quick Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-primary-fixed rounded-xl">
            <span className="material-symbols-outlined text-primary text-[24px]">school</span>
          </div>
          <div>
            <p className="text-body-sm text-on-surface-variant">Total Students Evaluated</p>
            <p className="text-headline-md font-bold text-on-surface">
              {exams.reduce((sum, e) => sum + e.submissionsEvaluated, 0)}
            </p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-secondary-fixed rounded-xl">
            <span className="material-symbols-outlined text-secondary text-[24px]">trending_up</span>
          </div>
          <div>
            <p className="text-body-sm text-on-surface-variant">Avg Class Score</p>
            <p className="text-headline-md font-bold text-on-surface">
              {Math.round(exams.filter(e => e.avgScore).reduce((sum, e, _, arr) => sum + e.avgScore / arr.length, 0))}%
            </p>
          </div>
        </div>
      </div>

      {/* Exam Table */}
      <div className="card overflow-hidden flex flex-col">
        <div className="p-5 border-b border-outline-variant">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <h2 className="text-headline-md font-semibold text-on-surface">Recent Exams</h2>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* Search */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search exams..."
                  className="input-field pl-8 w-full sm:w-48"
                />
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mt-3 flex-wrap">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  filter === s
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-bright">
                <th className="text-label-sm text-on-surface-variant py-3 px-5 uppercase tracking-wider font-semibold">Exam Name</th>
                <th className="text-label-sm text-on-surface-variant py-3 px-5 uppercase tracking-wider font-semibold">Subject</th>
                <th className="text-label-sm text-on-surface-variant py-3 px-5 uppercase tracking-wider font-semibold">Grade</th>
                <th className="text-label-sm text-on-surface-variant py-3 px-5 uppercase tracking-wider font-semibold">Date</th>
                <th className="text-label-sm text-on-surface-variant py-3 px-5 uppercase tracking-wider font-semibold">Submissions</th>
                <th className="text-label-sm text-on-surface-variant py-3 px-5 uppercase tracking-wider font-semibold">Status</th>
                <th className="text-label-sm text-on-surface-variant py-3 px-5 uppercase tracking-wider font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-on-surface-variant py-12">
                    <span className="material-symbols-outlined text-[48px] text-outline mb-2 block">search_off</span>
                    No exams match your filter.
                  </td>
                </tr>
              ) : filtered.map(exam => (
                <tr key={exam.id} className="table-row group">
                  <td className="py-4 px-5">
                    <p className="text-label-md font-semibold text-on-surface">{exam.title}</p>
                  </td>
                  <td className="py-4 px-5 text-body-sm text-on-surface-variant">{exam.subject}</td>
                  <td className="py-4 px-5 text-body-sm text-on-surface-variant">{exam.grade}</td>
                  <td className="py-4 px-5 text-body-sm text-on-surface-variant">{exam.dateCreated}</td>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-surface-container-high rounded-full max-w-[80px]">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${exam.totalStudents ? (exam.submissionsEvaluated / exam.totalStudents) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-body-sm text-on-surface-variant whitespace-nowrap">
                        {exam.submissionsEvaluated}/{exam.totalStudents}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <span className={getStatusColor(exam.status)}>
                      {exam.status}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-right">
                    <button
                      onClick={() => navigate('exam-detail', { exam })}
                      className="btn-outline text-xs"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, iconBg, iconColor, trend, trendColor }) {
  return (
    <div className="stat-card animate-fadeIn">
      <div className="flex justify-between items-start">
        <p className="text-body-sm text-on-surface-variant">{label}</p>
        <div className={`p-2 ${iconBg} rounded-lg`}>
          <span className={`material-symbols-outlined text-[20px] ${iconColor}`}>{icon}</span>
        </div>
      </div>
      <p className="text-headline-xl font-bold text-on-surface">{value}</p>
      {trend && <p className={`text-[11px] ${trendColor}`}>{trend}</p>}
    </div>
  );
}
