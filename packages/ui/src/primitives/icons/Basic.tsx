import type { SVGProps } from "react";

/**
 * Minimal original inline icon set — no external icon library dependency.
 * Each icon inherits color via `currentColor` and size via className.
 */

export function Check(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M3 8.5L6.2 11.7L13 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function X(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 4L12 12M12 4L4 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WifiOff(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M1 1L15 15M2.5 6.5A9 9 0 0 1 6 4.8M9.5 4.4A9 9 0 0 1 13.5 6.5M5 9.3A5 5 0 0 1 8 8.3M11 9.3a5 5 0 0 0-.6-.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

export function Wifi(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M2.5 6.5a9 9 0 0 1 11 0M5 9.3a5 5 0 0 1 6 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

export function Sync(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M13 4.5A5.5 5.5 0 0 0 3.2 3M3 1.5v2h2M3 11.5A5.5 5.5 0 0 0 12.8 13M13 14.5v-2h-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AlertTriangle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M8 1.5L15 14H1L8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11.7" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function Inbox(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M1.5 8.5H5l1.2 2h3.6l1.2-2h3.5M2 8.5L3.2 3h9.6L14 8.5v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MapPinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M8 14.5S13 10 13 6.5A5 5 0 0 0 3 6.5C3 10 8 14.5 8 14.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="6.5" r="1.8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ArrowLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M13 8H3M7 4L3 8l4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShieldCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M8 1.5l5.5 2v4c0 3.5-2.3 5.8-5.5 7-3.2-1.2-5.5-3.5-5.5-7v-4l5.5-2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M5.5 8l1.7 1.7L10.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlusCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5.2v5.6M5.2 8h5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CloudOff(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M5.5 12.5H12a2.5 2.5 0 0 0 .3-4.98A4 4 0 0 0 5.2 5.6M2.3 3.3l11.4 11.4M3.7 6.2A3 3 0 0 0 4 12.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FileText(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 1.5h5.5L13 5v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M9.5 1.5V5H13" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5 8.5h6M5 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.2 8.2l1.9 1.9 3.7-4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5v3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function XCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Pencil(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M10.5 2.5l3 3L5 14H2v-3l8.5-8.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 4l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Trash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M2.5 4.5h11M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M6.5 7.5v4M9.5 7.5v4M3.5 4.5l.6 8.4a1 1 0 0 0 1 .9h5.8a1 1 0 0 0 1-.9l.6-8.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RotateCw(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M13 4.5A5.5 5.5 0 1 0 14 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M13 1.5v3.5h-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HardDrive(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="1.5" y="5.5" width="13" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 10.5h13" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="4" cy="12" r="0.6" fill="currentColor" />
      <circle cx="6.2" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function Zap(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M9 1.5 3 9h4l-1 5.5 6-8H8l1-5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function Brain(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M6 2.2a2 2 0 0 0-2 2v.3A2.2 2.2 0 0 0 2.5 6.5 2.2 2.2 0 0 0 3.7 10a2 2 0 0 0 2 2.3A2 2 0 0 0 6 14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M10 2.2a2 2 0 0 1 2 2v.3a2.2 2.2 0 0 1 1.5 2 2.2 2.2 0 0 1-1.2 3.5 2 2 0 0 1-2 2.3 2 2 0 0 1-2 1.7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M6 4.2v9.6M10 4.2v9.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function ListChecks(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M3 4.5l1 1 2-2M3 9.5l1 1 2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 4.5h5M8 9.5h5M3 13.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Waves(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M1.5 5.5c1 1 2 1 3 0s2-1 3 0 2 1 3 0 2-1 3 0"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M1.5 9c1 1 2 1 3 0s2-1 3 0 2 1 3 0 2-1 3 0"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M1.5 12.5c1 1 2 1 3 0s2-1 3 0 2 1 3 0 2-1 3 0"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Mountain(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M1.5 13 6 5.5l2 3 1.2-1.8L14.5 13H1.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="10.8" cy="3.2" r="1.2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function Truck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="1" y="5" width="8" height="6" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9 7h3l2 2v2h-5V7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="4" cy="12.2" r="1.2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11.5" cy="12.2" r="1.2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function TrendingUp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M1.5 11.5 6 7l3 3 5-5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 4.2h3.2v3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sparkles(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M8 1.5 9.2 5 12.5 6.2 9.2 7.4 8 10.9 6.8 7.4 3.5 6.2 6.8 5 8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M12.7 10 13.3 11.7 15 12.3 13.3 12.9 12.7 14.6 12.1 12.9 10.4 12.3 12.1 11.7 12.7 10Z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
    </svg>
  );
}

export function Package(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M1.5 4.5 8 1.5l6.5 3-6.5 3-6.5-3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M1.5 4.5v7l6.5 3 6.5-3v-7" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 7.5v7" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function Users(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <circle cx="5.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 13v-.5a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10.3 3.2a2 2 0 0 1 0 3.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 8.6a4 4 0 0 1 3.5 3.9v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function UserPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <circle cx="6" cy="5" r="2.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 13.2v-.4a4.5 4.5 0 0 1 4.5-4.5h0a4.5 4.5 0 0 1 3.2 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M12.3 5v5M9.8 7.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function Download(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M8 1.5v8.2M4.7 6.8 8 10.2l3.3-3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 11.5v1.3a1.7 1.7 0 0 0 1.7 1.7h8.6a1.7 1.7 0 0 0 1.7-1.7v-1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function Search(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <circle cx="6.8" cy="6.8" r="4.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="m13.5 13.5-3.4-3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function Star(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M8 1.5 9.9 5.7l4.6.5-3.4 3.1.9 4.5L8 11.5l-4 2.3.9-4.5-3.4-3.1 4.6-.5L8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Hub(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <circle cx="8" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="2.5" cy="3.5" r="1.3" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="13.5" cy="3.5" r="1.3" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="2.5" cy="12.5" r="1.3" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="13.5" cy="12.5" r="1.3" stroke="currentColor" strokeWidth="1.1" />
      <path d="M6.8 6.9 3.4 4.3M9.2 6.9l3.4-2.6M6.8 9.1l-3.4 2.6M9.2 9.1l3.4 2.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function ClipboardList(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="2.5" width="10" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 2.2h4a0.8 0.8 0 0 1 0.8 0.8v0.8H5.2V3a0.8 0.8 0 0 1 0.8-0.8Z" stroke="currentColor" strokeWidth="1.1" />
      <path d="M5.5 7h5M5.5 9.3h5M5.5 11.6h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
