import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { mockStudentSubmissions, getStatusColor, getConfidenceClass } from '../data/mockData';
import { needsFacultyReview } from '../lib/grading';
import { openStudentReports } from '../lib/exportResults';

export default function ExamDetailView() {
  const { activeExam, navigate, deleteExam, getSubmissionsForExam, showNotification } = useApp();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!activeExam) {
    navigate('exams');
    return null;
  }

  const liveSubs = getSubmissionsForExam ? getSubmissionsForExam(activeExam.id) : [];
  const submissions = liveSubs.length > 0 ? liveSubs : mockStudentSubmissions.filter(s => s.examId === activeExam.id);
  const graded = submissions.filter(s => s.aiScore !== null && s.aiScore !== undefined);
  const reviewCount = submissions.reduce((n, s) => n + (s.answers || []).filter(needsFacultyReview).length, 0);

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('exams')} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-headline-md font-bold text-on-surface">{activeExam.title}</h1>
            <span className={getStatusColor(activeExam.status)}>{activeExam.status}</span>
          </div>
          <p className="text-body-sm text-on-surface-variant">{[activeExam.subject, activeExam.semester, activeExam.dateCreated].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('export')} className="btn-outline hidden sm:flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">file_download</span>
            Export
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="btn-outline text-error hover:bg-error-container hover:border-error flex items-center gap-1 transition-colors"
            title="Delete this exam"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Delete Exam
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Students', value: activeExam.totalStudents, icon: 'group' },
          { label: 'Evaluated', value: activeExam.submissionsEvaluated, icon: 'fact_check' },
          { label: 'Avg Score', value: activeExam.avgScore !== null && activeExam.avgScore !== undefined ? `${activeExam.avgScore}%` : '—', icon: 'grade' },
          { label: 'Pending Review', value: activeExam.pendingReview, icon: 'pending_actions' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <span className="material-symbols-outlined text-[24px] text-primary mb-1">{s.icon}</span>
            <p className="text-headline-md font-bold text-on-surface">{s.value}</p>
            <p className="text-[11px] text-on-surface-variant">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => navigate('upload-sheets', { exam: activeExam })} className="btn-primary text-sm">
          <span className="material-symbols-outlined text-[18px]">grading</span>
          Evaluate Papers
        </button>
        <button onClick={() => navigate('review-queue', { exam: activeExam })} className="btn-outline text-sm flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">rule</span>
          Review Queue
          {reviewCount > 0 && <span className="ml-1 text-[11px] font-bold bg-tertiary-container text-on-tertiary-container rounded-full px-1.5">{reviewCount}</span>}
        </button>
        <button onClick={() => navigate('class-analysis', { exam: activeExam })} disabled={graded.length === 0} className="btn-outline text-sm flex items-center gap-1 disabled:opacity-50">
          <span className="material-symbols-outlined text-[18px]">insights</span>
          Class Analysis
        </button>
        <button
          onClick={() => openStudentReports(activeExam, graded) || showNotification('Allow pop-ups for this site to download reports.', 'warning')}
          disabled={graded.length === 0}
          className="btn-outline text-sm flex items-center gap-1 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
          All Student Reports
        </button>
      </div>

      {/* Submissions Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant">
          <h2 className="text-headline-md font-semibold text-on-surface">Student Submissions</h2>
        </div>
        {submissions.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] text-outline mb-3 block">inbox</span>
            <p className="text-body-md font-medium text-on-surface mb-1">No submissions yet</p>
            <p className="text-body-sm">Upload student answer sheets and they will be graded against your answer key.</p>
            <button onClick={() => navigate('upload-sheets', { exam: activeExam })} className="btn-primary mt-4 mx-auto">
              <span className="material-symbols-outlined text-[18px]">grading</span>
              Evaluate Papers
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="bg-surface-bright border-b border-outline-variant">
                  <th className="text-label-sm text-on-surface-variant py-3 px-5 uppercase tracking-wider">Student</th>
                  <th className="text-label-sm text-on-surface-variant py-3 px-5 uppercase tracking-wider">Score</th>
                  <th className="text-label-sm text-on-surface-variant py-3 px-5 uppercase tracking-wider">AI Confidence</th>
                  <th className="text-label-sm text-on-surface-variant py-3 px-5 uppercase tracking-wider">Status</th>
                  <th className="text-label-sm text-on-surface-variant py-3 px-5 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {submissions.map(sub => (
                  <tr key={sub.id} className="table-row">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center flex-shrink-0">
                          <span className="text-primary text-xs font-bold">{sub.studentName.split(' ').map(n => n[0]).join('')}</span>
                        </div>
                        <div>
                          <p className="text-label-md font-semibold text-on-surface">{sub.studentName}</p>
                          <p className="text-[11px] text-on-surface-variant">{sub.rollNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <div className={`score-circle w-10 h-10 text-sm border-2 ${sub.percentage >= 75 ? 'border-secondary text-secondary' : sub.percentage >= 50 ? 'border-tertiary-container text-tertiary-container' : 'border-error text-error'}`}>
                          {sub.percentage}%
                        </div>
                        <span className="text-body-sm text-on-surface-variant">{sub.totalScore}/{sub.maxScore}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <span className={getConfidenceClass(sub.aiConfidence)}>{sub.aiConfidence}%</span>
                    </td>
                    <td className="py-4 px-5">
                      <span className={getStatusColor(sub.status)}>{sub.status}</span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => navigate('ocr-review', { exam: activeExam, submission: sub })}
                          className="btn-ghost text-xs py-1 px-2"
                        >
                          OCR
                        </button>
                        <button
                          onClick={() => navigate('review-approve', { exam: activeExam, submission: sub })}
                          className="btn-outline text-xs"
                        >
                          {sub.teacherApproved ? 'View' : 'Review'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="card p-6 max-w-md w-full shadow-modal bg-surface-container-high border border-outline-variant">
            <div className="flex items-center gap-3 mb-3 text-error">
              <span className="material-symbols-outlined text-[28px]">warning</span>
              <h3 className="text-headline-sm font-bold text-on-surface">Delete Exam?</h3>
            </div>
            <p className="text-body-sm text-on-surface-variant mb-6">
              Are you sure you want to permanently delete <strong>&quot;{activeExam.title}&quot;</strong>? All associated questions, rubrics, student answer sheets, and grading records will be deleted from the database. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setIsDeleting(true);
                  await deleteExam(activeExam.id);
                }}
                disabled={isDeleting}
                className="btn-primary bg-error hover:bg-error/90 text-on-error flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    Yes, Delete Exam
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
