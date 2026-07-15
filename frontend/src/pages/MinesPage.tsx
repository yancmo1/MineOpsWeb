export function MinesPage() {
  return (
    <section className="card-container">
      <h2 className="card-title">Mines</h2>
      <div className="empty-state">
        <h3>Mine State Analysis</h3>
        <p>
          Full mine-state analysis is the next dashboard milestone. This page will display:
        </p>
        <ul style={{ textAlign: "left", display: "inline-block" }}>
          <li>Mine cash balance</li>
          <li>Prestige</li>
          <li>Mineshaft, Elevator, and Warehouse levels</li>
          <li>Current production metrics</li>
          <li>Production contribution by mine</li>
          <li>Affordable upgrades</li>
          <li>Bottleneck analysis</li>
          <li>Recommended actions</li>
          <li>Time to next upgrade</li>
        </ul>
        <p style={{ marginTop: "1rem", marginBottom: 0 }}>
          <em>Check back soon as mine-state parsing is connected.</em>
        </p>
      </div>
    </section>
  );
}
