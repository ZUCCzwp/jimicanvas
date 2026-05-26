import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export function CustomSelect({
  icon,
  label,
  title,
  value,
  options,
  onChange,
  compact = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`custom-select ${open ? 'open' : ''} ${compact ? 'compact' : ''} ${className}`}
      title={title}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {icon}
        {label ? <span className="custom-select-prefix">{label}</span> : null}
        <span className="custom-select-value">{selected?.label}</span>
        <ChevronDown size={13} className="custom-select-arrow" />
      </button>
      {open ? (
        <div className="custom-select-menu" role="listbox">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={String(option.value)}
                type="button"
                className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                role="option"
                aria-selected={isSelected}
              >
                <span>{option.label}</span>
                {isSelected ? <Check size={13} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
