import { useEffect, useRef, useState } from 'react';
import { Check, LockKeyhole } from 'lucide-react';

const HOLD_DURATION_MS = 3000;

export function HoldPowerButton({ label, disabled, onConfirm, tone = 'danger' }: {
  label: string; disabled: boolean; onConfirm: () => void; tone?: 'danger' | 'install' | 'cancel';
}) {
  const [holding, setHolding] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const timer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const start = () => {
    if (disabled || unlocked || timer.current !== null) return;
    // Releasing the unlocking hold must never also submit the power action.
    suppressClick.current = true;
    setHolding(true);
    timer.current = window.setTimeout(() => { timer.current = null; setUnlocked(true); }, HOLD_DURATION_MS);
  };
  useEffect(() => {
    const reset = () => { stop(); setUnlocked(false); };
    const hidden = () => { if (document.visibilityState !== 'visible') reset(); };
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  useEffect(() => { if (disabled) { stop(); setUnlocked(false); } }, [disabled]);
  return <button type="button" className={`host-danger hold-power-button ${tone} ${holding ? 'holding' : ''} ${unlocked ? 'unlocked' : ''}`}
    aria-label={label} disabled={disabled}
    onPointerDown={e => { if (e.button === 0 && !unlocked) start(); }}
    onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onBlur={stop}
    onKeyDown={e => {
      if (e.key === ' ' || e.key === 'Enter') {
        if (!unlocked || holding || e.repeat) e.preventDefault();
        if (!e.repeat && !unlocked) start();
      }
    }}
    onKeyUp={e => {
      if (e.key === ' ' || e.key === 'Enter') {
        if (suppressClick.current) e.preventDefault();
        stop();
        suppressClick.current = false;
      }
    }}
    onClick={() => {
      if (suppressClick.current) { suppressClick.current = false; return; }
      if (!disabled && unlocked && !holding) { setUnlocked(false); onConfirm(); }
    }}>
    <svg className="hold-power-outline" viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true">
      <path d="M100 1 H192 A7 7 0 0 1 199 8 V40 A7 7 0 0 1 192 47 H8 A7 7 0 0 1 1 40 V8 A7 7 0 0 1 8 1 H100" pathLength="1" />
    </svg>
    {unlocked ? <Check size={16} /> : <LockKeyhole size={16} />}
    <span className="hold-power-copy"><strong>{label}</strong><small aria-live="polite">{unlocked ? holding ? 'Uvolněte tlačítko' : 'Kliknutím potvrdit' : holding ? 'Podržte…' : 'Podržet 3 sekundy'}</small></span>
  </button>;
}
