import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { extractQuestionsFromFile, extractRubricFromFile } from '../lib/backendApi';
import AnswerKeyStep from './AnswerKeyStep';
import KnowledgeReviewStep from './KnowledgeReviewStep';
import CriteriaEditor from './CriteriaEditor';
import { PROGRAM, SUBJECTS, SEMESTERS, DEFAULT_SUBJECT, DEFAULT_SEMESTER } from '../lib/academics';

const STEPS = [
  { id: 1, label: 'Exam Details' },
  { id: 2, label: 'Questions & Rubric' },
  { id: 3, label: 'Answer Key' },
  { id: 4, label: 'Review Knowledge' },
];


// How a printed document was read, for notifications (everything runs on this computer)
function engineName(engine = '') {
  const parts = [];
  if (engine.includes('local-text')) parts.push('typed text');
  if (engine.includes('rapidocr')) parts.push('PaddleOCR');
  if (engine.includes('ollama')) parts.push('local Qwen');
  return parts.join(' + ') || engine || 'local OCR';
}

export default function CreateExamWizard() {
  const { createExam, navigate, showNotification } = useApp();
  const [step, setStep] = useState(1);
  const [examData, setExamData] = useState({
    title: '',
    subject: DEFAULT_SUBJECT,
    semester: DEFAULT_SEMESTER,
    totalStudents: '',
    maxScore: '',
    dateCreated: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [questions, setQuestions] = useState([
    { id: 'q1', label: 'Q1', text: '', maxMarks: '', type: 'short', criteria: [] }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingStatus, setSubmittingStatus] = useState('');

  // Step 2 Question Paper and Rubric Upload States
  const [isProcessingQuestionPaper, setIsProcessingQuestionPaper] = useState(false);
  const [isProcessingRubric, setIsProcessingRubric] = useState(false);
  const [questionPaperFileName, setQuestionPaperFileName] = useState('');
  const [rubricFileName, setRubricFileName] = useState('');

  const updateField = (field, value) => setExamData(prev => ({ ...prev, [field]: value }));

  const addQuestion = () => {
    const nextNum = questions.length + 1;
    setQuestions(prev => [...prev, { id: `q${Date.now()}`, label: `Q${nextNum}`, text: '', maxMarks: '', type: 'short', criteria: [] }]);
  };

  const removeQuestion = (id) => {
    if (questions.length === 1) return;
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const updateQuestion = (id, field, value) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  // Handler for uploading Question Paper to auto-populate questions and marks
  const handleQuestionPaperUpload = async (file) => {
    if (!file) return;
    setIsProcessingQuestionPaper(true);
    setQuestionPaperFileName(file.name);
    try {
      showNotification(`Reading question paper "${file.name}"...`, 'info');
      const res = await extractQuestionsFromFile(file);
      const extractedList = res?.questions || [];

      if (extractedList.length === 0) {
        showNotification('No clear questions detected in this file. Please check file or type manually.', 'warning');
        return;
      }

      // Convert extracted questions into wizard questions
      const newQuestions = extractedList.map((item, idx) => ({
        id: `q-${Date.now()}-${idx + 1}`,
        num: idx + 1,
        label: item.id || `Q${idx + 1}`,
        text: item.text || '',
        maxMarks: String(item.marks || 5),
        type: (item.text || '').length > 120 ? 'long' : 'short',
        condition: item.condition || null,
        criteria: questions[idx]?.criteria || [],
      }));

      setQuestions(newQuestions);
      const engineLabel = engineName(res.engine);
      showNotification(`Extracted ${newQuestions.length} questions using ${engineLabel}!`, 'success');
    } catch (err) {
      console.error('Question paper extraction failed:', err);
      showNotification(`Failed to scan question paper: ${err.message}`, 'error');
    } finally {
      setIsProcessingQuestionPaper(false);
    }
  };

  // Handler for uploading Marking Scheme / Rubric to auto-populate criteria
  const handleRubricUpload = async (file) => {
    if (!file) return;
    setIsProcessingRubric(true);
    setRubricFileName(file.name);
    try {
      showNotification(`Reading rubric "${file.name}"... (scanned rubrics take a minute or two)`, 'info');
      const res = await extractRubricFromFile(file);
      const rubrics = res?.rubrics || [];

      if (rubrics.length === 0) {
        showNotification('No clear rubric criteria detected in file.', 'warning');
        return;
      }

      // Rubric rows: marked criteria per question, deduction rules per question, and
      // general guidelines that apply to every question
      const norm = (label) => String(label || '').replace(/\s+/g, '').toUpperCase();
      const kind = (r) => r.type || 'criterion';
      const guidelines = rubrics.filter(r => kind(r) === 'guideline').map(r => r.description || r.criterion).filter(Boolean);
      setQuestions(prev => prev.map(q => {
        const rows = rubrics.filter(r => norm(r.question_id) === norm(q.label));
        const criteriaRows = rows.filter(r => kind(r) === 'criterion');
        const deductions = rows.filter(r => kind(r) === 'deduction').map(r => r.description || r.criterion).filter(Boolean);
        return {
          ...q,
          criteria: criteriaRows.length
            ? criteriaRows.map(r => ({ criterion: r.criterion || '', description: r.description || '', marks: r.max_marks ?? '' }))
            : q.criteria,
          rules: [...guidelines, ...deductions],
        };
      }));
      const unmatched = rubrics.filter(r => kind(r) !== 'guideline' && !questions.some(q => norm(q.label) === norm(r.question_id)));
      if (unmatched.length) {
        showNotification(`${unmatched.length} rubric row(s) didn't match a question label; add them by hand if needed.`, 'warning');
      }

      const engineLabel = engineName(res.engine);
      showNotification(`Rubric attached (${engineLabel}): ${rubrics.filter(r => kind(r) === 'criterion').length} criteria, ${rubrics.filter(r => kind(r) !== 'criterion').length} marking rules.`, 'success');
    } catch (err) {
      console.error('Rubric scan error:', err);
      showNotification(`Failed to scan rubric: ${err.message}`, 'error');
    } finally {
      setIsProcessingRubric(false);
    }
  };

  const canProceedStep1 = examData.title && examData.subject && examData.semester;
  const canProceedStep2 = questions.every(q => q.text && q.maxMarks);

  const canProceedStep3 = questions.some(q => q.modelAnswer?.trim());
  const canFinish = questions.every(q => q.modelAnswer?.trim());

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      setSubmittingStatus('Saving exam and knowledge base...');
      const createdExam = await createExam({
        ...examData,
        totalStudents: parseInt(examData.totalStudents) || 0,
        maxScore: questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 0), 0) || 20,
        questions: questions.map(q => ({
          ...q,
          criteria: (q.criteria || []).map(c => ({ ...c, marks: Number(c.marks) || 0 })),
        })),
      });
      navigate('exam-detail', { exam: createdExam });
    } catch (err) {
      console.error('Error in exam wizard:', err);
      showNotification('Error creating exam: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
      setSubmittingStatus('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('dashboard')} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <h1 className="text-headline-md font-bold text-on-surface">Create New Exam</h1>
          <p className="text-body-sm text-on-surface-variant">Question paper, rubric and your answer key: the system grades student papers against these</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="card p-4 mb-5">
        <div className="flex items-center">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div className={`step-pill ${step > s.id ? 'completed' : step === s.id ? 'active' : 'inactive'}`}>
                  {step > s.id
                    ? <span className="material-symbols-outlined text-[16px]">check</span>
                    : s.id
                  }
                </div>
                <span className={`text-xs font-medium hidden sm:block ${step === s.id ? 'text-primary' : step > s.id ? 'text-secondary' : 'text-on-surface-variant'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 rounded-full ${step > s.id ? 'bg-secondary' : 'bg-outline-variant'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="card p-6">
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4">Exam Details</h2>

            <div>
              <label className="block text-label-md text-on-surface mb-1.5">Exam Title *</label>
              <input
                value={examData.title}
                onChange={e => updateField('title', e.target.value)}
                placeholder="e.g., BDA Unit Test 1"
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-label-md text-on-surface mb-1.5" htmlFor="exam-subject">Subject *</label>
                <select id="exam-subject" value={examData.subject} onChange={e => updateField('subject', e.target.value)} className="input-field">
                  {SUBJECTS.map(s => (
                    <option key={s.value} value={s.value} disabled={!s.available}>
                      {s.available ? s.value : `${s.value} (coming soon)`}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-on-surface-variant mt-1">{PROGRAM}. More engineering subjects are coming soon.</p>
              </div>
              <div>
                <label className="block text-label-md text-on-surface mb-1.5" htmlFor="exam-semester">Semester *</label>
                <select id="exam-semester" value={examData.semester} onChange={e => updateField('semester', e.target.value)} className="input-field">
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-label-md text-on-surface mb-1.5">Number of Students</label>
                <input
                  type="number"
                  value={examData.totalStudents}
                  onChange={e => updateField('totalStudents', e.target.value)}
                  placeholder="e.g., 30"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-label-md text-on-surface mb-1.5">Exam Date</label>
                <input
                  type="date"
                  value={examData.dateCreated}
                  onChange={e => updateField('dateCreated', e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-label-md text-on-surface mb-1.5">Description (optional)</label>
              <textarea
                value={examData.description}
                onChange={e => updateField('description', e.target.value)}
                placeholder="Additional notes about this exam..."
                rows={3}
                className="input-field resize-none"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-headline-md font-semibold text-on-surface">Answer Key & Rubric</h2>
                <p className="text-body-sm text-on-surface-variant text-xs mt-0.5">
                  Upload your documents for AI auto-extraction, or enter questions manually below.
                </p>
              </div>
              <span className="text-label-sm text-on-surface-variant bg-surface-container px-3 py-1 rounded-full font-medium">
                Total: {questions.reduce((sum, q) => sum + (parseInt(q.maxMarks) || 0), 0)} marks
              </span>
            </div>

            {/* AI Document Upload Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Question Paper Upload Card */}
              <div className="border-2 border-dashed border-primary/30 hover:border-primary/70 bg-primary-fixed/10 hover:bg-primary-fixed/20 rounded-xl p-4 transition-all">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-primary rounded-xl text-on-primary flex-shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-[22px]">assignment</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-label-md font-bold text-on-surface">Upload Question Paper</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5 leading-snug">
                      Auto-detects Q1, Q2, Q3, questions & marks
                    </p>

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <label className="btn-primary text-xs py-1.5 px-3 cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
                        {isProcessingQuestionPaper ? (
                          <>
                            <span className="material-symbols-outlined text-[16px] animate-spin-slow">progress_activity</span>
                            Scanning Paper...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[16px]">upload_file</span>
                            Browse Question Paper
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          disabled={isProcessingQuestionPaper}
                          onChange={e => e.target.files?.[0] && handleQuestionPaperUpload(e.target.files[0])}
                        />
                      </label>
                      {questionPaperFileName && (
                        <span className="text-xs text-primary font-medium bg-primary-fixed/40 px-2 py-0.5 rounded-md truncate max-w-[160px]" title={questionPaperFileName}>
                          ✓ {questionPaperFileName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rubric / Marking Scheme Upload Card */}
              <div className="border-2 border-dashed border-secondary/30 hover:border-secondary/70 bg-secondary-fixed/10 hover:bg-secondary-fixed/20 rounded-xl p-4 transition-all">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-secondary rounded-xl text-on-secondary flex-shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-[22px]">fact_check</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-label-md font-bold text-on-surface">Upload Marking Rubric</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5 leading-snug">
                      Auto-fills grading criteria & model answers
                    </p>

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <label className="btn-secondary text-xs py-1.5 px-3 cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
                        {isProcessingRubric ? (
                          <>
                            <span className="material-symbols-outlined text-[16px] animate-spin-slow">progress_activity</span>
                            Scanning Rubric...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[16px]">upload_file</span>
                            Browse Rubric File
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          disabled={isProcessingRubric}
                          onChange={e => e.target.files?.[0] && handleRubricUpload(e.target.files[0])}
                        />
                      </label>
                      {rubricFileName && (
                        <span className="text-xs text-secondary font-medium bg-secondary-fixed/40 px-2 py-0.5 rounded-md truncate max-w-[160px]" title={rubricFileName}>
                          ✓ {rubricFileName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Active processing indicator banner */}
            {(isProcessingQuestionPaper || isProcessingRubric) && (
              <div className="mb-4 p-3 bg-primary-fixed/30 border border-primary/20 rounded-xl flex items-center gap-2.5 text-primary animate-pulse">
                <span className="material-symbols-outlined text-[20px] animate-spin-slow">memory</span>
                <span className="text-body-sm font-medium">
                  {isProcessingQuestionPaper ? 'Running AI OCR on question paper: deskewing, recognizing text & extracting questions...' : 'Running AI OCR on rubric file: extracting marking criteria...'}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between mb-3 pt-2 border-t border-outline-variant">
              <span className="text-label-md font-medium text-on-surface-variant">
                Questions List ({questions.length})
              </span>
              <span className="text-xs text-on-surface-variant">
                Edit below or add more questions
              </span>
            </div>

            <div className="space-y-4">
              {questions.map((q, index) => (
                <div key={q.id} className="border border-outline-variant rounded-xl p-4 bg-surface-container-low">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={q.label || `Q${index + 1}`}
                        onChange={e => updateQuestion(q.id, 'label', e.target.value)}
                        className="text-label-sm font-bold text-primary bg-primary-fixed border border-primary/20 hover:border-primary focus:border-primary px-2.5 py-0.5 rounded-full w-24 text-center focus:outline-none focus:ring-1 focus:ring-primary shadow-xs transition-all cursor-pointer focus:cursor-text"
                        title="Question label (click to edit, e.g. Q1(a), Q1(b))"
                      />
                      {q.condition && (
                        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                          {q.condition}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeQuestion(q.id)}
                      disabled={questions.length === 1}
                      className="p-1 rounded-lg text-on-surface-variant hover:bg-error-container hover:text-error transition-colors disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-label-md text-on-surface block mb-1">Question Text *</label>
                      <textarea
                        value={q.text}
                        onChange={e => updateQuestion(q.id, 'text', e.target.value)}
                        placeholder="Enter the question..."
                        rows={2}
                        className="input-field resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-label-md text-on-surface block mb-1">Max Marks *</label>
                        <input
                          type="number"
                          value={q.maxMarks}
                          onChange={e => updateQuestion(q.id, 'maxMarks', e.target.value)}
                          placeholder="e.g., 10"
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="text-label-md text-on-surface block mb-1">Question Type</label>
                        <select value={q.type} onChange={e => updateQuestion(q.id, 'type', e.target.value)} className="input-field">
                          <option value="short">Short Answer</option>
                          <option value="long">Long Answer</option>
                          <option value="mcq">MCQ</option>
                          <option value="essay">Essay</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-label-md text-on-surface block mb-1">Marking criteria</label>
                      <CriteriaEditor
                        criteria={q.criteria || []}
                        maxMarks={q.maxMarks}
                        onChange={criteria => updateQuestion(q.id, 'criteria', criteria)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addQuestion} className="mt-4 w-full border-2 border-dashed border-outline-variant rounded-xl p-3 text-on-surface-variant hover:border-primary hover:text-primary hover:bg-primary-fixed/20 transition-all flex items-center justify-center gap-2 text-sm font-medium">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Question
            </button>
          </div>
        )}

        {step === 3 && (
          <AnswerKeyStep questions={questions} setQuestions={setQuestions} showNotification={showNotification} />
        )}

        {step === 4 && (
          <KnowledgeReviewStep questions={questions} setQuestions={setQuestions} showNotification={showNotification} />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-4 gap-3">
        <button
          onClick={() => (step === 1 ? navigate('dashboard') : setStep(s => s - 1))}
          className="btn-ghost flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {step === 1 ? 'Cancel' : 'Back'}
        </button>

        {step < 4 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={step === 1 ? !canProceedStep1 : step === 2 ? !canProceedStep2 : !canProceedStep3}
            title={step === 3 && !canProceedStep3 ? 'Build the knowledge base from the answer key first' : undefined}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={isSubmitting || !canFinish}
            className="btn-primary disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin-slow">progress_activity</span>
                {submittingStatus || 'Saving...'}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Create Exam
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
