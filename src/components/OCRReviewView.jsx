import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getConfidenceClass } from '../data/mockData';
import AnswerSheetViewer from './AnswerSheetViewer';

function OCRReviewViewContent() {
  const { activeSubmission, activeExam, navigate, updateOcrText } = useApp();

  const [editingId, setEditingId] = useState(null);
  const [editTexts, setEditTexts] = useState(
    Object.fromEntries(activeSubmission.answers.map(a => [a.questionId, a.ocrText]))
  );
  const [activeQ, setActiveQ] = useState(activeSubmission.answers[0]?.questionId);
  const [saved, setSaved] = useState(false);

  const currentAnswer = activeSubmission.answers.find(a => a.questionId === activeQ);

  const handleSave = (questionId) => {
    updateOcrText(activeSubmission.id, questionId, editTexts[questionId]);
    setEditingId(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('exam-detail', { exam: activeExam })} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-headline-md font-bold text-on-surface">OCR Review</h1>
          <p className="text-body-sm text-on-surface-variant">{activeSubmission.studentName} · {activeExam?.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={getConfidenceClass(activeSubmission.ocrAccuracy)}>{activeSubmission.ocrAccuracy}% OCR Accuracy</span>
          <button
            onClick={() => navigate('review-approve', { exam: activeExam, submission: activeSubmission })}
            className="btn-primary"
          >
            Proceed to Review
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Question Tabs */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {activeSubmission.answers.map((ans, i) => (
          <button
            key={ans.questionId}
            onClick={() => setActiveQ(ans.questionId)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeQ === ans.questionId
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {ans.questionLabel || `Q${i + 1}`}
            {ans.aiConfidence < 80 && (
              <span className="ml-1 inline-block w-1.5 h-1.5 bg-tertiary-fixed-dim rounded-full" />
            )}
          </button>
        ))}
      </div>

      {currentAnswer && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
          {/* Left: Student scan */}
          <AnswerSheetViewer
            url={activeSubmission.fileUrl || activeSubmission.imagePreview}
            title={`Answer sheet · ${currentAnswer.questionLabel || 'Q' + (activeSubmission.answers.indexOf(currentAnswer) + 1)}`}
            className="h-[600px]"
          />

          {/* Right: OCR Text */}
          <div className="card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant bg-surface-bright">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">document_scanner</span>
                <span className="text-label-md font-semibold text-on-surface">AI OCR Extracted Text</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={getConfidenceClass(currentAnswer.aiConfidence)}>{currentAnswer.aiConfidence}%</span>
                {editingId === currentAnswer.questionId ? (
                  <>
                    <button onClick={() => setEditingId(null)} className="btn-ghost text-xs py-1 px-2">Cancel</button>
                    <button onClick={() => handleSave(currentAnswer.questionId)} className="btn-primary text-xs py-1 px-2">Save</button>
                  </>
                ) : (
                  <button onClick={() => setEditingId(currentAnswer.questionId)} className="btn-outline text-xs py-1 px-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    Edit
                  </button>
                )}
              </div>
            </div>

            {/* Question */}
            <div className="px-4 pt-4 pb-2 bg-primary-fixed/20 border-b border-outline-variant">
              <p className="text-label-sm text-primary uppercase tracking-wider mb-1">
                {currentAnswer.questionLabel || `Question ${activeSubmission.answers.indexOf(currentAnswer) + 1}`}
              </p>
              <p className="text-body-sm text-on-surface">{currentAnswer.questionText}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">Max marks: {currentAnswer.maxMarks}</p>
            </div>

            {/* OCR Text Area */}
            <div className="flex-1 p-4 overflow-y-auto">
              {editingId === currentAnswer.questionId ? (
                <textarea
                  value={editTexts[currentAnswer.questionId]}
                  onChange={e => setEditTexts(prev => ({ ...prev, [currentAnswer.questionId]: e.target.value }))}
                  className="input-field h-full w-full resize-none min-h-[250px] font-mono text-sm leading-relaxed"
                  placeholder="Edit OCR extracted text..."
                />
              ) : (
                <div className="text-body-md text-on-surface leading-relaxed whitespace-pre-wrap font-sans bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                  {editTexts[currentAnswer.questionId]}
                </div>
              )}
            </div>

            {currentAnswer.aiConfidence < 85 && (
              <div className="px-4 pb-4">
                <div className="bg-tertiary-fixed/50 border border-tertiary-fixed-dim rounded-lg p-3 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-tertiary-container mt-0.5">warning</span>
                  <p className="text-body-sm text-on-tertiary-fixed-variant">
                    OCR confidence is below 90%. Underlined words may be incorrect. Please review and correct before proceeding.
                  </p>
                </div>
              </div>
            )}

            {saved && (
              <div className="mx-4 mb-4 bg-secondary-fixed border border-secondary rounded-lg p-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                <span className="text-body-sm text-secondary font-medium">OCR text saved successfully</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Render the screen only once a submission is selected, so its hooks always run
export default function OCRReviewView() {
  const { activeSubmission, navigate } = useApp();

  useEffect(() => {
    if (!activeSubmission) navigate('exams');
  }, [activeSubmission, navigate]);

  if (!activeSubmission) return null;
  return <OCRReviewViewContent key={activeSubmission.id} />;
}
