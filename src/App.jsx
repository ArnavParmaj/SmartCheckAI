import { useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Toast from './components/Toast';
import AuthView from './components/AuthView';
import DashboardView from './components/DashboardView';
import ExamsView from './components/ExamsView';
import ExamDetailView from './components/ExamDetailView';
import EvaluatePapersView from './components/EvaluatePapersView';
import ReviewQueueView from './components/ReviewQueueView';
import ClassAnalysisView from './components/ClassAnalysisView';
import CreateExamWizard from './components/CreateExamWizard';
import OCRReviewView from './components/OCRReviewView';
import ReviewApproveView from './components/ReviewApproveView';
import AuditTrailView from './components/AuditTrailView';
import ExportView from './components/ExportView';
import ResultsView from './components/ResultsView';
import ProfileView from './components/ProfileView';

function AppShell() {
  const { currentView } = useApp();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:ml-64 min-h-screen">
        <TopBar />

        {/* Page content */}
        <main className="flex-1 pt-14 px-4 md:px-6 py-6 max-w-[1280px] w-full mx-auto">
          {currentView === 'dashboard' && <DashboardView />}
          {currentView === 'exams' && <ExamsView />}
          {currentView === 'exam-detail' && <ExamDetailView />}
          {currentView === 'create-exam' && <CreateExamWizard />}
          {currentView === 'upload-sheets' && <EvaluatePapersView />}
          {currentView === 'review-queue' && <ReviewQueueView />}
          {currentView === 'class-analysis' && <ClassAnalysisView />}
          {currentView === 'ocr-review' && <OCRReviewView />}
          {currentView === 'review-approve' && <ReviewApproveView />}
          {currentView === 'results' && <ResultsView />}
          {currentView === 'audit' && <AuditTrailView />}
          {currentView === 'export' && <ExportView />}
          {currentView === 'settings' && <ProfileView />}
        </main>
      </div>

      <Toast />
    </div>
  );
}

export default function App() {
  const { isAuthenticated, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-body-sm text-on-surface-variant font-medium">Loading SmartCheck AI...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <AuthView />;

  return <AppShell />;
}
