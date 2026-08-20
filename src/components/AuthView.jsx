import { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function AuthView() {
  const { login, signup, demoLogin } = useApp();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'login') {
      const res = await login(formData.email, formData.password);
      if (res?.error) {
        setError(res.error);
      }
    } else {
      if (!formData.name.trim()) {
        setError('Full Name is required');
        setLoading(false);
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      const res = await signup(formData.name, formData.email, formData.password);
      if (res?.error) {
        setError(res.error);
      }
    }
    setLoading(false);
  };

  const handleDemo = () => {
    demoLogin();
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-primary p-12 text-on-primary">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-on-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-[24px]">psychology</span>
          </div>
          <span className="text-xl font-bold">SmartCheckAI</span>
        </div>

        <div>
          <h1 className="text-5xl font-bold leading-tight mb-4">
            AI-Powered<br />Exam Evaluation<br />for Educators
          </h1>
          <p className="text-on-primary/80 text-lg leading-relaxed mb-8">
            Automatically evaluate handwritten student answers with AI, review OCR accuracy, and approve scores in minutes instead of hours.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: 'document_scanner', label: 'OCR Handwriting', desc: 'High-accuracy text extraction' },
              { icon: 'psychology', label: 'AI Evaluation', desc: 'Intelligent rubric-based scoring' },
              { icon: 'edit_note', label: 'Teacher Override', desc: 'Full control over every mark' },
              { icon: 'file_download', label: 'One-click Export', desc: 'CSV, PDF, LMS integration' },
            ].map(f => (
              <div key={f.label} className="flex items-start gap-2 bg-on-primary/10 rounded-xl p-3">
                <span className="material-symbols-outlined text-[20px] mt-0.5">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold">{f.label}</p>
                  <p className="text-xs text-on-primary/70">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-on-primary/50 text-sm">© 2026 SmartCheckAI · Connected to Supabase</p>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[18px]">psychology</span>
            </div>
            <span className="text-lg font-bold text-on-surface">SmartCheckAI</span>
          </div>

          <div className="mb-6">
            <h2 className="text-headline-lg font-bold text-on-surface">
              {mode === 'login' ? 'Teacher Sign In' : 'Create Teacher Account'}
            </h2>
            <p className="text-body-md text-on-surface-variant mt-1">
              {mode === 'login' ? 'Enter your Supabase credentials' : 'Register your teacher profile on Supabase'}
            </p>
          </div>

          {/* Demo Login */}
          <button
            type="button"
            onClick={handleDemo}
            className="w-full mb-4 p-3 border-2 border-primary rounded-xl flex items-center justify-center gap-2 text-primary font-semibold hover:bg-primary-fixed transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">bolt</span>
            Try Demo Mode (Sample Data)
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-outline-variant" />
            <span className="text-body-sm text-outline">or Supabase Auth</span>
            <div className="flex-1 h-px bg-outline-variant" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-label-md text-on-surface mb-1.5">Full Name *</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">person</span>
                  <input
                    type="text"
                    placeholder="Dr. Priya Sharma"
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    className="input-field pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-label-md text-on-surface mb-1.5">Email Address *</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">email</span>
                <input
                  type="email"
                  placeholder="teacher@school.edu"
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="input-field pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-label-md text-on-surface mb-1.5">Password *</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">lock</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                  className="input-field pl-10"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-error-container border border-error text-error rounded-lg p-3 text-body-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-60">
              {loading ? (
                <><span className="material-symbols-outlined text-[20px] animate-spin-slow">progress_activity</span> {mode === 'login' ? 'Authenticating...' : 'Creating Account...'}</>
              ) : (
                mode === 'login' ? 'Sign In with Supabase' : 'Create Account on Supabase'
              )}
            </button>
          </form>

          <p className="text-center text-body-sm text-on-surface-variant mt-5">
            {mode === 'login' ? "Don't have a Supabase account?" : 'Already registered on Supabase?'}
            {' '}
            <button
              type="button"
              onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); }}
              className="text-primary font-semibold hover:underline"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
