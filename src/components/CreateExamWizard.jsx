import { useState } from 'react';
import { useApp } from '../context/AppContext';

const STEPS = [
  { id: 1, label: 'Exam Details' },
  { id: 2, label: 'Answer Key & Rubric' },
  { id: 3, label: 'Upload Sheets' },
];

const SUBJECTS = ['Mathematics', 'Science', 'History', 'English', 'Geography', 'Economics', 'Computer Science', 'Physics', 'Chemistry', 'Biology'];
const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

export default function CreateExamWizard() {
  const { createExam, navigate, showNotification } = useApp();
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
    { id: 'q1', text: '', maxMarks: '', type: 'short', rubric: '' }
  ]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field, value) => setExamData(prev => ({ ...prev, [field]: value }));

  const addQuestion = () => {
    setQuestions(prev => [...prev, { id: `q${Date.now()}`, text: '', maxMarks: '', type: 'short', rubric: '' }]);
  };

  const removeQuestion = (id) => {
    if (questions.length === 1) return;
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const updateQuestion = (id, field, value) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const images = files.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    setUploadedFiles(prev => [...prev, ...images.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }))]);
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(prev => [...prev, ...files.map(f => ({
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
    await new Promise(r => setTimeout(r, 1500)); // Simulate upload
    createExam({
      ...examData,
      totalStudents: parseInt(examData.totalStudents) || 0,
      maxScore: questions.reduce((sum, q) => sum + (parseInt(q.maxMarks) || 0), 0),
      questions,
    });
    navigate('dashboard');
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
              <h2 className="text-headline-md font-semibold text-on-surface">Answer Key & Rubric</h2>
              <span className="text-label-sm text-on-surface-variant bg-surface-container px-2 py-1 rounded-full">
                Total: {questions.reduce((sum, q) => sum + (parseInt(q.maxMarks) || 0), 0)} marks
              </span>
            </div>

            <div className="space-y-4">
              {questions.map((q, index) => (
                <div key={q.id} className="border border-outline-variant rounded-xl p-4 bg-surface-container-low">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-label-sm font-semibold text-primary bg-primary-fixed px-2 py-0.5 rounded-full">Q{index + 1}</span>
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
                Creating Exam...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {uploadedFiles.length > 0 ? 'Create & Start AI Evaluation' : 'Create Exam'}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
