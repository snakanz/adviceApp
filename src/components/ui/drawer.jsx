import React from 'react';

export function Drawer({ open, onClose, title, children, width = 'max-w-md' }) {
  return (
    <div
      className={
        `fixed inset-0 z-50 flex justify-end transition-all duration-300 ${open ? '' : 'pointer-events-none'}`
      }
      aria-modal="true"
      role="dialog"
      style={{ visibility: open ? 'visible' : 'hidden' }}
    >
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Drawer Panel */}
      <div
        className={`relative bg-card shadow-xl h-full w-full ${width} transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            className="text-muted-foreground hover:text-destructive rounded-full p-1"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <span className="text-2xl leading-none">&times;</span>
          </button>
        </div>
        <div className="p-6 overflow-y-auto h-[calc(100vh-64px)]">{children}</div>
      </div>
    </div>
  );
} 