import { useState } from 'react';

// Editable list of rubric criteria for one question. With showPoints, each criterion
// also lists the answer-key points that earn its marks.
export default function CriteriaEditor({ criteria = [], maxMarks, onChange, showPoints = false }) {
  const [newPoint, setNewPoint] = useState({});

  const update = (index, field, value) =>
    onChange(criteria.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  const remove = (index) => onChange(criteria.filter((_, i) => i !== index));
  const add = () => onChange([...criteria, { criterion: '', description: '', marks: '', concepts: [] }]);

  const removePoint = (index, point) =>
    update(index, 'concepts', (criteria[index].concepts || []).filter(p => p !== point));
  const addPoint = (index) => {
    const text = (newPoint[index] || '').trim();
    if (!text) return;
    update(index, 'concepts', [...(criteria[index].concepts || []), text]);
    setNewPoint(prev => ({ ...prev, [index]: '' }));
  };

  const total = criteria.reduce((sum, c) => sum + (Number(c.marks) || 0), 0);
  const mismatch = criteria.length > 0 && Number(maxMarks) > 0 && Math.abs(total - Number(maxMarks)) > 0.01;

  return (
    <div className="space-y-2">
      {criteria.map((c, i) => (
        <div key={i} className="rounded-lg border border-outline-variant bg-surface-container-lowest p-2.5">
          <div className="flex items-center gap-2">
            <input
              value={c.criterion}
              onChange={e => update(i, 'criterion', e.target.value)}
              placeholder="Criterion, e.g. Names the 5 Vs"
              aria-label="Criterion"
              className="input-field text-sm py-1 flex-1 min-w-0"
            />
            <input
              type="number"
              min={0}
              step={0.5}
              value={c.marks}
              onChange={e => update(i, 'marks', e.target.value)}
              aria-label="Marks"
              className="input-field text-sm py-1 w-20"
            />
            <span className="text-xs text-on-surface-variant">marks</span>
            <button onClick={() => remove(i)} aria-label="Remove criterion" className="p-1 rounded text-on-surface-variant hover:text-error">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <input
            value={c.description || ''}
            onChange={e => update(i, 'description', e.target.value)}
            placeholder="What earns these marks (optional)"
            aria-label="Criterion description"
            className="input-field text-xs py-1 mt-1.5"
          />
          {showPoints && (
            <div className="mt-2">
              <p className="text-[11px] text-on-surface-variant mb-1">Key points from the answer key that earn these marks</p>
              <div className="flex flex-wrap gap-1.5">
                {(c.concepts || []).map(p => (
                  <span key={p} className="inline-flex items-center gap-1 text-xs bg-primary-fixed/40 text-on-surface border border-primary/20 rounded-full pl-2.5 pr-1 py-0.5 max-w-full">
                    <span className="truncate" title={p}>{p}</span>
                    <button onClick={() => removePoint(i, p)} aria-label={`Remove ${p}`} className="hover:text-error flex-shrink-0">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                ))}
                {(c.concepts || []).length === 0 && (
                  <span className="text-xs text-error">No key points: this criterion will be graded on its name and description only.</span>
                )}
              </div>
              <div className="flex gap-1.5 mt-1.5">
                <input
                  value={newPoint[i] || ''}
                  onChange={e => setNewPoint(prev => ({ ...prev, [i]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPoint(i))}
                  placeholder="Add a key point"
                  aria-label="New key point"
                  className="input-field text-xs py-1 flex-1"
                />
                <button onClick={() => addPoint(i)} className="btn-ghost text-xs py-1 px-2">Add</button>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button onClick={add} className="btn-ghost text-xs py-1 px-2 flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">add</span>
          Add criterion
        </button>
        {mismatch && (
          <span className="text-xs text-tertiary-container">
            Criteria add up to {total} of {maxMarks} marks; they will be scaled to fit.
          </span>
        )}
      </div>
    </div>
  );
}
