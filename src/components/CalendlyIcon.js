import React from 'react';

export default function CalendlyIcon({ size = 24, className = '' }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Official Calendly brand icon - blue circular calendar */}
      <circle cx="12" cy="12" r="11" fill="#006BFF"/>
      <path 
        d="M15.5 8.5C15.5 8.22386 15.2761 8 15 8H9C8.72386 8 8.5 8.22386 8.5 8.5V15.5C8.5 15.7761 8.72386 16 9 16H15C15.2761 16 15.5 15.7761 15.5 15.5V8.5Z" 
        fill="white"
      />
      <rect x="10" y="6.5" width="1" height="2.5" rx="0.5" fill="white"/>
      <rect x="13" y="6.5" width="1" height="2.5" rx="0.5" fill="white"/>
      <rect x="10" y="11" width="1.5" height="1.5" rx="0.25" fill="#006BFF"/>
      <rect x="12.5" y="11" width="1.5" height="1.5" rx="0.25" fill="#006BFF"/>
      <rect x="10" y="13.5" width="1.5" height="1.5" rx="0.25" fill="#006BFF"/>
      <rect x="12.5" y="13.5" width="1.5" height="1.5" rx="0.25" fill="#006BFF"/>
    </svg>
  );
}

