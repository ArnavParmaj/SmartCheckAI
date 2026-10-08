import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { processAnswerSheetOCR, extractQuestionsFromFile, extractRubricFromFile } from '../lib/backendApi';

const STEPS = [
  { id: 1, label: 'Exam Details' },
  { id: 2, label: 'Answer Key & Rubric' },
  { id: 3, label: 'Upload Sheets' },
];

const SUBJECTS = ['Mathematics', 'Science', 'History', 'English', 'Geography', 'Economics', 'Computer Science', 'Physics', 'Chemistry', 'Biology'];
const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

export default function CreateExamWizard() {
  const { createExam, navigate, showNotification, addSubmission, setActiveSubmission, setActiveExam } = useApp();
  const [step, setStep] = useState(1);
  const [examData, setExamData] = useState({
    title: '',
    subject: '',
    grade: '',
    totalStudents: '',
    maxScore: '',
    dateCreated: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [questions, setQuestions] = useState([
    { id: 'q1', label: 'Q1', text: '', maxMarks: '', type: 'short', rubric: '' }
  ]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
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
    setQuestions(prev => [...prev, { id: `q${Date.now()}`, label: `Q${nextNum}`, text: '', maxMarks: '', type: 'short', rubric: '' }]);
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
      showNotification(`Analyzing question paper "${file.name}" with AI Vision...`, 'info');
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
        rubric: questions[idx]?.rubric || '',
      }));

      setQuestions(newQuestions);
      const engineLabel = res.engine === 'gemini-2.5-flash' ? 'Gemini 2.5 Flash Vision' : 'Local RapidOCR Engine';
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
      showNotification(`Analyzing rubric document "${file.name}" with AI Vision...`, 'info');
      const res = await extractRubricFromFile(file);
      const rubrics = res?.rubrics || [];

      if (rubrics.length === 0) {
        showNotification('No clear rubric criteria detected in file.', 'warning');
        return;
      }

      setQuestions(prev => {
        return prev.map((q, idx) => {
          const match = rubrics.find(r => r.question_id === q.label || r.question_id === `Q${idx + 1}`) || rubrics[idx];
          if (match) {
            const desc = match.description ? `Criteria: ${match.criterion || ''}\n${match.description}` : (match.criterion || '');
            return { ...q, rubric: desc };
          }
          return q;
        });
      });

      const engineLabel = res.engine === 'gemini-2.5-flash' ? 'Gemini 2.5 Flash Vision' : 'Local RapidOCR Engine';
      showNotification(`Grading rubrics successfully attached using ${engineLabel}!`, 'success');
    } catch (err) {
      console.error('Rubric scan error:', err);
      showNotification(`Failed to scan rubric: ${err.message}`, 'error');
    } finally {
      setIsProcessingRubric(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const images = files.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    setUploadedFiles(prev => [...prev, ...images.map(f => ({
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }))]);
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(prev => [...prev, ...files.map(f => ({
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }))]);
  };

  const canProceedStep1 = examData.title && examData.subject && examData.grade;
  const canProceedStep2 = questions.every(q => q.text && q.maxMarks);

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      setSubmittingStatus('Saving exam details...');
      const createdExam = await createExam({
        ...examData,
        totalStudents: uploadedFiles.length || parseInt(examData.totalStudents) || 1,
        maxScore: questions.reduce((sum, q) => sum + (parseInt(q.maxMarks) || 0), 0) || 20,
        questions,
      });

      if (uploadedFiles.length > 0) {
        let firstProcessedSubmission = null;

        for (let i = 0; i < uploadedFiles.length; i++) {
          const fileItem = uploadedFiles[i];
          setSubmittingStatus(`Extracting text with AI OCR for "${fileItem.name}" (${i + 1}/${uploadedFiles.length})...`);

          let ocrRes = null;
          try {
            ocrRes = await processAnswerSheetOCR(fileItem.file);
          } catch (err) {
            console.error('OCR process error:', err);
            showNotification(`OCR notice: ${err.message}`, 'warning');
          }

          const rawAnswers = ocrRes?.answers || {};
          const confidence = ocrRes?.ocr_confidence ? Math.round(ocrRes.ocr_confidence * 100) : 94;
          const answerEntries = Object.entries(rawAnswers);

          const submissionAnswers = answerEntries.length > 0
            ? answerEntries.map(([qKey, ansText], aIdx) => {
                const matchedQ = questions.find(q => q.label === qKey) || questions[aIdx];
                return {
                  questionId: matchedQ?.id || `q-${aIdx + 1}`,
                  questionNum: aIdx + 1,
                  questionLabel: qKey,
                  questionText: matchedQ?.text || `Question ${qKey}`,
                  maxMarks: parseInt(matchedQ?.maxMarks) || 5,
                  ocrText: ansText,
                  aiConfidence: confidence,
                  aiScore: null,
                  teacherScore: null,
                };
              })
            : questions.map((q, qIdx) => ({
                questionId: q.id,
                questionNum: qIdx + 1,
                questionLabel: q.label || `Q${qIdx + 1}`,
                questionText: q.text,
                maxMarks: parseInt(q.maxMarks) || 5,
                ocrText: 'No text extracted',
                aiConfidence: 0,
                aiScore: null,
                teacherScore: null,
              }));

          const submission = {
            id: `sub-${Date.now()}-${i}`,
            examId: createdExam.id,
            studentName: fileItem.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
            rollNumber: `ROLL-${101 + i}`,
            submittedAt: new Date().toISOString(),
            status: 'OCR Completed',
            ocrAccuracy: confidence,
            aiScore: null,
            teacherScore: null,
            teacherApproved: false,
            fileUrl: fileItem.preview,
            imagePreview: fileItem.preview,
            answers: submissionAnswers,
          };

          addSubmission(submission);
          if (!firstProcessedSubmission) {
            firstProcessedSubmission = submission;
          }
        }

        showNotification('OCR completed! Reviewing extracted text below.', 'success');
        if (firstProcessedSubmission) {
          setActiveExam(createdExam);
          setActiveSubmission(firstProcessedSubmission);
          navigate('ocr-review', { exam: createdExam, submission: firstProcessedSubmission });
          return;
        }
      }

      navigate('dashboard');
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
          <p className="text-body-sm text-on-surface-variant">Set up your exam in 3 easy steps</p>
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
                placeholder="e.g., Mid-term Algebra Test"
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-label-md text-on-surface mb-1.5">Subject *</label>
                <select value={examData.subject} onChange={e => updateField('subject', e.target.value)} className="input-field">
                  <option value="">Select Subject</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-label-md text-on-surface mb-1.5">Grade / Class *</label>
                <select value={examData.grade} onChange={e => updateField('grade', e.target.value)} className="input-field">
                  <option value="">Select Grade</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
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
                      <label className="text-label-md text-on-surface block mb-1">Grading Rubric (optional)</label>
                      <input
                        value={q.rubric}
                        onChange={e => updateQuestion(q.id, 'rubric', e.target.value)}
                        placeholder="e.g., 2 marks for formula, 3 marks for working, 5 marks for correct answer"
                        className="input-field"
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
          <div className="animate-fadeIn">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4">Upload Student Answer Sheets</h2>
            <p className="text-body-sm text-on-surface-variant mb-4">Upload scanned images or PDFs of student handwritten answer sheets. AI will perform OCR and evaluation.</p>

            {/* Upload Zone */}
            <div
              className={`upload-zone mb-4 ${isDragging ? 'active' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <span className="material-symbols-outlined text-[48px] text-outline mb-3">cloud_upload</span>
              <p className="text-body-md font-medium text-on-surface mb-1">Drag & drop files here</p>
              <p className="text-body-sm text-on-surface-variant mb-3">Supports JPG, PNG, PDF (up to 50MB per file)</p>
              <label className="btn-primary cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                Browse Files
                <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleFileInput} />
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <div>
                <p className="text-label-md text-on-surface mb-2">{uploadedFiles.length} file(s) ready to upload</p>
                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                  {uploadedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant">
                      {file.preview
                        ? <img src={file.preview} alt={file.name} className="w-10 h-10 object-cover rounded" />
                        : <span className="material-symbols-outlined text-outline text-[32px]">picture_as_pdf</span>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-label-md text-on-surface truncate">{file.name}</p>
                        <p className="text-[11px] text-on-surface-variant">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button onClick={() => setUploadedFiles(prev => prev.filter((_, j) => j !== i))} className="text-on-surface-variant hover:text-error">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadedFiles.length === 0 && (
              <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant">
                <p className="text-label-md text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-tertiary-container">info</span>
                  You can also skip this step and upload sheets later from the exam detail page.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-4 gap-3">
        <button
          onClick={() => step === 1 ? navigate('dashboard') : setStep(s => s - 1)}
          className="btn-ghost flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {step === 1 ? 'Cancel' : 'Back'}
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={isSubmitting}
            className="btn-primary disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin-slow">progress_activity</span>
                {submittingStatus || 'Processing with AI OCR...'}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {uploadedFiles.length > 0 ? 'Run AI OCR & Review' : 'Create Exam'}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
