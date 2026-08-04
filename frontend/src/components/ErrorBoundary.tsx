import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch JavaScript errors anywhere in the child component tree
 * Logs errors and displays a fallback UI instead of crashing the whole app
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);

    // Send to error reporting endpoint if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to send to an error tracking service
    // Example: Sentry.captureException(error, { extra: errorInfo });
    this.reportError(error, errorInfo);
  }

  private reportError(error: Error, errorInfo: ErrorInfo): void {
    // Send error to monitoring endpoint (non-blocking)
    if (typeof window !== "undefined" && navigator.sendBeacon) {
      const payload = JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });

      navigator.sendBeacon("/api/errors", payload);
    }
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, render it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="error-boundary-fallback">
          <div className="error-content">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--status-error)", marginBottom: "1rem" }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h2>Something went wrong</h2>
            <p>
              We encountered an unexpected error. The error has been logged and our
              team has been notified.
            </p>
            <details style={{ marginTop: "1rem", textAlign: "left", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
              <summary>Error details (for debugging)</summary>
              <pre style={{ marginTop: "0.5rem", padding: "0.5rem", background: "var(--mine-light)", borderRadius: "8px", overflow: "auto", maxHeight: "200px" }}>
                {this.state.error?.message}
                {this.state.error?.stack && `\n\n${this.state.error.stack}`}
              </pre>
            </details>
            <button
              className="sync-button"
              onClick={() => window.location.reload()}
              style={{ marginTop: "1rem" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
              <span>Reload Page</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap a component with an Error Boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback} onError={onError}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

/**
 * Hook to programmatically trigger an error boundary (for testing)
 */
export function useErrorBoundary() {
  // This is a placeholder - in practice you'd use a context or state to trigger
  // For now, we just provide a way to throw an error that will be caught by the nearest boundary
  const throwError = (error: Error) => {
    throw error;
  };
  return { throwError };
}