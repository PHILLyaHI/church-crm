import "@/styles/people.css";

/** Held space in the shape the record actually renders in. */
function Card({ lines, tall }: { lines: number; tall?: boolean }) {
  return (
    <section className="sheet">
      <div className="sheet-head">
        <span className="sk sk-line" style={{ width: 132 }} />
      </div>
      <div className="sheet-body">
        {tall && <span className="sk" style={{ height: 44, marginBottom: 16 }} />}
        {Array.from({ length: lines }).map((_, i) => (
          <span
            className="sk sk-line"
            key={i}
            style={{ width: i % 2 ? "72%" : "94%", marginBottom: 10 }}
          />
        ))}
      </div>
    </section>
  );
}

export default function LoadingPerson() {
  return (
    <div className="content">
      <div className="plot-page">
        <div className="one-col mt-4" style={{ marginTop: 64 }}>
          <Card lines={2} tall />
          <Card lines={3} tall />
          <Card lines={4} />
          <Card lines={3} />
        </div>
      </div>
    </div>
  );
}
