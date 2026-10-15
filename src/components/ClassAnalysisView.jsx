import { useApp } from '../context/AppContext';
import { pointLabel } from '../lib/grading';

const finalScore = (a) => (a.teacherScore !== null && a.teacherScore !== undefined ? a.teacherScore : a.aiScore);

// Per-question class results: averages, score spread, and the answer-key points
// most students missed, so faculty can see what to re-teach.
function analyseQuestion(question, subs) {
  const answers = subs
    .map(s => s.answers?.find(a => a.questionId === question.id))
    .filter(a => a && a.aiScore !== null && a.aiScore !== undefined);
  const max = Number(question.maxMarks) || answers[0]?.maxMarks || 0;
  const scores = answers.map(finalScore);
  const avg = scores.length ? scores.reduce((sum, x) => sum + x, 0) / scores.length : null;
  const bands = [0, 0, 0, 0]; // >=75%, 50-75, 25-50, <25
  for (const sc of scores) {
    const p = max ? sc / max : 0;
    bands[p >= 0.75 ? 0 : p >= 0.5 ? 1 : p >= 0.25 ? 2 : 3] += 1;
  }

  const missedCount = {};
  const criterionTotals = {};
  for (const a of answers) {
    const missed = new Set();
    for (const c of a.aiCriteria || []) {
      (c.concepts_missed || []).forEach(p => missed.add(p));
      (c.concepts_partial || []).forEach(p => missed.add(p));
      const t = criterionTotals[c.criterion] || { got: 0, max: 0 };
      criterionTotals[c.criterion] = { got: t.got + c.marks_awarded, max: t.max + c.marks };
    }
    if (!a.aiCriteria?.length) (a.conceptsMissed || []).forEach(p => missed.add(p));
    missed.forEach(p => { missedCount[p] = (missedCount[p] || 0) + 1; });
  }
  const topMissed = Object.entries(missedCount)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 4)
    .map(([point, n]) => ({ point, share: Math.round((n / answers.length) * 100) }));
  const unanswered = subs.filter(s => {
    const a = s.answers?.find(x => x.questionId === question.id);
    return a && !a.ocrText?.trim();
  }).length;

  return { count: answers.length, max, avg, bands, topMissed, criterionTotals, unanswered };
}

export default function ClassAnalysisView() {
  const { activeExam, navigate, getSubmissionsForExam } = useApp();

  if (!activeExam) {
    return (
      <div className="card p-12 text-center text-on-surface-variant">
        <p className="text-body-md mb-3">Choose an exam first.</p>
        <button onClick={() => navigate('exams')} className="btn-primary mx-auto">Go to exams</button>
      </div>
    );
  }

  const subs = getSubmissionsForExam(activeExam.id).filter(s => s.aiScore !== null && s.aiScore !== undefined);
  const questions = activeExam.questions || [];
  const BAND_STYLE = ['bg-secondary', 'bg-secondary-fixed-dim', 'bg-tertiary-fixed', 'bg-error-container'];
  const BAND_LABEL = ['75%+', '50-75%', '25-50%', 'Under 25%'];

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('exam-detail', { exam: activeExam })} aria-label="Back to exam" className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <h1 className="text-headline-md font-bold text-on-surface">Class Analysis</h1>
          <p className="text-body-sm text-on-surface-variant">{activeExam.title} · {subs.length} graded student(s)</p>
        </div>
      </div>

      {subs.length === 0 ? (
        <div className="card p-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-[48px] text-outline mb-3 block">analytics</span>
          <p className="text-body-md font-medium text-on-surface mb-1">No graded papers yet</p>
          <p className="text-body-sm">Evaluate some papers to see how the class did on each question.</p>
        </div>
      ) : (
        questions.map(q => {
          const a = analyseQuestion(q, subs);
          if (!a.count) return null;
          const avgPct = a.max ? Math.round((a.avg / a.max) * 100) : 0;
          return (
            <div key={q.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-label-sm font-bold text-primary bg-primary-fixed px-2.5 py-0.5 rounded-full flex-shrink-0">{q.label}</span>
                  <p className="text-body-sm text-on-surface">{q.text}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-headline-md font-bold text-on-surface">{a.avg.toFixed(1)}<span className="text-body-sm text-on-surface-variant font-normal">/{a.max}</span></p>
                  <p className="text-[11px] text-on-surface-variant">class average ({avgPct}%)</p>
                </div>
              </div>

              <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-1" role="img" aria-label={BAND_LABEL.map((l, i) => `${l}: ${a.bands[i]}`).join(', ')}>
                {a.bands.map((n, i) => n > 0 && (
                  <div key={i} className={`${BAND_STYLE[i]} h-full`} style={{ width: `${(n / a.count) * 100}%` }} title={`${BAND_LABEL[i]}: ${n} student(s)`} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-on-surface-variant mb-4">
                {BAND_LABEL.map((l, i) => (
                  <span key={l} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${BAND_STYLE[i]}`} />{l}: {a.bands[i]}</span>
                ))}
                {a.unanswered > 0 && <span>Not attempted: {a.unanswered}</span>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Most often missed</p>
                  {a.topMissed.length === 0 ? (
                    <p className="text-body-sm text-on-surface-variant">Nothing commonly missed.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {a.topMissed.map(m => (
                        <li key={m.point} className="text-body-sm text-on-surface flex items-center justify-between gap-2">
                          <span className="truncate" title={m.point}>{pointLabel(m.point)}</span>
                          <span className={`font-semibold flex-shrink-0 ${m.share >= 50 ? 'text-error' : 'text-on-surface-variant'}`}>{m.share}% of students</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {Object.keys(a.criterionTotals).length > 0 && (
                  <div>
                    <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Marks earned per criterion</p>
                    <ul className="space-y-1.5">
                      {Object.entries(a.criterionTotals).map(([name, t]) => {
                        const pct = t.max ? Math.round((t.got / t.max) * 100) : 0;
                        return (
                          <li key={name} className="text-body-sm">
                            <div className="flex justify-between gap-2"><span className="text-on-surface truncate">{name}</span><span className="text-on-surface-variant">{pct}%</span></div>
                            <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden mt-0.5">
                              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
