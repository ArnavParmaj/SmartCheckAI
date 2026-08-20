import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { mockStudentSubmissions } from '../data/mockData';

export default function ExportModal() {
  const { navigate, exams, showNotification } = useApp();
  const [selectedExam, setSelectedExam] = useState(exams[0]?.id || '');
  const [format, setFormat] = useState('csv');
  const [includeOptions, setIncludeOptions] = useState({
    scores: true,
    feedback: true,
    confidence: true,
    overrides: false,
  });
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 2000));
    setExporting(false);
    setDone(true);
    showNotification(`Gradebook exported as ${format.toUpperCase()} successfully!`, 'success');
    setTimeout(() => setDone(false), 3000);
  };

  const exam = exams.find(e => e.id === selectedExam);
  const subs = mockStudentSubmissions.filter(s => s.examId === selectedExam);

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('dashboard')} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <h1 className="text-headline-md font-bold text-on-surface">Export Results</h1>
          <p className="text-body-sm text-on-surface-variant">Download gradebooks and reports</p>
        </div>
      </div>

      <div className="card p-6 space-y-6">
        {/* Select exam */}
        <div>
          <label className="block text-label-md text-on-surface mb-2">Select Exam</label>
          <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="input-field">
            {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>

        {/* Exam preview */}
        {exam && (
          <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[32px] text-primary">description</span>
              <div>
                <p className="text-label-md font-bold text-on-surface">{exam.title}</p>
                <p className="text-body-sm text-on-surface-variant">{exam.subject} · {exam.grade} · {exam.totalStudents} students</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-headline-md font-bold text-on-surface">{subs.length}</p>
                <p className="text-[11px] text-on-surface-variant">submissions</p>
              </div>
            </div>
          </div>
        )}

        {/* Format selector */}
        <div>
          <label className="block text-label-md text-on-surface mb-3">Export Format</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'csv', label: 'CSV', icon: 'table_chart', desc: 'Excel/Sheets compatible' },
              { id: 'xlsx', label: 'Excel', icon: 'table_view', desc: 'Formatted spreadsheet' },
              { id: 'pdf', label: 'PDF Report', icon: 'picture_as_pdf', desc: 'Printable summary' },
              { id: 'json', label: 'JSON', icon: 'data_object', desc: 'For LMS/API sync' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`p-3 rounded-xl border-2 transition-all text-center ${
                  format === f.id
                    ? 'border-primary bg-primary-fixed/30'
                    : 'border-outline-variant hover:border-outline bg-surface-container-low'
                }`}
              >
                <span className={`material-symbols-outlined text-[28px] mb-1 ${format === f.id ? 'text-primary' : 'text-outline'}`}>{f.icon}</span>
                <p className={`text-label-md font-bold ${format === f.id ? 'text-primary' : 'text-on-surface'}`}>{f.label}</p>
                <p className="text-[11px] text-on-surface-variant">{f.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Include options */}
        <div>
          <label className="block text-label-md text-on-surface mb-3">Include in Export</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(includeOptions).map(([key, val]) => (
              <label key={key} className="flex items-center gap-2.5 p-3 bg-surface-container-low rounded-lg border border-outline-variant cursor-pointer hover:bg-surface-container-high transition-colors">
                <input
                  type="checkbox"
                  checked={val}
                  onChange={e => setIncludeOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                  className="w-4 h-4 accent-primary rounded"
                />
                <span className="text-body-sm text-on-surface capitalize">{key === 'confidence' ? 'AI Confidence Scores' : key === 'overrides' ? 'Teacher Overrides' : key === 'feedback' ? 'AI Feedback' : 'Scores'}</span>
              </label>
            ))}
          </div>
        </div>

        {/* LMS Integration */}
        <div className="border border-outline-variant rounded-xl p-4">
          <p className="text-label-md font-semibold text-on-surface mb-3">LMS Integration</p>
          <div className="grid grid-cols-2 gap-2">
            {['Google Classroom', 'Canvas LMS', 'Moodle', 'Blackboard'].map(lms => (
              <button key={lms} className="flex items-center gap-2 p-2.5 bg-surface-container-low rounded-lg border border-outline-variant hover:border-primary hover:bg-primary-fixed/20 transition-all text-sm text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined text-[18px]">sync</span>
                {lms}
              </button>
            ))}
          </div>
        </div>

        {/* Export button */}
        {done ? (
          <div className="flex items-center gap-3 p-4 bg-secondary-fixed border border-secondary rounded-xl">
            <span className="material-symbols-outlined text-secondary text-[24px]">check_circle</span>
            <div>
              <p className="text-label-md font-bold text-secondary">Export Complete!</p>
              <p className="text-body-sm text-secondary/80">Your file has been downloaded successfully.</p>
            </div>
          </div>
        ) : (
          <button onClick={handleExport} disabled={exporting || !selectedExam} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50">
            {exporting ? (
              <><span className="material-symbols-outlined text-[20px] animate-spin-slow">progress_activity</span> Generating {format.toUpperCase()}...</>
            ) : (
              <><span className="material-symbols-outlined text-[20px]">file_download</span> Export as {format.toUpperCase()}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
