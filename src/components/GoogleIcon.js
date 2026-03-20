import React from 'react';

export default function GoogleIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Official Google Calendar icon */}
      <rect x="3" y="4" width="18" height="17" rx="2" fill="#4285F4"/>
      <rect x="3" y="4" width="18" height="4" fill="#1A73E8"/>
      <rect x="6" y="2" width="2" height="4" rx="1" fill="#1A73E8"/>
      <rect x="16" y="2" width="2" height="4" rx="1" fill="#1A73E8"/>
      <rect x="6" y="10" width="3" height="3" rx="0.5" fill="white"/>
      <rect x="10.5" y="10" width="3" height="3" rx="0.5" fill="white"/>
      <rect x="15" y="10" width="3" height="3" rx="0.5" fill="white"/>
      <rect x="6" y="14.5" width="3" height="3" rx="0.5" fill="white"/>
      <rect x="10.5" y="14.5" width="3" height="3" rx="0.5" fill="white"/>
      <text x="11" y="13" fontSize="4" fontWeight="bold" fill="#4285F4" textAnchor="middle">31</text>
    </svg>
  );
}