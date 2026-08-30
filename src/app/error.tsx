"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="plotground" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="sheet" style={{ maxWidth: 480, width: "100%" }}>
        <div className="sheet-head">
          <h2>Something broke</h2>
        </div>
        <div className="sheet-body">
          <p className="t-quiet" style={{ marginBottom: 16 }}>{error.message}</p>
          <button className="btn btn--primary" onClick={reset}>Try again</button>
        </div>
      </div>
    </div>
  );
}
