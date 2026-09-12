import { useEffect, useRef, useState, type PointerEvent } from 'react';

const key = 'net_dashboard_card_sizes';
export const clampCardSize = (value: number) => Math.max(280, Math.min(520, Math.round(value / 20) * 20));

export function useCardSize() {
  const [sizes, setSizes] = useState<Record<string, number>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
      return Object.fromEntries(Object.entries(saved).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)).map(([id, value]) => [id, clampCardSize(value as number)]));
    } catch { return {}; }
  });
  const [defaultSize] = useState(() => {
    try { const old = Number(localStorage.getItem('net_dashboard_card_width')); return old >= 280 && old <= 520 ? clampCardSize(old) : 320; } catch { return 320; }
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const sizeOf = (id: string) => Object.prototype.hasOwnProperty.call(sizes, id) ? sizes[id] : defaultSize;
  const setSize = (id: string, value: number) => { setActiveId(id); setSizes(current => ({ ...current, [id]: clampCardSize(value) })); };
  const [editing, setEditing] = useState(false);
  const drag = useRef<{ id: string; x: number; y: number; size: number } | null>(null);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(sizes)); } catch { /* Layout remains usable without storage. */ } }, [sizes]);
  useEffect(() => { if (!editing) drag.current = null; }, [editing]);
  const start = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveId(id);
    drag.current = { id, x: event.clientX, y: event.clientY, size: sizeOf(id) };
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    setSize(drag.current.id, drag.current.size + (Math.abs(dx) >= Math.abs(dy) ? dx : dy * 2));
  };
  const stop = () => { drag.current = null; };
  return { sizeOf, setSize, activeId, setActiveId, editing, setEditing, start, move, stop };
}
