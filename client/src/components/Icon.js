import React from 'react';

// Line icons drawn on a 24x24 grid. They inherit the text colour (stroke="currentColor"),
// so they can be themed with CSS. Decorative by default; pass `title` for a meaningful icon.
const PATHS = {
  // Ear tag: cattle records
  tag: (
    <>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  // QR code: identification
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M17 20h4v-3" />
    </>
  ),
  // Rising line: yield forecast
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  // Pulse line: veterinary care
  pulse: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  // Ticked list: daily tasks
  checklist: (
    <>
      <path d="M3 6l2 2 3-3M3 12l2 2 3-3M3 18l2 2 3-3" />
      <path d="M12 6h9M12 12h9M12 18h9" />
    </>
  ),
  // Arrow: "continue" affordance on buttons and links
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  // Tick: completed item
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  // Padlock: role-based access
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  // Four tiles: dashboard
  grid: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  // Milk drop: milking records
  drop: <path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z" />,
  // Wallet: finance
  wallet: (
    <>
      <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
      <path d="M21 12h-5a2 2 0 0 0 0 4h5v-4z" />
    </>
  ),
  // Shield: admin panel
  shield: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  // Door with arrow: sign out
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  // Hamburger and close: mobile menu
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />
};

const Icon = ({ name, size = 24, title }) => (
  <svg
    className="icon"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : true}
  >
    {PATHS[name]}
  </svg>
);

export default Icon;
