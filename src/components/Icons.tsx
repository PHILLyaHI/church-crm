// One drawn set, 24px box, 1.6 stroke. No emoji, no glyphs.
// The sprite is mounted once in the root layout; <Icon> references it.

export function IconSprite() {
  return (
    <svg className="sprite" aria-hidden="true">
      <symbol id="ic-mark" viewBox="0 0 24 24"><rect x="2.2" y="2.2" width="19.6" height="19.6" rx="2.4"/><path d="M12 2.2v19.6M2.2 12h19.6"/><rect x="3.4" y="13.2" width="7.4" height="7.4" rx="1" fill="currentColor" stroke="none"/></symbol>
      <symbol id="ic-people" viewBox="0 0 24 24"><circle cx="5" cy="6" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="5" cy="18" r="1.5"/><path d="M10 6h10M10 12h10M10 18h6"/></symbol>
      <symbol id="ic-bell" viewBox="0 0 24 24"><path d="M12 3a5.5 5.5 0 0 0-5.5 5.5c0 4-1.5 5.5-2 6.2-.3.4 0 1 .5 1h14c.5 0 .8-.6.5-1-.5-.7-2-2.2-2-6.2A5.5 5.5 0 0 0 12 3Z"/><path d="M10 19a2.2 2.2 0 0 0 4 0"/></symbol>
      <symbol id="ic-team" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.4 6-5.4s6 2.1 6 5.4"/><path d="M16.2 5.4a3.2 3.2 0 0 1 0 6.1M17.6 15c2.1.6 3.4 2.4 3.4 5"/></symbol>
      <symbol id="ic-upload" viewBox="0 0 24 24"><path d="M12 16V3.8M8 7.8l4-4 4 4"/><path d="M4 14.5V18a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 18v-3.5"/></symbol>
      <symbol id="ic-admin" viewBox="0 0 24 24"><path d="M4 7h9.6M18.4 7H20M4 17h3.6M12.4 17H20"/><circle cx="16" cy="7" r="2.4"/><circle cx="10" cy="17" r="2.4"/></symbol>
      <symbol id="ic-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
      <symbol id="ic-minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>
      <symbol id="ic-check" viewBox="0 0 24 24"><path d="m4.8 12.4 4.9 4.9L19.2 7.4"/></symbol>
      <symbol id="ic-chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></symbol>
      <symbol id="ic-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.6 15.6 5 5"/></symbol>
      <symbol id="ic-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.3l3.3 2"/></symbol>
      <symbol id="ic-left" viewBox="0 0 24 24"><path d="M20 12H4M10 6l-6 6 6 6"/></symbol>
      <symbol id="ic-filter" viewBox="0 0 24 24"><path d="M3.5 6h17M6.5 12h11M10 18h4"/></symbol>
      <symbol id="ic-sort" viewBox="0 0 24 24"><path d="M6.5 4.5v15M3.2 16.2l3.3 3.3 3.3-3.3M13.5 6.5h7M13.5 11.5h5.5M13.5 16.5h4"/></symbol>
      <symbol id="ic-out" viewBox="0 0 24 24"><path d="M14.5 4.5H18A2.5 2.5 0 0 1 20.5 7v10a2.5 2.5 0 0 1-2.5 2.5h-3.5"/><path d="M9.5 16 14 12 9.5 8M14 12H3.5"/></symbol>
      <symbol id="ic-more" viewBox="0 0 24 24"><circle cx="5.2" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.8" cy="12" r="1.4"/></symbol>
      <symbol id="ic-eye" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></symbol>
      <symbol id="ic-sync" viewBox="0 0 24 24"><path d="M20 5.5v5h-5"/><path d="M4 18.5v-5h5"/><path d="M19.2 10.5a7.5 7.5 0 0 0-13-3.2L4 10M4.8 13.5a7.5 7.5 0 0 0 13 3.2L20 14"/></symbol>
      <symbol id="ic-lock" viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/></symbol>
      <symbol id="ic-mail" viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="m3.6 7 8.4 6 8.4-6"/></symbol>
      <symbol id="ic-file" viewBox="0 0 24 24"><path d="M13.5 3.5H7A2 2 0 0 0 5 5.5v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13.5 3.5V9H19"/></symbol>
      <symbol id="ic-arrow-r" viewBox="0 0 24 24"><path d="M4 12h16M14 6l6 6-6 6"/></symbol>
      <symbol id="ic-pause" viewBox="0 0 24 24"><path d="M9.5 5v14M14.5 5v14"/></symbol>
      <symbol id="ic-trash" viewBox="0 0 24 24"><path d="M4.5 6.5h15M9.5 6.5V4.8h5v1.7M6.8 6.5 7.6 20h8.8l.8-13.5"/></symbol>
      <symbol id="ic-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
      <symbol id="ic-cog" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.6"/><path d="M19 12h2.2M15.5 18.1l1.1 1.9M8.5 18.1l-1.1 1.9M5 12H2.8M8.5 5.9 7.4 4M15.5 5.9 16.6 4"/></symbol>
      <symbol id="ic-pencil" viewBox="0 0 24 24"><path d="M4 20l.7-3.9L15.8 5a1.7 1.7 0 0 1 2.4 0l.8.8a1.7 1.7 0 0 1 0 2.4L7.9 19.3 4 20Z"/><path d="m13.8 6.9 3.3 3.3"/></symbol>
      <symbol id="ic-calendar" viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="15" rx="2.2"/><path d="M3.5 10h17M8 3.5v4M16 3.5v4"/></symbol>
      <symbol id="ic-home" viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/></symbol>
    </svg>
  );
}

type IconProps = {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
};

export function Icon({ name, size = "md", className, style }: IconProps) {
  const base = size === "sm" ? "i-sm" : size === "lg" ? "i-lg" : "i";
  return (
    <svg className={className ? `${base} ${className}` : base} viewBox="0 0 24 24" style={style} aria-hidden="true">
      <use href={`#ic-${name}`} />
    </svg>
  );
}

/** Initials, the only avatar this product has. */
export function Avatar({ name, large, onSheet }: { name: string; large?: boolean; onSheet?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const cls = ["avatar", large ? "avatar-lg" : "", onSheet ? "on-sheet" : ""].filter(Boolean).join(" ");
  return <span className={cls}>{initials}</span>;
}
