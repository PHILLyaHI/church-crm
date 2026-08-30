import Link from "next/link";

export default function NotFound() {
  return (
    <div className="plotground" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="sheet" style={{ maxWidth: 420, width: "100%" }}>
        <div className="sheet-body empty">
          <div className="empty-plot"><i /><i /><i /><i /></div>
          <h3>Not here</h3>
          <p>This page does not exist, or it belongs to someone whose list you cannot read.</p>
          <Link className="btn btn--primary" href="/people">Back to my people</Link>
        </div>
      </div>
    </div>
  );
}
