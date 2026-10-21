export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-live="polite" aria-label="Đang tải nội dung">
      <div className="loading-bar" />
      <aside className="loading-sidebar" aria-hidden="true">
        <div className="skeleton loading-brand" />
        {Array.from({length: 7}, (_, index) => <div className="skeleton loading-nav" key={index} />)}
      </aside>
      <main className="loading-main" aria-hidden="true">
        <div className="loading-header"><div className="skeleton loading-title" /></div>
        <div className="loading-content">
          <div className="loading-kpis">
            {Array.from({length: 4}, (_, index) => <div className="skeleton loading-card" key={index} />)}
          </div>
          <div className="loading-grid">
            <div className="skeleton loading-chart" />
            <div className="skeleton loading-chart" />
          </div>
          <div className="skeleton loading-table" />
        </div>
      </main>
      <span className="sr-only">Đang tải nội dung…</span>
    </div>
  );
}
