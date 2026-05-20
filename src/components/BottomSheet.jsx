import { useEffect, useRef } from 'react';

export default function BottomSheet({ visible, onClose, title, children }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    if (visible) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/60 fade-in"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="relative bg-card rounded-t-[20px] border-t border-border slide-up max-h-[90vh] flex flex-col z-10">
        {/* Handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-2 flex-shrink-0" />
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
          {title ? <span className="text-lg font-bold text-textPrimary">{title}</span> : <span />}
          <button onClick={onClose} className="text-textSecondary text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        {/* Content */}
        <div className="px-5 pb-safe-bottom overflow-y-auto flex-1 pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}
