import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { needsFacultyReview, LOW_OCR_CONFIDENCE } from '../lib/grading';

const STATUS_ICON = { met: 'check_circle', partial: 'contrast', missed: 'cancel' };
const STATUS_COLOR = { met: 'text-secondary', partial: 'text-tertiary-container', missed: 'text-error' };

// Only the answers the system was unsure about, across every student of the exam.
// Faculty accept or change each mark; everything else needs no checking.
export default function ReviewQueueView() {
  const { activeExam, navigate, getSubmissionsForExam, overrideScore } = useApp();
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(null);

  if (!activeExam) {
    return (
      <div className="card p-12 text-center text-on-surface-variant">
        <p className="text-body-md mb-3">Choose an exam first.</p>
        <button onClick={() => navigate('exams')} className="btn-primary mx-auto">Go to exams</button>
      </div>
    );
  }

  const subs = getSubmissionsForExam(activeExam.id);
  const queue = subs.flatMap(sub =>
    (sub.answers || []).filter(needsFacultyReview).map(ans => ({ sub, ans, key: `${sub.id}:${ans.questionId}` }))
  );
  const totalAnswers = subs.reduce((n, s) => n + (s.answers?.length || 0), 0);
  const modelAnswerFor = (questionId) => activeExam.questions?.find(q => q.id === questionId)?.modelAnswer || '';

  const save = async (item, score, note) => {
    setSaving(item.key);
    await overrideScore(item.sub.id, item.ans.questionId, score, note);
    setSaving(null);
  };

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('exam-detail', { exam: activeExam })} aria-label="Back to exam" className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <h1 className="text-headline-md font-bold text-on-surface">Review Queue</h1>
          <p className="text-body-sm text-on-surface-variant">
            {activeExam.title} · {queue.length} of {totalAnswers} answers need your check
          </p>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="card p-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-[48px] text-secondary mb-3 block">task_alt</span>
          <p className="text-body-md font-medium text-on-surface mb-1">Nothing to review</p>
          <p className="text-body-sm">Every graded answer was marked with confidence, or you have already checked it.</p>
        </div>
      ) : (
        queue.map(item => {
          const { sub, ans, key } = item;
          const hardToRead = ans.ocrConfidence !== null && ans.ocrConfidence !== undefined && ans.ocrConfidence < LOW_OCR_CONFIDENCE;
          const value = marks[key] ?? ans.aiScore;
          return (
            <div key={key} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-surface-bright border-b border-outline-variant">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-label-sm font-bold text-primary bg-primary-fixed px-2.5 py-0.5 rounded-full">{ans.questionLabel}</span>
                  <button
                    onClick={() => navigate('review-approve', { exam: activeExam, submission: sub })}
                    className="text-label-md font-semibold text-on-surface hover:text-primary truncate"
                  >
                    {sub.studentName} <span className="text-on-surface-variant font-normal">· {sub.rollNumber}</span>
                  </button>
                </div>
                <div className="flex gap-1.5">
                  {ans.needsReview && <span className="badge-review">AI unsure</span>}
                  {hardToRead && <span className="badge-review">Hard to read</span>}
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="flex flex-col gap-3">
                  <p className="text-body-sm text-on-surface-variant">{ans.questionText}</p>
                  <div>
                    <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Student&apos;s answer</p>
                    <div className="bg-surface-container-low rounded-lg p-3 text-body-sm text-on-surface border border-outline-variant whitespace-pre-wrap">
                      {ans.ocrText}
                    </div>
                  </div>
                  {modelAnswerFor(ans.questionId) && (
                    <details>
                      <summary className="text-label-sm text-on-surface-variant uppercase tracking-wider cursor-pointer select-none">Faculty model answer</summary>
                      <div className="mt-2 bg-secondary-fixed/20 rounded-lg p-3 text-body-sm text-on-surface border border-secondary-fixed whitespace-pre-wrap">
                        {modelAnswerFor(ans.questionId)}
                      </div>
                    </details>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {ans.aiCriteria?.length > 0 && (
                    <ul className="rounded-lg border border-outline-variant divide-y divide-outline-variant">
                      {ans.aiCriteria.map(c => (
                        <li key={c.criterion} className="px-3 py-2 flex items-start gap-2">
                          <span className={`material-symbols-outlined text-[18px] ${STATUS_COLOR[c.status] || 'text-outline'}`}>{STATUS_ICON[c.status] || 'help'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between gap-2">
                              <p className="text-label-md font-semibold text-on-surface">{c.criterion}</p>
                              <p className="text-label-md font-bold text-on-surface">{c.marks_awarded}/{c.marks}</p>
                            </div>
                            <p className="text-body-sm text-on-surface-variant">{c.reason}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap items-end gap-2 mt-auto">
                    <div>
                      <label htmlFor={`mark-${key}`} className="text-[11px] text-on-surface-variant block mb-1">Mark (AI suggested {ans.aiScore})</label>
                      <div className="flex items-center gap-1">
                        <input
                          id={`mark-${key}`}
                          type="number"
                          min={0}
                          max={ans.maxMarks}
                          step={0.5}
                          value={value}
                          onChange={e => setMarks(prev => ({ ...prev, [key]: e.target.value }))}
                          className="input-field w-24 py-1.5"
                        />
                        <span className="text-body-sm text-on-surface-variant">/{ans.maxMarks}</span>
                      </div>
                    </div>
                    <button
                      disabled={saving === key}
                      onClick={() => save(item, ans.aiScore, 'Accepted AI mark after review')}
                      className="btn-outline text-sm disabled:opacity-50"
                    >
                      Accept {ans.aiScore}
                    </button>
                    <button
                      disabled={saving === key || value === '' || Number(value) === ans.aiScore || Number(value) < 0 || Number(value) > ans.maxMarks}
                      onClick={() => save(item, parseFloat(value), 'Changed during review')}
                      className="btn-primary text-sm disabled:opacity-50"
                    >
                      Save {value}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
