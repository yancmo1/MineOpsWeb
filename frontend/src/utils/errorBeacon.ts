/**
 * Error Beacon Utility
 * Captures and sends errors to monitoring endpoint
 */

interface ErrorReport {
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  type: 'error' | 'unhandledrejection' | 'react-error';
  componentStack?: string;
  timestamp: number;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId: string;
}

let sessionId = generateSessionId();
const errorQueue: ErrorReport[] = [];
let isSending = false;

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Send error reports to the monitoring endpoint
 */
async function flushErrorQueue() {
  if (isSending || errorQueue.length === 0) return;
  
  isSending = true;
  const errors = [...errorQueue];
  errorQueue.length = 0;
  
  try {
    if (navigator.sendBeacon) {
      const body = JSON.stringify({ errors, sessionId });
      navigator.sendBeacon('/api/errors', body);
    } else {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors, sessionId }),
        keepalive: true,
      });
    }
  } catch (e) {
    // Re-queue errors if sending fails
    errorQueue.unshift(...errors);
    console.error('[ErrorBeacon] Failed to send errors:', e);
  } finally {
    isSending = false;
  }
}

/**
 * Report an error to the beacon
 */
export function reportError(error: Error | ErrorEvent | PromiseRejectionEvent, type: ErrorReport['type'] = 'error', componentStack?: string) {
  let report: ErrorReport;
  
  if (error instanceof ErrorEvent) {
    report = {
      message: error.message,
      filename: error.filename,
      lineno: error.lineno,
      colno: error.colno,
      stack: error.error?.stack,
      type,
      componentStack,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId,
    };
  } else if (error instanceof PromiseRejectionEvent) {
    const reason = error.reason;
    report = {
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      type,
      componentStack,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId,
    };
  } else {
    report = {
      message: error.message,
      stack: error.stack,
      type,
      componentStack,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId,
    };
  }
  
  errorQueue.push(report);
  
  // Flush immediately for critical errors, otherwise batch
  if (type === 'react-error') {
    flushErrorQueue();
  } else {
    // Debounce flush
    setTimeout(flushErrorQueue, 1000);
  }
}

/**
 * Initialize global error handlers
 */
export function initErrorBeacon() {
  // Catch unhandled errors
  window.addEventListener('error', (event) => {
    reportError(event, 'error');
  });
  
  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event, 'unhandledrejection');
  });
  
  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    flushErrorQueue();
  });
  
  // Flush on visibility change (user switches tabs)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushErrorQueue();
    }
  });
  
  console.log('[ErrorBeacon] Initialized');
}

/**
 * Report a React component error (from ErrorBoundary)
 */
export function reportReactError(error: Error, componentStack?: string) {
  reportError(error, 'react-error', componentStack);
}

/**
 * Get current session ID
 */
export function getSessionId(): string {
  return sessionId;
}

/**
 * Set user ID for error tracking
 */
export function setUserId(userId: string) {
  // This will be included in future error reports
  // We'd need to store it and add to reports
  console.log('[ErrorBeacon] User ID set:', userId);
}

/**
 * Manually trigger queue flush
 */
export function flushErrors() {
  flushErrorQueue();
}