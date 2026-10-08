import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SmartCheck AI Error Boundary Caught Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-6 text-on-surface">
          <div className="card max-w-lg w-full p-6 bg-surface-container-high border border-outline-variant shadow-modal text-center">
            <div className="w-14 h-14 rounded-full bg-error-container text-error flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>
            <h2 className="text-headline-md font-bold text-on-surface mb-2">Something went wrong</h2>
            <p className="text-body-sm text-on-surface-variant mb-4">
              An unexpected error occurred while rendering the application.
            </p>
            {this.state.error && (
              <div className="bg-surface-container-lowest text-error p-3 rounded-lg text-xs font-mono text-left mb-6 overflow-x-auto max-h-48 border border-outline-variant">
                {this.state.error.toString()}
              </div>
            )}
            <div className="flex justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="btn-primary"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
