import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

interface WebVitalsMetrics {
  LCP?: number;
  INP?: number;
  CLS?: number;
  FCP?: number;
  TTFB?: number;
}

const metrics: WebVitalsMetrics = {};

/**
 * Initialize Web Vitals monitoring
 * Call this once at app startup
 */
export function initWebVitals() {
  // Only run in production
  if (import.meta.env.DEV) {
    console.log('[WebVitals] Development mode - metrics will be logged to console');
  }

  const sendToAnalytics = (metric: Metric) => {
    // Store locally for access
    metrics[metric.name as keyof WebVitalsMetrics] = metric.value;
    
    // In development, log to console
    if (import.meta.env.DEV) {
      console.log(`[WebVitals] ${metric.name}:`, metric.value.toFixed(2), metric.rating);
    }
    
    // In production, send to analytics endpoint
    if (!import.meta.env.DEV && navigator.sendBeacon) {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        page: window.location.pathname,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      });
      
      navigator.sendBeacon('/api/vitals', body);
    }
  };

  // Register all Web Vitals callbacks
  onCLS(sendToAnalytics);
  onINP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);

  // Add performance marks for key milestones
  performance.mark('app-start');
  
  // Mark when hydration completes (approximate)
  if (document.readyState === 'complete') {
    performance.mark('hydration-complete');
  } else {
    window.addEventListener('load', () => {
      performance.mark('hydration-complete');
      performance.measure('hydration', 'app-start', 'hydration-complete');
    });
  }

  return metrics;
}

/**
 * Get current Web Vitals metrics
 */
export function getWebVitals(): WebVitalsMetrics {
  return { ...metrics };
}

/**
 * Add a custom performance mark
 */
export function addPerformanceMark(name: string) {
  performance.mark(name);
}

/**
 * Measure time between two marks
 */
export function measurePerformance(name: string, startMark: string, endMark: string) {
  try {
    performance.measure(name, startMark, endMark);
    const measure = performance.getEntriesByName(name, 'measure')[0];
    return measure.duration;
  } catch {
    return null;
  }
}

/**
 * Log a custom metric
 */
export function logCustomMetric(name: string, value: number, unit: 'ms' | 'bytes' | 'count' = 'ms') {
  if (import.meta.env.DEV) {
    console.log(`[CustomMetric] ${name}: ${value}${unit}`);
  }
  
  if (!import.meta.env.DEV && navigator.sendBeacon) {
    const body = JSON.stringify({
      name: `custom_${name}`,
      value,
      unit,
      page: window.location.pathname,
      timestamp: Date.now(),
    });
    navigator.sendBeacon('/api/vitals', body);
  }
}