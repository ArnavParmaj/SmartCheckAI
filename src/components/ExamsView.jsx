import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { mockStudentSubmissions, getStatusColor, getConfidenceClass, getConfidenceLabel } from '../data/mockData';

export default function ExamsView() {
  const { exams, navigate, deleteExam } = useApp();
  const [search, setSearch] = useState('');

  const filtered = (exams || []).filter(e => {
    if (!e) return false;
    const title = (e.title || '').toLowerCase();
    const subject = (e.subject || '').toLowerCase();
    const query = (search || '').toLowerCase();
    return title.includes(query) || subject.includes(query);
  });

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-headline-md font-bold text-on-surface">All Exams</h1>
          <p className="text-body-sm text-on-surface-variant">{exams.length} exams total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input-field pl-8 w-52" />
          </div>
          <button onClick={() => navigate('create-exam')} className="btn-primary">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(exam => {
          const examSubs = mockStudentSubmissions.filter(s => s.examId === exam.id);
          return (
            <div key={exam.id} className="card p-5 flex flex-col gap-4 hover:shadow-modal transition-shadow duration-200 cursor-pointer" onClick={() => navigate('exam-detail', { exam })}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className="text-label-md font-bold text-on-surface">{exam.title}</h3>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">{exam.subject} · {exam.grade}</p>
                </div>
                <span className={getStatusColor(exam.status)}>{exam.status}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-surface-container-low rounded-lg py-2">
                  <p className="text-headline-md font-bold text-on-surface">{exam.totalStudents}</p>
                  <p className="text-[11px] text-on-surface-variant">Students</p>
                </div>
                <div className="bg-surface-container-low rounded-lg py-2">
                  <p className="text-headline-md font-bold text-on-surface">{exam.avgScore ? `${exam.avgScore}%` : '—'}</p>
                  <p className="text-[11px] text-on-surface-variant">Avg Score</p>
                </div>
                <div className="bg-surface-container-low rounded-lg py-2">
                  <p className={`text-headline-md font-bold ${exam.pendingReview > 0 ? 'text-tertiary-container' : 'text-secondary'}`}>
                    {exam.pendingReview}
                  </p>
                  <p className="text-[11px] text-on-surface-variant">Pending</p>
                </div>
              </div>

              {exam.avgConfidence && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-on-surface-variant">AI Confidence:</span>
                  <span className={getConfidenceClass(exam.avgConfidence)}>{exam.avgConfidence}% — {getConfidenceLabel(exam.avgConfidence)}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
                <span className="text-[11px] text-on-surface-variant">{exam.dateCreated}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to delete "${exam.title}"?`)) {
                        deleteExam(exam.id);
                      }
                    }}
                    className="p-1 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container transition-colors"
                    title="Delete Exam"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); navigate('exam-detail', { exam }); }}
                    className="btn-outline text-xs"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
