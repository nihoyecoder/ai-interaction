import type { ReactNode } from 'react';

/** 20 px line icons for the panel's choices. Decorative: their buttons carry the text. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** A selection frame with a pointer. */
export function SelectDesignIcon() {
  return (
    <Icon>
      <path d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M13 3h2.5A1.5 1.5 0 0 1 17 4.5V7M3 13v2.5A1.5 1.5 0 0 0 4.5 17H7" />
      <path d="M10 10l7 2.5-3.2 1.3-1.3 3.2Z" />
    </Icon>
  );
}

/** A record button. */
export function RecordMotionIcon() {
  return (
    <Icon>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="2.5" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** A button-shaped element. */
export function ElementIcon() {
  return (
    <Icon>
      <rect x="3" y="7" width="14" height="6" rx="3" />
    </Icon>
  );
}

/** A band of the page between two thin ones. */
export function SectionIcon() {
  return (
    <Icon>
      <path d="M3 3.5h14M3 16.5h14" />
      <rect x="3" y="6.5" width="14" height="7" rx="1.5" />
    </Icon>
  );
}

/** A whole page. */
export function FullPageIcon() {
  return (
    <Icon>
      <rect x="4" y="2.5" width="12" height="15" rx="1.5" />
      <path d="M7 6.5h6M7 10h6M7 13.5h3.5" />
    </Icon>
  );
}
