export default function CheckRow({ label, points, checked, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-3 py-3 w-full text-left"
    >
      <span
        className={`w-[22px] h-[22px] rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors
          ${checked ? 'bg-success border-success' : 'border-border'}`}
      >
        {checked && <span className="text-white text-xs font-bold">✓</span>}
      </span>
      <span className={`flex-1 text-[15px] ${checked ? 'line-through text-textMuted' : 'text-textPrimary'}`}>
        {label}
      </span>
      <span className={`text-[13px] font-semibold flex-shrink-0 ${checked ? 'text-textMuted' : 'text-success'}`}>
        +{points}
      </span>
    </button>
  );
}
