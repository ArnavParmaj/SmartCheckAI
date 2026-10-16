import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { processAnswerSheet } from '../lib/pipeline';
import { getJobProgress, getEngineStatus } from '../lib/backendApi';

// Roll numbers like 21CE1042; file names like "Set2_Student1_21CE1042_Aarav_Kulkarni.pdf"
const ROLL_RE = /\b\d{2}[A-Z]{2,4}\d{3,5}\b/i;

function guessFromFileName(fileName) {
  const base = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
  const roll = base.match(ROLL_RE)?.[0] || '';
  const name = base
    .replace(ROLL_RE, ' ')
    .replace(/\b(set|student|sheet|answer|paper)\s*\d*\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { name, roll };
}

const toFileItem = (f) => ({
  file: f,
  name: f.name,
  size: f.size,
  preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
  studentName: guessFromFileName(f.name).name,
  rollNumber: guessFromFileName(f.name).roll,
  nameEdited: false, // a name/roll typed by faculty beats the one read from the booklet
  state: 'queued', // queued | running | done | failed
  stage: '',
  detail: '', // live detail from the backend, e.g. "Reading handwriting: page 2 of 3"
  page: null,
  pages: null,
  jobId: null,
  startedAt: null,
  finishedAt: null,
  result: null,
  warnings: [],
});

// The steps one sheet goes through, and which pipeline stage belongs to which step
const STEPS = ['Read handwriting', 'Save', 'Grade', 'Done'];
const STAGE_STEP = { Starting: 0, 'Reading handwriting': 0, Uploading: 1, 'Saving answers': 1, Grading: 2 };
// Backend progress stages that belong to a pipeline stage (its detail is stale in any other stage)
const BACKEND_STAGE = { 'Reading handwriting': 'ocr', Grading: 'grading' };

function formatDuration(ms) {
  if (ms == null || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

function StatTile({ label, value, icon, tone = 'text-on-surface' }) {
  return (
    <div className="card p-3 flex items-center gap-3">
      <span className={`material-symbols-outlined text-[22px] ${tone}`}>{icon}</span>
      <div>
        <p className={`text-headline-md font-bold leading-none ${tone}`}>{value}</p>
        <p className="text-[11px] text-on-surface-variant mt-1">{label}</p>
      </div>
    </div>
  );
}

function StepTracker({ step }) {
  return (
    <ol className="flex items-center gap-1" aria-label="Progress steps">
      {STEPS.map((label, i) => {
        const state = i < step ? 'done' : i === step ? 'active' : 'todo';
        return (
          <li key={label} className="flex items-center gap-1 flex-1 min-w-0">
            <span
              className={`material-symbols-outlined text-[18px] flex-shrink-0 ${
                state === 'done' ? 'text-secondary' : state === 'active' ? 'text-primary animate-spin-slow' : 'text-outline'
              }`}
              aria-hidden="true"
            >
              {state === 'done' ? 'check_circle' : state === 'active' ? 'progress_activity' : 'radio_button_unchecked'}
            </span>
            <span className={`text-[11px] truncate ${state === 'todo' ? 'text-on-surface-variant' : 'text-on-surface font-semibold'}`}>{label}</span>
            {i < STEPS.length - 1 && <span className={`h-px flex-1 min-w-[8px] ${i < step ? 'bg-secondary' : 'bg-outline-variant'}`} />}
          </li>
        );
      })}
    </ol>
  );
}

// Bulk evaluation: faculty upload one file per student; each is read, graded
// against the exam's knowledge base and saved, one after another, with live progress.
export default function EvaluatePapersView() {
  const { activeExam, isDemo, navigate, addSubmission, showNotification, logAudit } = useApp();
  const [items, setItems] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [batchStart, setBatchStart] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [engine, setEngine] = useState(null);

  const current = items.find(it => it.state === 'running');

  // Clock for the timers while a batch runs
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Local AI engine status: on open, then every 10 s during a batch
  useEffect(() => {
    let cancelled = false;
    const check = () => getEngineStatus().then(s => !cancelled && setEngine(s)).catch(() => !cancelled && setEngine({ offline: true }));
    check();
    if (!running) return () => { cancelled = true; };
    const id = setInterval(check, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [running]);

  // Live detail for the sheet being processed (which page, which step on the backend)
  const currentJob = current?.jobId;
  useEffect(() => {
    if (!currentJob) return undefined;
    const id = setInterval(() => {
      getJobProgress(currentJob)
        .then(p => setItems(prev => prev.map(it => (it.jobId === currentJob && it.state === 'running' && BACKEND_STAGE[it.stage] === p.stage
          ? { ...it, detail: p.detail || '', page: p.page ?? null, pages: p.pages ?? null }
          : it))))
        .catch(() => {});
    }, 1500);
    return () => clearInterval(id);
  }, [currentJob]);

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
    setBatchStart(Date.now());
    setNow(Date.now());
    const results = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].state === 'done') continue;
      const jobId = crypto.randomUUID();
      updateItem(i, { state: 'running', stage: 'Starting', detail: '', page: null, pages: null, jobId, startedAt: Date.now(), finishedAt: null, warnings: [] });
      try {
        const { submission, warnings } = await processAnswerSheet(activeExam, items[i], {
          isDemo,
          jobId,
          onStage: stage => updateItem(i, { stage, detail: '' }),
        });
        addSubmission(submission);
        results.push(submission);
        updateItem(i, { state: 'done', stage: '', detail: '', result: submission, warnings, finishedAt: Date.now() });
      } catch (err) {
        console.error('Evaluation failed:', err);
        updateItem(i, { state: 'failed', stage: '', detail: '', warnings: [err.message], finishedAt: Date.now() });
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

  const done = items.filter(it => it.state === 'done');
  const failed = items.filter(it => it.state === 'failed').length;
  const queued = items.filter(it => it.state === 'queued').length;
  const pending = items.length - done.length;
  const needsReview = done.filter(it => it.result?.status === 'Needs Review').length;
  const finished = done.length + failed;

  // Estimate from the sheets finished in this batch
  const timed = items.filter(it => it.startedAt && it.finishedAt);
  const avgMs = timed.length ? timed.reduce((sum, it) => sum + (it.finishedAt - it.startedAt), 0) / timed.length : null;
  const currentElapsed = current?.startedAt ? now - current.startedAt : 0;
  const remainingMs = avgMs != null && running ? Math.max(0, avgMs * (queued + (current ? 1 : 0)) - currentElapsed) : null;
  const percent = items.length ? Math.round((finished / items.length) * 100) : 0;

  const engineChip = !engine ? null : engine.offline || !engine.ollama ? (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-error-container/50 text-error">
      <span className="material-symbols-outlined text-[14px]">error</span> Local AI engine not running: start the Ollama app
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-secondary-fixed/60 text-on-surface">
      <span className={`w-2 h-2 rounded-full ${running ? 'bg-primary animate-pulse' : 'bg-secondary'}`} />
      Local AI · {engine.model} · {engine.loaded ? (running ? 'working on GPU' : 'loaded, ready') : 'idle (loads on first sheet)'}
    </span>
  );

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5 animate-fadeIn">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('exam-detail', { exam: activeExam })} aria-label="Back to exam" className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-headline-md font-bold text-on-surface">Evaluate Papers</h1>
          <p className="text-body-sm text-on-surface-variant">{activeExam.title} · {questions.length} questions</p>
        </div>
        {engineChip}
      </div>

      {!ready && (
        <div className="p-4 rounded-xl bg-error-container/40 border border-error/30 text-body-sm text-on-surface">
          {questions.length === 0
            ? 'This exam has no questions.'
            : `No answer key for ${withoutKey.map(q => q.label).join(', ')}. These questions can't be graded; create the exam again with an answer key.`}
        </div>
      )}

      {/* Batch dashboard */}
      {items.length > 0 && (running || finished > 0) && (
        <section className="flex flex-col gap-3" aria-label="Evaluation progress">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatTile label="Evaluated" value={done.length} icon="task_alt" tone="text-secondary" />
            <StatTile label="In progress" value={current ? 1 : 0} icon="pending" tone="text-primary" />
            <StatTile label="Waiting" value={queued} icon="schedule" />
            <StatTile label="Need review" value={needsReview} icon="flag" tone={needsReview ? 'text-tertiary-container' : 'text-on-surface'} />
            <StatTile label="Failed" value={failed} icon="error" tone={failed ? 'text-error' : 'text-on-surface'} />
          </div>

          <div className="card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 text-body-sm">
              <span className="font-semibold text-on-surface">{finished} of {items.length} papers · {percent}%</span>
              <span className="text-on-surface-variant">
                {batchStart && <>Elapsed {formatDuration((running ? now : (items.reduce((m, it) => Math.max(m, it.finishedAt || 0), 0) || now)) - batchStart)}</>}
                {remainingMs != null && <> · about {formatDuration(remainingMs)} left</>}
                {running && avgMs == null && <> · estimating time…</>}
              </span>
            </div>
            <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden" role="progressbar" aria-valuenow={finished} aria-valuemin={0} aria-valuemax={items.length}>
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${percent}%` }} />
            </div>
            {running && (
              <p className="text-[11px] text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">info</span>
                Keep this page open until the batch finishes. Each sheet takes about a minute on this computer.
              </p>
            )}
          </div>

          {/* The sheet being worked on now */}
          {current && (
            <div className="card p-4 border-l-4 border-primary flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-primary font-semibold uppercase tracking-wider">Now evaluating</p>
                  <p className="text-label-md font-semibold text-on-surface truncate">
                    {current.studentName || current.name} {current.rollNumber && <span className="text-on-surface-variant font-normal">· {current.rollNumber}</span>}
                  </p>
                </div>
                <span className="text-body-sm text-on-surface-variant flex-shrink-0">{formatDuration(currentElapsed)}</span>
              </div>
              <StepTracker step={STAGE_STEP[current.stage] ?? 0} />
              <div>
                <p className="text-body-sm text-on-surface">{current.detail || `${current.stage}…`}</p>
                {current.pages > 1 && current.stage === 'Reading handwriting' && (
                  <div className="h-1.5 mt-2 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-primary/70 transition-all" style={{ width: `${((current.page - 1) / current.pages) * 100}%` }} />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {!running && (
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
            <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={e => addFiles(e.target.files)} />
          </label>
        </div>
      )}

      {items.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant">
            <p className="text-label-md font-semibold text-on-surface">{items.length} paper(s)</p>
          </div>
          <ul className="divide-y divide-outline-variant">
            {items.map((it, i) => (
              <li key={`${it.name}-${i}`} className={`p-3 flex items-center gap-3 ${it.state === 'running' ? 'bg-primary-fixed/20' : ''}`}>
                {it.preview
                  ? <img src={it.preview} alt="" className="w-10 h-10 object-cover rounded flex-shrink-0" />
                  : <span className="material-symbols-outlined text-outline text-[32px] flex-shrink-0">picture_as_pdf</span>}
                <div className="flex-1 min-w-0">
                  {it.state === 'queued' && !running ? (
                    <div className="flex gap-2">
                      <input
                        value={it.studentName}
                        onChange={e => updateItem(i, { studentName: e.target.value, nameEdited: true })}
                        placeholder="Student name"
                        aria-label="Student name"
                        className="input-field text-sm py-1 flex-1 min-w-0"
                      />
                      <input
                        value={it.rollNumber}
                        onChange={e => updateItem(i, { rollNumber: e.target.value, nameEdited: true })}
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
                    {it.state === 'queued' && running && <> · waiting</>}
                    {it.state === 'running' && <> · <span className="text-primary">{it.detail || `${it.stage}…`}</span></>}
                    {(it.state === 'done' || it.state === 'failed') && it.startedAt && <> · took {formatDuration(it.finishedAt - it.startedAt)}</>}
                    {it.warnings.length > 0 && <> · <span className="text-tertiary-container">{it.warnings.join('; ')}</span></>}
                  </p>
                </div>

                {it.state === 'queued' && !running && (
                  <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} aria-label={`Remove ${it.name}`} className="text-on-surface-variant hover:text-error">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
                {it.state === 'queued' && running && <span className="material-symbols-outlined text-outline text-[18px]" aria-label="Waiting">schedule</span>}
                {it.state === 'running' && <span className="material-symbols-outlined text-primary animate-spin-slow" aria-label="In progress">progress_activity</span>}
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
        {done.length > 0 && !running && (
          <button onClick={() => navigate('exam-detail', { exam: activeExam })} className="btn-ghost">All results</button>
        )}
        <button onClick={handleEvaluate} disabled={!ready || running || pending === 0} className="btn-primary disabled:opacity-50">
          {running
            ? <><span className="material-symbols-outlined text-[18px] animate-spin-slow">progress_activity</span> Evaluating {finished + 1} of {items.length}...</>
            : <><span className="material-symbols-outlined text-[18px]">grading</span> Evaluate {pending} paper{pending === 1 ? '' : 's'}</>}
        </button>
      </div>
    </div>
  );
}
