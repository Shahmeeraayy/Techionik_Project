import React from 'react';
import { createCacheBustedUrl, hasRecentChunkRecoveryAttempt, isChunkLoadError, markChunkRecoveryAttempt } from '@/lib/chunk-loading';

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

    if (!isChunkLoadError(error) || typeof window === 'undefined') {
      return;
    }

    const recoveryKey = window.location.pathname;
    if (hasRecentChunkRecoveryAttempt(recoveryKey)) {
      return;
    }

    markChunkRecoveryAttempt(recoveryKey);
    window.setTimeout(() => {
      window.location.replace(createCacheBustedUrl('chunk-load-error'));
    }, 50);
  }

  private handleReload = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const recoveryKey = window.location.pathname;
    markChunkRecoveryAttempt(recoveryKey);
    window.location.replace(createCacheBustedUrl('manual-reload'));
  };

  render() {
    const { error } = this.state;

    if (error) {
      const isChunkError = isChunkLoadError(error);

      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-foreground">
              {isChunkError ? 'Refreshing the app' : 'Something went wrong'}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {isChunkError
                ? 'NexusOps detected a missing or stale module from a recent deployment. We are reloading a fresh copy so you do not need a hard refresh.'
                : 'The app hit an unexpected error while loading. You can reload the page to try again.'}
            </p>
            <pre className="mt-4 overflow-auto rounded-xl bg-muted p-4 text-sm text-foreground whitespace-pre-wrap break-words">
              {error.message}
            </pre>
            <button
              type="button"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
              onClick={this.handleReload}
            >
              {isChunkError ? 'Reload fresh copy' : 'Reload'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
