"use client";

import { useState } from "react";

/**
 * A segmented choice that posts with the form around it. The pressed segment
 * is the answer; the hidden input is what the server reads.
 */
export function SegChoice({
  name,
  value,
  options,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  const [picked, setPicked] = useState(value);
  return (
    <>
      <input type="hidden" name={name} value={picked} />
      <div className="seg" style={{ width: "100%" }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={picked === o.value}
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => setPicked(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </>
  );
}
