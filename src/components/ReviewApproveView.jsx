import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getConfidenceClass, getConfidenceLabel } from '../data/mockData';

export default function ReviewApproveView() {
  const { activeSubmission, activeExam, navigate, overrideScore, approveSubmission } = useApp();

  if (!activeSubmission) { navigate('exams'); return null; }

  const [overrides, setOverrides] = useState(
    Object.fromEntries(activeSubmission.answers.map(a => [a.questionId, {
      score: a.teacherScore !== null ? a.teacherScore : a.aiScore,
      note: a.teacherNote || '',
      editing: false,
    }]))
  );
  const [showFeedback, setShowFeedback] = useState(null);
  const [approved, setApproved] = useState(activeSubmission.teacherApproved);
  const [approving, setApproving] = useState(false);

  const totalTeacher = activeSubmission.answers.reduce((sum, ans) => {
    const ov = overrides[ans.questionId];
    return sum + (ov ? parseInt(ov.score) || 0 : ans.aiScore);
  }, 0);

  const hasChanges = activeSubmission.answers.some(ans => {
    const ov = overrides[ans.questionId];
    return ov && parseInt(ov.score) !== ans.aiScore;
  });

  const handleOverrideSave = (questionId) => {
    const ov = overrides[questionId];
    overrideScore(activeSubmission.id, questionId, parseInt(ov.score), ov.note);
    setOverrides(prev => ({ ...prev, [questionId]: { ...prev[questionId], editing: false } }));
  };

  const handleApprove = async () => {
    setApproving(true);
    await new Promise(r => setTimeout(r, 1200));
    approveSubmission(activeSubmission.id);
    setApproved(true);
    setApproving(false);
  };

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('exam-detail', { exam: activeExam })} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-headline-md font-bold text-on-surface">Review & Approve</h1>
          <p className="text-body-sm text-on-surface-variant">{activeSubmission.studentName} ({activeSubmission.rollNumber}) · {activeExam?.title}</p>
        </div>
        {approved ? (
          <div className="flex items-center gap-2 bg-secondary-fixed border border-secondary px-3 py-1.5 rounded-lg">
            <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
            <span className="text-label-md text-secondary font-semibold">Approved</span>
          </div>
        ) : (
          <button
            onClick={handleApprove}
            disabled={approving}
            className="btn-primary disabled:opacity-60"
          >
            {approving ? (
              <><span className="material-symbols-outlined text-[18px] animate-spin-slow">progress_activity</span> Approving...</>
            ) : (
              <><span className="material-symbols-outlined text-[18px]">check_circle</span> Approve & Finalize</>
            )}
          </button>
        )}
      </div>

      {/* Score Summary */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className={`score-circle border-4 text-lg ${totalTeacher / activeSubmission.maxScore >= 0.75 ? 'border-secondary text-secondary' : totalTeacher / activeSubmission.maxScore >= 0.5 ? 'border-tertiary-container text-tertiary-container' : 'border-error text-error'}`}>
              {Math.round((totalTeacher / activeSubmission.maxScore) * 100)}%
            </div>
            <div>
              <p className="text-headline-lg font-bold text-on-surface">{totalTeacher}<span className="text-body-lg text-on-surface-variant font-normal">/{activeSubmission.maxScore}</span></p>
              <p className="text-body-sm text-on-surface-variant">Teacher-adjusted final score</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 sm:ml-auto">
            <div className="text-center">
              <p className="text-label-sm text-on-surface-variant">AI Score</p>
              <p className="text-headline-md font-bold text-on-surface">{activeSubmission.totalScore}/{activeSubmission.maxScore}</p>
            </div>
            <div className="w-px bg-outline-variant" />
            <div className="text-center">
              <p className="text-label-sm text-on-surface-variant">AI Confidence</p>
              <span className={`${getConfidenceClass(activeSubmission.aiConfidence)} mt-1`}>{activeSubmission.aiConfidence}%</span>
            </div>
            <div className="w-px bg-outline-variant" />
            <div className="text-center">
              <p className="text-label-sm text-on-surface-variant">Overrides</p>
              <p className={`text-headline-md font-bold ${hasChanges ? 'text-tertiary-container' : 'text-on-surface-variant'}`}>
                {activeSubmission.answers.filter(a => overrides[a.questionId] && parseInt(overrides[a.questionId].score) !== a.aiScore).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Question-by-question */}
      <div className="flex flex-col gap-4">
        {activeSubmission.answers.map((ans, index) => {
          const ov = overrides[ans.questionId];
          const isOverridden = ov && parseInt(ov.score) !== ans.aiScore;

          return (
            <div key={ans.questionId} className={`card overflow-hidden ${isOverridden ? 'ring-2 ring-tertiary-fixed-dim' : ''}`}>
              {/* Question header */}
              <div className="flex items-center justify-between px-5 py-3 bg-surface-bright border-b border-outline-variant">
                <div className="flex items-center gap-2">
                  <span className="text-label-sm font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-full">Q{index + 1}</span>
                  <span className="text-body-sm text-on-surface-variant">{ans.questionText}</span>
                </div>
                <span className="text-label-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full flex-shrink-0">
                  /{ans.maxMarks} marks
                </span>
              </div>

              <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Student answer */}
                <div>
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Student's Answer (OCR)</p>
                  <div className="bg-surface-container-low rounded-lg p-3 text-body-sm text-on-surface border border-outline-variant">
                    {ans.ocrText}
                  </div>
                </div>

                {/* AI Evaluation */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">AI Evaluation</p>
                    <span className={getConfidenceClass(ans.aiConfidence)}>{ans.aiConfidence}% — {getConfidenceLabel(ans.aiConfidence)}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* AI Score */}
                    <div className="flex-1 bg-surface-container-low rounded-lg p-3 border border-outline-variant">
                      <p className="text-[11px] text-on-surface-variant mb-1">AI Score</p>
                      <p className="text-headline-md font-bold text-on-surface">{ans.aiScore}<span className="text-body-sm text-on-surface-variant">/{ans.maxMarks}</span></p>
                    </div>

                    <span className="material-symbols-outlined text-outline text-[20px]">arrow_forward</span>

                    {/* Teacher Override */}
                    <div className={`flex-1 rounded-lg p-3 border ${isOverridden ? 'bg-tertiary-fixed/30 border-tertiary-fixed-dim' : 'bg-surface-container-low border-outline-variant'}`}>
                      <p className="text-[11px] text-on-surface-variant mb-1">Teacher Score</p>
                      {ov?.editing ? (
                        <input
                          type="number"
                          value={ov.score}
                          min={0}
                          max={ans.maxMarks}
                          onChange={e => setOverrides(prev => ({ ...prev, [ans.questionId]: { ...prev[ans.questionId], score: e.target.value } }))}
                          className="w-full text-headline-md font-bold border border-primary rounded px-1 py-0"
                        />
                      ) : (
                        <p className={`text-headline-md font-bold ${isOverridden ? 'text-tertiary-container' : 'text-on-surface'}`}>
                          {ov?.score ?? ans.aiScore}
                          <span className="text-body-sm text-on-surface-variant font-normal">/{ans.maxMarks}</span>
                          {isOverridden && <span className="text-[11px] text-tertiary-container ml-1">(Modified)</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* AI rationale & actions */}
                  <div className="bg-primary-fixed/20 rounded-lg p-3 border border-primary-fixed">
                    <p className="text-[11px] text-primary font-semibold uppercase tracking-wider mb-1">AI Rationale</p>
                    <p className="text-body-sm text-on-surface">{ans.aiRationale}</p>
                    <button
                      onClick={() => setShowFeedback(ans)}
                      className="mt-2 text-primary text-xs font-semibold hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">info</span>
                      Full Explanation
                    </button>
                  </div>

                  {/* Override controls */}
                  {!approved && (
                    ov?.editing ? (
                      <div className="space-y-2">
                        <textarea
                          value={ov.note}
                          onChange={e => setOverrides(prev => ({ ...prev, [ans.questionId]: { ...prev[ans.questionId], note: e.target.value } }))}
                          placeholder="Add a note about this override..."
                          rows={2}
                          className="input-field resize-none text-sm"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => setOverrides(prev => ({ ...prev, [ans.questionId]: { ...prev[ans.questionId], editing: false, score: ans.aiScore, note: '' } }))} className="btn-ghost text-xs flex-1">Cancel</button>
                          <button onClick={() => handleOverrideSave(ans.questionId)} className="btn-primary text-xs flex-1 justify-center">Save Override</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setOverrides(prev => ({ ...prev, [ans.questionId]: { ...prev[ans.questionId], editing: true } }))}
                        className="btn-ghost text-xs flex items-center gap-1 self-start"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Override Score
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowFeedback(null)}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-modal w-full max-w-lg animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <div>
                <h3 className="text-headline-md font-bold text-on-surface">AI Feedback & Explanation</h3>
                <p className="text-body-sm text-on-surface-variant">Question: {showFeedback.questionText}</p>
              </div>
              <button onClick={() => setShowFeedback(null)} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`score-circle w-14 h-14 text-base ${showFeedback.aiScore / showFeedback.maxMarks >= 0.75 ? 'border-secondary text-secondary' : 'border-tertiary-container text-tertiary-container'}`}>
                  {showFeedback.aiScore}/{showFeedback.maxMarks}
                </div>
                <div>
                  <p className="text-label-md font-semibold text-on-surface">AI Score: {showFeedback.aiScore}/{showFeedback.maxMarks}</p>
                  <span className={getConfidenceClass(showFeedback.aiConfidence)}>{showFeedback.aiConfidence}% confidence</span>
                </div>
              </div>

              <div className="bg-primary-fixed/20 rounded-xl p-4 border border-primary-fixed">
                <p className="text-label-sm font-semibold text-primary uppercase tracking-wider mb-2">Detailed Rationale</p>
                <p className="text-body-md text-on-surface leading-relaxed">{showFeedback.aiRationale}</p>
              </div>

              <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant">
                <p className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Student's OCR Answer</p>
                <p className="text-body-sm text-on-surface">{showFeedback.ocrText}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-outline-variant">
              <button onClick={() => setShowFeedback(null)} className="btn-primary w-full justify-center">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
