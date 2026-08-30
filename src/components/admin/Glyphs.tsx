// Two marks the shared sprite does not carry, drawn to the same 24px box and
// 1.6 stroke so they sit beside <Icon> without looking borrowed.

type Props = { size?: "sm" | "md" | "lg" };

const box = (size: Props["size"]) => (size === "sm" ? "i-sm" : size === "lg" ? "i-lg" : "i");

/** The one warning shape in the product: something needs a decision. */
export function AlertGlyph({ size }: Props) {
  return (
    <svg className={box(size)} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.8 2 20.2h20z" />
      <path d="M12 9.6v4.4M12 17.4h.01" />
    </svg>
  );
}

/** Two links of a chain: one leader joined to another. */
export function LinkGlyph({ size }: Props) {
  return (
    <svg className={box(size)} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.2 13.4a4.2 4.2 0 0 0 6 0l2.6-2.6a4.2 4.2 0 1 0-6-6l-1.3 1.3" />
      <path d="M13.8 10.6a4.2 4.2 0 0 0-6 0l-2.6 2.6a4.2 4.2 0 1 0 6 6l1.3-1.3" />
    </svg>
  );
}
