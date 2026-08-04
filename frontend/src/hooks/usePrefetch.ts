// Hook for predictive prefetching based on user behavior
import { useCallback, useRef } from 'react';

interface PrefetchOptions {
  /** Delay before prefetching on hover (ms) */
  hoverDelay?: number;
  /** Whether to prefetch on viewport intersection */
  prefetchOnVisible?: boolean;
}

/**
 * Hook that provides prefetch functions for routes and resources
 * Implements hover-based prefetching and IntersectionObserver-based prefetching
 */
export function usePrefetch(options: PrefetchOptions = {}) {
  const { hoverDelay = 100, prefetchOnVisible = false } = options;
  const prefetchedUrls = useRef<Set<string>>(new Set());
  const hoverTimeouts = useRef<Map<string, number>>(new Map());

  /**
   * Prefetch a document (HTML page)
   */
  const prefetchDocument = useCallback((url: string) => {
    if (prefetchedUrls.current.has(url)) return;
    
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'document';
    link.href = url;
    document.head.appendChild(link);
    prefetchedUrls.current.add(url);
  }, []);

  /**
   * Prefetch a stylesheet
   */
  const prefetchStyle = useCallback((url: string) => {
    if (prefetchedUrls.current.has(url)) return;
    
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'style';
    link.href = url;
    document.head.appendChild(link);
    prefetchedUrls.current.add(url);
  }, []);

  /**
   * Prefetch a script
   */
  const prefetchScript = useCallback((url: string) => {
    if (prefetchedUrls.current.has(url)) return;
    
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'script';
    link.href = url;
    document.head.appendChild(link);
    prefetchedUrls.current.add(url);
  }, []);

  /**
   * Prefetch an API endpoint (fetch with low priority)
   */
  const prefetchApi = useCallback(async (url: string) => {
    if (prefetchedUrls.current.has(url)) return;
    
    try {
      await fetch(url, { priority: 'low', cache: 'force-cache' });
      prefetchedUrls.current.add(url);
    } catch {
      // Ignore prefetch errors
    }
  }, []);

  /**
   * Attach hover-based prefetching to an element
   */
  const attachHoverPrefetch = useCallback((
    element: HTMLElement | null,
    urls: string | string[],
    type: 'document' | 'style' | 'script' | 'api' = 'document'
  ) => {
    if (!element) return;
    
    const urlArray = Array.isArray(urls) ? urls : [urls];
    
    const handleMouseEnter = () => {
      const timeoutId = window.setTimeout(() => {
        urlArray.forEach(url => {
          switch (type) {
            case 'document': prefetchDocument(url); break;
            case 'style': prefetchStyle(url); break;
            case 'script': prefetchScript(url); break;
            case 'api': prefetchApi(url); break;
          }
        });
      }, hoverDelay);
      
      hoverTimeouts.current.set(element.id || 'unknown', timeoutId);
    };
    
    const handleMouseLeave = () => {
      const timeoutId = hoverTimeouts.current.get(element.id || 'unknown');
      if (timeoutId) {
        clearTimeout(timeoutId);
        hoverTimeouts.current.delete(element.id || 'unknown');
      }
    };
    
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
    
    // Return cleanup function
    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      const timeoutId = hoverTimeouts.current.get(element.id || 'unknown');
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [hoverDelay, prefetchDocument, prefetchStyle, prefetchScript, prefetchApi]);

  /**
   * Attach IntersectionObserver-based prefetching
   */
  const attachVisibilityPrefetch = useCallback((
    element: HTMLElement | null,
    urls: string | string[],
    type: 'document' | 'style' | 'script' | 'api' = 'document'
  ) => {
    if (!element || !prefetchOnVisible) return;
    
    const urlArray = Array.isArray(urls) ? urls : [urls];
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          urlArray.forEach(url => {
            switch (type) {
              case 'document': prefetchDocument(url); break;
              case 'style': prefetchStyle(url); break;
              case 'script': prefetchScript(url); break;
              case 'api': prefetchApi(url); break;
            }
          });
          observer.unobserve(element);
        }
      });
    }, { rootMargin: '100px' });
    
    observer.observe(element);
    
    return () => observer.disconnect();
  }, [prefetchOnVisible, prefetchDocument, prefetchStyle, prefetchScript, prefetchApi]);

  /**
   * Prefetch next likely routes based on current route
   */
  const prefetchLikelyRoutes = useCallback((currentRoute: string) => {
    const routeMap: Record<string, string[]> = {
      '/': ['/strategy', '/more'],
      '/managers': ['/strategy', '/more'],
      '/strategy': ['/more'],
      '/more': [],
    };
    
    const likelyRoutes = routeMap[currentRoute] || [];
    likelyRoutes.forEach(route => prefetchDocument(route));
  }, [prefetchDocument]);

  /**
   * Prefetch CSS/JS chunks for heavy routes
   * Uses Vite's chunk naming convention
   */
  const prefetchRouteChunks = useCallback((route: string) => {
    const chunkMap: Record<string, { styles: string[]; scripts: string[] }> = {
      '/strategy': {
        styles: ['/assets/strategy-*.css'],
        scripts: ['/assets/StrategyPage-*.js', '/assets/strategy-*.js'],
      },
      '/more': {
        styles: ['/assets/more-*.css'],
        scripts: ['/assets/MorePage-*.js', '/assets/more-*.js'],
      },
      '/managers': {
        styles: [],
        scripts: ['/assets/ManagerCard-*.js'],
      },
    };

    const chunks = chunkMap[route];
    if (chunks) {
      chunks.styles.forEach(url => prefetchStyle(url));
      chunks.scripts.forEach(url => prefetchScript(url));
    }
  }, [prefetchStyle, prefetchScript]);

  return {
    prefetchDocument,
    prefetchStyle,
    prefetchScript,
    prefetchApi,
    attachHoverPrefetch,
    attachVisibilityPrefetch,
    prefetchLikelyRoutes,
    prefetchRouteChunks,
  };
}

/**
 * Simple hook to add prefetch attributes to navigation links
 * Can be used in any component that renders navigation
 */
export function useNavigationPrefetch() {
  const { attachHoverPrefetch } = usePrefetch({ hoverDelay: 50 });
  
  return useCallback((navElement: HTMLElement | null) => {
    if (!navElement) return;
    
    const links = navElement.querySelectorAll('button[aria-current], button[data-tab]');
    links.forEach(link => {
      const tab = link.getAttribute('data-tab') || link.getAttribute('aria-current');
      if (tab && tab !== 'page') {
        const route = `/${tab}`;
        attachHoverPrefetch(link as HTMLElement, route, 'document');
      }
    });
  }, [attachHoverPrefetch]);
}