import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Unhandled application error:', error, errorInfo.componentStack);
  }

  render() {
    const { error } = this.state;

    if (error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              The app hit an unexpected error while loading. You can reload the page to try again.
            </p>
            <pre className="mt-4 overflow-auto rounded-xl bg-muted p-4 text-sm text-foreground whitespace-pre-wrap break-words">
              {error.message}
            </pre>
            <button
              type="button"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
