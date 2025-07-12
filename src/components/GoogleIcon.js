import React from 'react';

export default function GoogleIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#fff"/>
      <g>
        <path d="M17.5 7.5V16.5C17.5 17.3284 16.8284 18 16 18H8C7.17157 18 6.5 17.3284 6.5 16.5V7.5C6.5 6.67157 7.17157 6 8 6H16C16.8284 6 17.5 6.67157 17.5 7.5Z" fill="#34A853"/>
        <path d="M17.5 7.5L21 10.5V13.5L17.5 16.5V7.5Z" fill="#4285F4"/>
        <path d="M6.5 7.5L3 10.5V13.5L6.5 16.5V7.5Z" fill="#FBBC05"/>
        <path d="M17.5 7.5L21 10.5V13.5L17.5 16.5V7.5Z" fill="#EA4335" fillOpacity="0.6"/>
      </g>
    </svg>
  );
} 