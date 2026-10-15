import { useState } from 'react';
import { buildKnowledge } from '../lib/backendApi';

// Wizard step 3: the faculty's typed answer key, split per question into the
// knowledge base the grader uses.
export default function AnswerKeyStep({ questions, setQuestions, showNotification }) {
  const [mode, setMode] = useState('file');
  const [file, setFile] = useState(null);
  const [pasted, setPasted] = useState('');
  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState(null);

  const ready = questions.filter(q => q.modelAnswer?.trim()).length;

  const handleBuild = async () => {
    setBuilding(true);
    try {
      const spec = questions.map(q => ({
        label: q.label,
        text: q.text,
        max_marks: Number(q.maxMarks) || 5,
        criteria: (q.criteria || []).map(c => ({ criterion: c.criterion, description: c.description || '', marks: Number(c.marks) || 0 })),
      }));
      const res = await buildKnowledge(spec, mode === 'file' ? { file } : { text: pasted });
      if (res.status !== 'success') {
        showNotification(res.message || 'Could not read the answer key.', 'error');
        return;
      }
      setQuestions(prev => prev.map(q => {
        const k = res.knowledge?.[q.label];
        if (!k) return q;
        return { ...q, modelAnswer: k.model_answer, criteria: k.criteria, concepts: k.concepts };
      }));
      setResult(res);
      const found = questions.length - (res.missing?.length || 0);
      showNotification(`Found model answers for ${found} of ${questions.length} questions.`, res.missing?.length ? 'warning' : 'success');
    } catch (err) {
      showNotification(`${err.message}. Is the backend running?`, 'error');
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="animate-fadeIn">
      <h2 className="text-headline-md font-semibold text-on-surface mb-1">Faculty Answer Key</h2>
      <p className="text-body-sm text-on-surface-variant mb-4">
        Upload your typed model answers. They are split by question label ({questions.slice(0, 3).map(q => q.label).join(', ')}…)
        and turned into the key points every student answer is graded against.
      </p>

      <div className="flex gap-2 mb-3" role="tablist">
        {[['file', 'Upload file'], ['paste', 'Paste text']].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={mode === id ? 'btn-primary text-xs py-1.5' : 'btn-ghost text-xs py-1.5'}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'file' ? (
        <label className="upload-zone mb-4 block cursor-pointer">
          <span className="material-symbols-outlined text-[36px] text-outline mb-2 block">description</span>
          <p className="text-label-md text-on-surface">{file ? file.name : 'Choose the answer key file'}</p>
          <p className="text-body-sm text-on-surface-variant mt-1">Typed PDF, Word (.docx) or text file</p>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); }}
          />
        </label>
      ) : (
        <textarea
          value={pasted}
          onChange={e => { setPasted(e.target.value); setResult(null); }}
          rows={10}
          placeholder={'Q1(a) Volume: millions of transactions...\n(b) HDFS stores data...\nQ2(a) ...'}
          aria-label="Answer key text"
          className="input-field resize-y mb-4 font-mono text-sm"
        />
      )}

      <button
        onClick={handleBuild}
        disabled={building || (mode === 'file' ? !file : !pasted.trim())}
        className="btn-primary w-full justify-center disabled:opacity-50"
      >
        {building ? (
          <><span className="material-symbols-outlined text-[18px] animate-spin-slow">progress_activity</span> Reading answer key and building knowledge base...</>
        ) : (
          <><span className="material-symbols-outlined text-[18px]">psychology</span> Build knowledge base</>
        )}
      </button>

      {result && (
        <div className={`mt-4 rounded-xl p-4 border ${result.missing?.length ? 'bg-tertiary-fixed/30 border-tertiary-fixed-dim' : 'bg-secondary-fixed/30 border-secondary'}`}>
          <p className="text-label-md font-semibold text-on-surface">
            Model answers found for {questions.length - (result.missing?.length || 0)} of {questions.length} questions
          </p>
          {result.missing?.length > 0 && (
            <p className="text-body-sm text-on-surface-variant mt-1">
              Not found: {result.missing.join(', ')}. Check the labels in your file match, or type these answers in the next step.
            </p>
          )}
        </div>
      )}

      {!result && ready > 0 && (
        <p className="text-body-sm text-on-surface-variant mt-3">{ready} of {questions.length} questions already have a model answer.</p>
      )}
    </div>
  );
}
