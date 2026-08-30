import "@/styles/people.css";

/** The shape of the list, held while the list is fetched. */
export default function LoadingPeople() {
  return (
    <div className="content">
      <div className="plot-page">
        <div className="sheet" style={{ marginTop: 64 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="sk-row" key={i}>
              <span className="sk sk-av" />
              <span className="sk sk-line" style={{ width: 148 }} />
              <span className="sk sk-line" style={{ width: 96 }} />
              <span className="sk sk-line" style={{ width: 64 }} />
              <span className="sk sk-line" style={{ flex: 1 }} />
              <span className="sk sk-line" style={{ width: 88 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
