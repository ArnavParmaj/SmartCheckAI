import { useState } from 'react';
import { rebuildKnowledge } from '../lib/backendApi';
import CriteriaEditor from './CriteriaEditor';

// Wizard step 4: faculty check and correct the knowledge base before any student
// paper is graded against it.
export default function KnowledgeReviewStep({ questions, setQuestions, showNotification }) {
  const [rebuilding, setRebuilding] = useState(null);

  const update = (id, fields) => setQuestions(prev => prev.map(q => (q.id === id ? { ...q, ...fields } : q)));

  const handleRebuild = async (q) => {
    setRebuilding(q.id);
    try {
      const res = await rebuildKnowledge({
        label: q.label,
        text: q.text,
        max_marks: Number(q.maxMarks) || 5,
        model_answer: q.modelAnswer || '',
        criteria: (q.criteria || []).map(c => ({ criterion: c.criterion, description: c.description || '', marks: Number(c.marks) || 0 })),
        rules: q.rules || [],
      });
      const k = res.knowledge;
      update(q.id, { criteria: k.criteria, concepts: k.concepts });
      showNotification(`Key points for ${q.label} rebuilt from the model answer.`, 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setRebuilding(null);
    }
  };

  const missing = questions.filter(q => !q.modelAnswer?.trim());

  return (
    <div className="animate-fadeIn">
      <h2 className="text-headline-md font-semibold text-on-surface mb-1">Review Knowledge Base</h2>
      <p className="text-body-sm text-on-surface-variant mb-4">
        Every student answer is graded against this. Check each model answer, the marks per criterion, and the key points
        that earn them. Fix anything wrong now; it applies to every paper.
      </p>

      {missing.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-error-container/40 border border-error/30 text-body-sm text-on-surface">
          Add a model answer for {missing.map(q => q.label).join(', ')} before creating the exam.
        </div>
      )}

      <div className="space-y-4">
        {questions.map(q => (
          <div key={q.id} className="border border-outline-variant rounded-xl p-4 bg-surface-container-low">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-label-sm font-bold text-primary bg-primary-fixed px-2.5 py-0.5 rounded-full flex-shrink-0">{q.label}</span>
                <p className="text-body-sm text-on-surface">{q.text}</p>
              </div>
              <span className="text-xs text-on-surface-variant flex-shrink-0">{q.maxMarks} marks</span>
            </div>

            <label className="text-label-md text-on-surface block mb-1" htmlFor={`model-${q.id}`}>Model answer</label>
            <textarea
              id={`model-${q.id}`}
              value={q.modelAnswer || ''}
              onChange={e => update(q.id, { modelAnswer: e.target.value })}
              rows={4}
              placeholder="Type the model answer for this question"
              className="input-field resize-y text-sm"
            />
            <div className="flex justify-end mt-1.5 mb-3">
              <button
                onClick={() => handleRebuild(q)}
                disabled={!q.modelAnswer?.trim() || rebuilding === q.id}
                className="btn-ghost text-xs py-1 px-2 flex items-center gap-1 disabled:opacity-40"
              >
                <span className={`material-symbols-outlined text-[16px] ${rebuilding === q.id ? 'animate-spin-slow' : ''}`}>
                  {rebuilding === q.id ? 'progress_activity' : 'refresh'}
                </span>
                Rebuild key points from model answer
              </button>
            </div>

            <p className="text-label-md text-on-surface mb-1.5">Marking criteria</p>
            <CriteriaEditor
              criteria={q.criteria || []}
              maxMarks={q.maxMarks}
              onChange={criteria => update(q.id, { criteria })}
              showPoints
            />

            <label className="text-label-md text-on-surface block mt-3 mb-1" htmlFor={`rules-${q.id}`}>
              Deductions &amp; marking rules <span className="text-xs text-on-surface-variant font-normal">(one per line; applied by the AI second opinion)</span>
            </label>
            <textarea
              id={`rules-${q.id}`}
              value={(q.rules || []).join('\n')}
              onChange={e => update(q.id, { rules: e.target.value.split('\n') })}
              rows={Math.min(6, Math.max(2, (q.rules || []).length))}
              placeholder="e.g. Calling HDFS a relational database: deduct 0.5"
              className="input-field resize-y text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
