interface LoadingSkeletonProps {
  variant?: "card" | "page" | "list" | "manager";
  count?: number;
}

/**
 * Loading skeleton components for lazy-loaded routes
 * Provides visual feedback during code splitting chunk loads
 */
export function LoadingSkeleton({ variant = "page", count = 3 }: LoadingSkeletonProps) {
  // No self-hide timer: when used as a Suspense fallback the component must
  // stay visible for the whole time the lazy chunk is loading.
  const renderCardSkeleton = () => (
    <div className="manager-card skeleton-card" style={{ pointerEvents: "none" }}>
      <div className="manager-sprite-area">
        <div className="skeleton skeleton-sprite" />
      </div>
      <div className="manager-card-info">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-meta" />
        <div className="skeleton skeleton-stats" />
      </div>
    </div>
  );

  const renderPageSkeleton = () => (
    <div className="page-skeleton">
      <div className="skeleton skeleton-header" />
      <div className="skeleton skeleton-toolbar" />
      <div className="grid">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-card-wrapper">
            {renderCardSkeleton()}
          </div>
        ))}
      </div>
    </div>
  );

  const renderListSkeleton = () => (
    <div className="list-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-list-item" />
      ))}
    </div>
  );

  const renderManagerSkeleton = () => (
    <div className="manager-detail-skeleton">
      <div className="skeleton skeleton-manager-sprite" />
      <div className="skeleton skeleton-manager-title" />
      <div className="skeleton skeleton-manager-stats" />
      <div className="skeleton skeleton-manager-equipment" />
      <div className="skeleton skeleton-manager-skills" />
    </div>
  );

  switch (variant) {
    case "card":
      return renderCardSkeleton();
    case "list":
      return renderListSkeleton();
    case "manager":
      return renderManagerSkeleton();
    case "page":
    default:
      return renderPageSkeleton();
  }
}

/**
 * Full-page loading skeleton with header and navigation placeholders
 */
export function PageLoadingSkeleton() {
  return (
    <>
      <header className="skeleton-header-container">
        <div className="skeleton skeleton-eyebrow" />
        <div className="skeleton skeleton-title-large" />
        <div className="skeleton skeleton-sync-status" />
        <div className="skeleton skeleton-sync-button" />
      </header>
      <main className="skeleton-main">
        <div className="skeleton skeleton-toolbar" />
        <div className="grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card-wrapper">
              <div className="manager-card skeleton-card">
                <div className="manager-sprite-area">
                  <div className="skeleton skeleton-sprite" />
                </div>
                <div className="manager-card-info">
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-meta" />
                  <div className="skeleton skeleton-stats" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <nav className="skeleton-nav">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-nav-item" />
        ))}
      </nav>
    </>
  );
}