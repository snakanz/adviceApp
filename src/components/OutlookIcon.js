import React from 'react';

export default function OutlookIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#fff"/>
      <g>
        <rect x="4" y="6" width="16" height="12" rx="2" fill="#0072C6"/>
        <rect x="7" y="9" width="10" height="6" rx="1" fill="#fff"/>
        <rect x="8.5" y="10.5" width="7" height="3" rx="0.5" fill="#0072C6"/>
      </g>
    </svg>
  );
} 