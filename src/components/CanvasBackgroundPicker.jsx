import { useEffect, useRef, useState } from 'react';
import { Check, CircleDot, Grid3x3, Rows3, Square } from 'lucide-react';
import { CANVAS_BACKGROUND_OPTIONS } from '../lib/constants';
import { getCanvasBackgroundOption } from '../lib/canvasBackground';

const BACKGROUND_ICONS = {
  grid: Grid3x3,
  dots: CircleDot,
  line: Rows3,
  none: Square,
};

export function CanvasBackgroundPicker({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = getCanvasBackgroundOption(value);
  const SelectedIcon = BACKGROUND_ICONS[selected.value] || Grid3x3;

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
      className={`canvas-background-picker ${open ? 'open' : ''}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="canvas-background-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="画布背景"
        title={`画布背景：${selected.label}`}
        onClick={() => setOpen((current) => !current)}
      >
        <SelectedIcon size={14} aria-hidden="true" />
        <span>{selected.label}</span>
      </button>

      {open ? (
        <div className="canvas-background-menu" role="listbox" aria-label="画布背景">
          {CANVAS_BACKGROUND_OPTIONS.map((option) => {
            const Icon = BACKGROUND_ICONS[option.value] || Grid3x3;
            const isSelected = option.value === selected.value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`canvas-background-option ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className={`canvas-background-preview canvas-background-preview-${option.value}`} aria-hidden="true" />
                <span className="canvas-background-option-copy">
                  <span className="canvas-background-option-label">
                    <Icon size={14} aria-hidden="true" />
                    {option.label}
                  </span>
                  <span className="canvas-background-option-hint">{option.hint}</span>
                </span>
                {isSelected ? <Check size={14} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
