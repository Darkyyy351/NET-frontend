import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Wifi, WifiOff, X } from 'lucide-react';
import { api } from '../api/axios';

type Notice = { id: string; time: string; deviceId: string; deviceName: string; state: 'online' | 'offline'; message: string };
function readIds(key: string): string[] {
  try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value.filter(v => typeof v === 'string').slice(-100) : []; }
  catch { return []; }
}
export function NotificationCenter({ scope }: { scope: string }) {
  const key = `net_notifications_seen:${scope}`;
  const [notices, setNotices] = useState<Notice[]>([]);
  const [seen, setSeen] = useState(() => readIds(key));
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [toast, setToast] = useState<Notice | null>(null);
  const [extra, setExtra] = useState(0);
  const [enabled, setEnabled] = useState(() => { try { return localStorage.getItem('net_notification_toasts') !== 'off'; } catch { return true; } });
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    let disposed = false, busy = false;
    let previous: Set<string> | null = null;
    const poll = async () => {
      if (disposed || busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const result = await api.get<{ data: Notice[] }>('/notifications');
        if (!Array.isArray(result.data.data)) throw new Error('Invalid notification response');
        const items = result.data.data;
        if (disposed) return;
        const fresh = previous ? items.filter(item => !previous!.has(item.id)) : [];
        previous = new Set(items.map(item => item.id));
        setNotices(items); setFailed(false);
        if (enabledRef.current && fresh.length) { setToast(fresh[0]); setExtra(fresh.length - 1); }
      } catch { if (!disposed) setFailed(true); }
      finally { busy = false; }
    };
    void poll();
    const timer = window.setInterval(poll, 5000);
    document.addEventListener('visibilitychange', poll);
    return () => { disposed = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', poll); };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    const outside = (e: PointerEvent) => { if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', close); document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', outside); };
  }, [open]);
  const markRead = () => {
    const ids = notices.map(item => item.id);
    setSeen(ids);
    try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* Reading notifications remains possible without storage. */ }
  };
  const unread = notices.filter(item => !seen.includes(item.id)).length;
  return <>
    <button ref={button} type="button" className="core-nav-item notification-trigger" aria-label="Upozornění" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <Bell size={15} /><span>Upozornění</span>{unread > 0 && <strong className="notice-count">{unread}</strong>}{failed && <span className="notice-unavailable" title="Upozornění nejsou dostupná">!</span>}
    </button>
    {open && <section className="notification-panel" ref={panel} role="dialog" aria-label="Upozornění zařízení">
      <header><h3>Upozornění zařízení</h3><button type="button" aria-label="Zavřít upozornění" onClick={() => { setOpen(false); button.current?.focus(); }}><X size={17} /></button></header>
      <div className="notification-options"><label><input type="checkbox" checked={enabled} onChange={e => {
        setEnabled(e.target.checked); if (!e.target.checked) setToast(null);
        try { localStorage.setItem('net_notification_toasts', e.target.checked ? 'on' : 'off'); } catch { /* Session setting still applies. */ }
      }} /> Zobrazovat upozornění</label><button type="button" title="Označit vše jako přečtené" aria-label="Označit vše jako přečtené" onClick={markRead} disabled={!unread}><CheckCheck size={18} /></button></div>
      {failed && <p role="status" className="host-warning">Upozornění nejsou dostupná. Zobrazená historie může být neaktuální.</p>}
      {!notices.length && <p className="notice-empty">{failed ? 'Historii nelze načíst.' : 'Zatím žádné změny dostupnosti.'}</p>}
      <div className="notice-list">{notices.map(item => <article key={item.id} className={`notice-item ${item.state} ${seen.includes(item.id) ? 'read' : 'unread'}`}>
        {item.state === 'online' ? <Wifi size={17} /> : <WifiOff size={17} />}
        <div><strong>{item.deviceName}</strong><p>{item.state === 'online' ? 'Zařízení je znovu online' : 'Zařízení je offline'}</p><time dateTime={item.time}>{new Date(item.time).toLocaleString()}</time></div>
      </article>)}</div>
    </section>}
    {toast && <aside className={`device-notice-toast ${toast.state}`} role="status" aria-live="polite">
      {toast.state === 'online' ? <Wifi size={20} /> : <WifiOff size={20} />}
      <div><strong>{toast.deviceName}</strong><p>{toast.state === 'online' ? 'Zařízení je znovu online' : 'Zařízení je offline'}{extra > 0 ? ` · dalších událostí: ${extra}` : ''}</p></div>
      <button type="button" aria-label="Skrýt upozornění" onClick={() => setToast(null)}><X size={17} /></button>
    </aside>}
  </>;
}
