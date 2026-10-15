import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { processAnswerSheet } from '../lib/pipeline';

const toFileItem = (f) => ({
  file: f,
  name: f.name,
  size: f.size,
  preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
  studentName: f.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
  rollNumber: '',
  state: 'queued', // queued | running | done | failed
  stage: '',
  result: null,
  warnings: [],
});

// Bulk evaluation: faculty upload one file per student; each is read, graded
// against the exam's knowledge base and saved, one after another.
export default function EvaluatePapersView() {
  const { activeExam, isDemo, navigate, addSubmission, showNotification, logAudit } = useApp();
  const [items, setItems] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [running, setRunning] = useState(false);

  if (!activeExam) {
    return (
      <div className="card p-12 text-center text-on-surface-variant">
        <p className="text-body-md mb-3">Choose an exam first.</p>
        <button onClick={() => navigate('exams')} className="btn-primary mx-auto">Go to exams</button>
      </div>
    );
  }

  const questions = activeExam.questions || [];
  const withoutKey = questions.filter(q => !q.modelAnswer?.trim());
  const ready = questions.length > 0 && withoutKey.length === 0;

  const addFiles = (files) => {
    const accepted = Array.from(files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (accepted.length < files.length) showNotification('Only images and PDFs can be evaluated.', 'warning');
    setItems(prev => [...prev, ...accepted.map(toFileItem)]);
  };

  const updateItem = (index, fields) => setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...fields } : it)));

  const handleEvaluate = async () => {
    setRunning(true);
    const results = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].state === 'done') continue;
      updateItem(i, { state: 'running', stage: 'Starting' });
      try {
        const { submission, warnings } = await processAnswerSheet(activeExam, items[i], {
          isDemo,
          onStage: stage => updateItem(i, { stage }),
        });
        addSubmission(submission);
        results.push(submission);
        updateItem(i, { state: 'done', stage: '', result: submission, warnings });
      } catch (err) {
        console.error('Evaluation failed:', err);
        updateItem(i, { state: 'failed', stage: '', warnings: [err.message] });
      }
    }
    setRunning(false);

    if (results.length) {
      const review = results.filter(s => s.status === 'Needs Review').length;
      logAudit({
        event: 'AI Evaluation Completed',
        actor: 'SmartCheck AI',
        actorType: 'system',
        examId: activeExam.id,
        examTitle: activeExam.title,
        detail: `${results.length} answer sheet(s) graded; ${review} need review.`,
        severity: review ? 'warning' : 'success',
      });
      showNotification(`${results.length} paper(s) evaluated${review ? `, ${review} need your review` : ''}.`, 'success');
    }
  };

  const done = items.filter(it => it.state === 'done').length;
  const pending = items.filter(it => it.state !== 'done').length;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5 animate-fadeIn">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('exam-detail', { exam: activeExam })} aria-label="Back to exam" className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <h1 className="text-headline-md font-bold text-on-surface">Evaluate Papers</h1>
          <p className="text-body-sm text-on-surface-variant">{activeExam.title} · {questions.length} questions</p>
        </div>
      </div>

      {!ready && (
        <div className="p-4 rounded-xl bg-error-container/40 border border-error/30 text-body-sm text-on-surface">
          {questions.length === 0
            ? 'This exam has no questions.'
            : `No answer key for ${withoutKey.map(q => q.label).join(', ')}. These questions can't be graded; create the exam again with an answer key.`}
        </div>
      )}

      <div
        className={`upload-zone ${isDragging ? 'active' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <span className="material-symbols-outlined text-[40px] text-outline mb-2 block">upload_file</span>
        <p className="text-label-md text-on-surface">Drop student answer sheets here: one file per student</p>
        <p className="text-body-sm text-on-surface-variant mt-1 mb-3">Scanned handwritten pages as images or PDF</p>
        <label className="btn-outline text-sm cursor-pointer inline-flex">
          Browse files
          <input type="file" multiple accept="image/*,.pdf" className="hidden" disabled={running} onChange={e => addFiles(e.target.files)} />
        </label>
      </div>

      {items.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between gap-3">
            <p className="text-label-md font-semibold text-on-surface">{items.length} paper(s) · {done} evaluated</p>
            {running && (
              <div className="flex-1 max-w-xs h-2 bg-surface-container-high rounded-full overflow-hidden" role="progressbar" aria-valuenow={done} aria-valuemax={items.length}>
                <div className="h-full bg-primary transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
              </div>
            )}
          </div>
          <ul className="divide-y divide-outline-variant">
            {items.map((it, i) => (
              <li key={`${it.name}-${i}`} className="p-3 flex items-center gap-3">
                {it.preview
                  ? <img src={it.preview} alt="" className="w-10 h-10 object-cover rounded flex-shrink-0" />
                  : <span className="material-symbols-outlined text-outline text-[32px] flex-shrink-0">picture_as_pdf</span>}
                <div className="flex-1 min-w-0">
                  {it.state === 'queued' ? (
                    <div className="flex gap-2">
                      <input
                        value={it.studentName}
                        onChange={e => updateItem(i, { studentName: e.target.value })}
                        placeholder="Student name"
                        aria-label="Student name"
                        className="input-field text-sm py-1 flex-1 min-w-0"
                      />
                      <input
                        value={it.rollNumber}
                        onChange={e => updateItem(i, { rollNumber: e.target.value })}
                        placeholder="Roll no."
                        aria-label="Roll number"
                        className="input-field text-sm py-1 w-28"
                      />
                    </div>
                  ) : (
                    <p className="text-label-md text-on-surface truncate">{it.studentName} {it.rollNumber && <span className="text-on-surface-variant">· {it.rollNumber}</span>}</p>
                  )}
                  <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                    {it.name}
                    {it.state === 'running' && <> · <span className="text-primary">{it.stage}…</span></>}
                    {it.warnings.length > 0 && <> · <span className="text-tertiary-container">{it.warnings.join('; ')}</span></>}
                  </p>
                </div>

                {it.state === 'queued' && !running && (
                  <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} aria-label={`Remove ${it.name}`} className="text-on-surface-variant hover:text-error">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
                {it.state === 'running' && <span className="material-symbols-outlined text-primary animate-spin-slow">progress_activity</span>}
                {it.state === 'failed' && <span className="text-xs text-error font-semibold">Failed</span>}
                {it.state === 'done' && it.result && (
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-label-md font-bold text-on-surface">{it.result.totalScore}/{it.result.maxScore}</p>
                      <p className={`text-[11px] ${it.result.status === 'Needs Review' ? 'text-tertiary-container' : 'text-secondary'}`}>{it.result.status}</p>
                    </div>
                    <button onClick={() => navigate('review-approve', { exam: activeExam, submission: it.result })} className="btn-outline text-xs">
                      Report
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {done > 0 && !running && (
          <button onClick={() => navigate('exam-detail', { exam: activeExam })} className="btn-ghost">All results</button>
        )}
        <button onClick={handleEvaluate} disabled={!ready || running || pending === 0} className="btn-primary disabled:opacity-50">
          {running
            ? <><span className="material-symbols-outlined text-[18px] animate-spin-slow">progress_activity</span> Evaluating {done + 1} of {items.length}...</>
            : <><span className="material-symbols-outlined text-[18px]">grading</span> Evaluate {pending} paper{pending === 1 ? '' : 's'}</>}
        </button>
      </div>
    </div>
  );
}
