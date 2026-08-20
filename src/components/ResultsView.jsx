import { useApp } from '../context/AppContext';

export default function ResultsView() {
  const { exams, navigate } = useApp();
  const completedExams = exams.filter(e => e.avgScore !== null && e.avgScore !== undefined);

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div>
        <h1 className="text-headline-md font-bold text-on-surface">Evaluation Results</h1>
        <p className="text-body-sm text-on-surface-variant">Overview of all completed exam evaluations.</p>
      </div>

      {completedExams.map(exam => (
        <div key={exam.id} className="card p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-label-md font-bold text-on-surface">{exam.title}</h3>
              <p className="text-body-sm text-on-surface-variant">{exam.subject} · {exam.grade}</p>
            </div>
            <button onClick={() => navigate('exam-detail', { exam })} className="btn-outline text-xs">Details</button>
          </div>

          {/* Score distribution bar */}
          <div className="mb-3">
            <div className="flex justify-between mb-1">
              <span className="text-[11px] text-on-surface-variant">Score Distribution</span>
              <span className="text-[11px] text-on-surface-variant">Avg: {exam.avgScore}%</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              <div className="bg-secondary h-full rounded-l-full transition-all" style={{ width: '30%' }} title="90-100%" />
              <div className="bg-secondary-fixed-dim h-full transition-all" style={{ width: '35%' }} title="75-89%" />
              <div className="bg-tertiary-fixed h-full transition-all" style={{ width: '20%' }} title="50-74%" />
              <div className="bg-error-container h-full rounded-r-full transition-all" style={{ width: '15%' }} title="<50%" />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-on-surface-variant">
              <span>90-100%</span><span>75-89%</span><span>50-74%</span><span>&lt;50%</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-container-low rounded-lg p-3 text-center">
              <p className="text-headline-md font-bold text-secondary">{exam.avgScore}%</p>
              <p className="text-[11px] text-on-surface-variant">Avg Score</p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-3 text-center">
              <p className="text-headline-md font-bold text-primary">{exam.avgConfidence}%</p>
              <p className="text-[11px] text-on-surface-variant">AI Confidence</p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-3 text-center">
              <p className="text-headline-md font-bold text-on-surface">{exam.totalStudents}</p>
              <p className="text-[11px] text-on-surface-variant">Students</p>
            </div>
          </div>
        </div>
      ))}

      {completedExams.length === 0 && (
        <div className="card p-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-[48px] text-outline mb-3 block">analytics</span>
          <p className="text-body-md font-medium text-on-surface mb-1">No completed evaluations yet</p>
          <p className="text-body-sm">Results will appear here after AI evaluation is complete.</p>
        </div>
      )}
    </div>
  );
}
