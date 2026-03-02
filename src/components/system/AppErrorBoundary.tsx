import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Caught:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoToLogin = () => {
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The app encountered an unexpected error. Please try again.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleRetry}
                className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm"
              >
                Try Again
              </button>
              <button
                onClick={this.handleGoToLogin}
                className="w-full py-2.5 px-4 rounded-lg border border-border text-foreground font-medium text-sm"
              >
                Go to Login
              </button>
            </div>
            {this.state.error && (
              <p className="text-xs text-muted-foreground/60 break-all mt-4">
                {this.state.error.message}
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
