import React from 'react';

export default function OutlookIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Official Outlook Calendar icon */}
      <rect x="3" y="4" width="18" height="17" rx="2" fill="#0078D4"/>
      <rect x="3" y="4" width="18" height="4" fill="#005A9E"/>
      <rect x="6" y="2" width="2" height="4" rx="1" fill="#005A9E"/>
      <rect x="16" y="2" width="2" height="4" rx="1" fill="#005A9E"/>
      <rect x="6" y="10" width="3" height="3" rx="0.5" fill="white"/>
      <rect x="10.5" y="10" width="3" height="3" rx="0.5" fill="white"/>
      <rect x="15" y="10" width="3" height="3" rx="0.5" fill="white"/>
      <rect x="6" y="14.5" width="3" height="3" rx="0.5" fill="white"/>
      <rect x="10.5" y="14.5" width="3" height="3" rx="0.5" fill="white"/>
    </svg>
  );
}