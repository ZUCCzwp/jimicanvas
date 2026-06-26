import React, { useId } from 'react';

export default function JimicoinIcon({ className = '', size = 24 }) {
  const id = useId().replace(/:/g, '');
  const bodyGradId = `jimi-chick-body-${id}`;
  const edgeGradId = `jimi-coin-edge-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={bodyGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#facc15" />
        </linearGradient>
        <linearGradient id={edgeGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="white" />
      <circle cx="12" cy="12" r="11" stroke={`url(#${edgeGradId})`} strokeWidth="1.5" />
      <circle cx="12" cy="14" r="7.5" fill={`url(#${bodyGradId})`} />
      <circle cx="8" cy="14" r="1.5" fill="#fca5a5" fillOpacity="0.6" />
      <circle cx="16" cy="14" r="1.5" fill="#fca5a5" fillOpacity="0.6" />
      <path d="M4.5 14C3.5 14 3 15 3.5 16" stroke="#eab308" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M19.5 14C20.5 14 21 15 20.5 16" stroke="#eab308" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="9.5" cy="12" r="1.2" fill="#1e293b" />
      <circle cx="9.8" cy="11.7" r="0.4" fill="white" />
      <circle cx="14.5" cy="12" r="1.2" fill="#1e293b" />
      <circle cx="14.8" cy="11.7" r="0.4" fill="white" />
      <path d="M11.2 13.5L12 14.8L12.8 13.5H11.2Z" fill="#f97316" />
      <path d="M12 6.5C12 6.5 11.5 5.5 12 5" stroke="#facc15" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="#fbbf24" fillOpacity="0.4" />
      <path d="M17.5 4V9M15 6.5H20" stroke="#fbbf24" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
