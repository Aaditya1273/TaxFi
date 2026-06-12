/**
 * TaxFi — ErrorBoundary Component
 *
 * Catches unhandled React errors and shows a friendly fallback UI
 * with the option to retry. Wraps the entire app in the root layout.
 */

'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    console.error('[TaxFi] ErrorBoundary caught an error:', error, errorInfo);

    this.props.onError?.(error, errorInfo);

    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      try {
        const payload = {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          url: typeof window !== 'undefined' ? window.location.href : '',
          timestamp: new Date().toISOString(),
        };
        fetch('/api/log-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch {
        // Silently fail
      }
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
          <div className="max-w-md w-full space-y-6 text-center">
            {/* Error icon */}
            <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
              <p className="text-gray-400 text-sm mb-4">
                TaxFi encountered an unexpected error. This has been logged and we&apos;ll look into it.
              </p>

              {process.env.NODE_ENV !== 'production' && this.state.error && (
                <details className="text-left bg-gray-900/50 rounded-xl p-4 mb-4 border border-gray-800">
                  <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                    Error details (dev only)
                  </summary>
                  <pre className="mt-2 text-xs text-gray-500 overflow-auto max-h-40 whitespace-pre-wrap">
                    {this.state.error.toString()}
                    {'\n\n'}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="bg-taxfi-600 hover:bg-taxfi-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-[0.98]"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all font-medium"
              >
                Reload Page
              </button>
            </div>

            <p className="text-xs text-gray-600">
              If this persists,{' '}
              <a
                href="https://github.com/your-org/taxfi/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-taxfi-500 hover:text-taxfi-400 underline"
              >
                file an issue
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
