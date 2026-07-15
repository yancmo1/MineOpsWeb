export function ResourcesPage() {
  return (
    <section className="card-container">
      <h2 className="card-title">Resources</h2>
      <div className="empty-state">
        <h3>Resource Inventory</h3>
        <p>
          Resource tracking is prepared for mine-state integration. This page will display:
        </p>
        <ul style={{ textAlign: "left", display: "inline-block" }}>
          <li>Continent currencies</li>
          <li>Super Cash</li>
          <li>Crystals</li>
          <li>Fragments</li>
          <li>Equipment</li>
          <li>Artifacts</li>
          <li>Collectibles</li>
          <li>Boost inventory</li>
          <li>Keys and tokens</li>
        </ul>
        <p style={{ marginTop: "1rem", marginBottom: 0 }}>
          <em>Resources will populate when player save data is fully parsed.</em>
        </p>
      </div>
    </section>
  );
}
