import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';
import type { EventLog } from '../api/logs';

export function EventStream({ logs, failed, loading, updatedAt, refresh }: {
  logs: EventLog[]; failed: boolean; loading: boolean; updatedAt: string | null;
  refresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [type, setType] = useState('all');
  const [automatic, setAutomatic] = useState(true);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!automatic) return;
    void refreshRef.current();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshRef.current();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [automatic]);
  const types = [...new Set(logs.map(log => log.type))].sort();
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return logs.filter(log => (level === 'all' || log.level === level) &&
      (type === 'all' || log.type === type) &&
      `${log.message} ${log.type} ${log.time}`.toLocaleLowerCase().includes(needle));
  }, [logs, query, level, type]);
  const exportLogs = () => {
    const data = filtered.map(({ id, time, type, level, message }) => ({ id, time, type, level, message }));
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), updatedAt, stale: failed, events: data }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `net-events-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <>
    <div className="event-toolbar">
      <label className="event-search"><Search size={15} aria-hidden="true" /><input aria-label="Hledat události" placeholder="Hledat události…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <select aria-label="Závažnost" value={level} onChange={e => setLevel(e.target.value)}>
        <option value="all">Všechny závažnosti</option><option value="info">Informace</option><option value="warn">Varování</option><option value="error">Chyby</option>
      </select>
      <select aria-label="Typ události" value={type} onChange={e => setType(e.target.value)}>
        <option value="all">Všechny typy</option>{[...new Set([...types, ...(type === 'all' ? [] : [type])])].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <label className={`event-auto ${automatic ? 'active' : ''}`}>
        <input type="checkbox" aria-label="Automaticky" checked={automatic} onChange={e => setAutomatic(e.target.checked)} />
        <span className="event-auto-switch" aria-hidden="true"><i /></span>
        <span><strong>Automaticky</strong><small>{automatic ? 'Každých 5 s' : 'Vypnuto'}</small></span>
      </label>
      <button className="ghost-action" type="button" title="Obnovit události" aria-label="Obnovit události" disabled={loading} onClick={() => void refresh()}><RefreshCw size={16} /></button>
      <button className="ghost-action" type="button" title="Export filtrovaných událostí (JSON)" aria-label="Export filtrovaných událostí" disabled={!filtered.length} onClick={exportLogs}><Download size={16} /></button>
    </div>
    {failed && <p role="alert">Události se nepodařilo načíst. {updatedAt ? 'Zobrazen je poslední načtený seznam.' : 'Zkontrolujte připojení a API token.'}</p>}
    <div className="log-panel">
      <div className="log-title"><span>{filtered.length} / {logs.length} událostí · posledních nejvýše 100</span><em>{loading ? 'NAČÍTÁNÍ' : failed ? 'NEAKTUÁLNÍ' : automatic ? 'OBNOVA 5 s' : 'RUČNĚ'}</em></div>
      {updatedAt && <p className="event-updated">Načteno {new Date(updatedAt).toLocaleString()}</p>}
      <div className="log-lines">
        {!filtered.length && <p>{loading ? 'Načítání událostí…' : logs.length ? 'Filtru neodpovídají žádné události.' : 'Žádné načtené události.'}</p>}
        {filtered.map(log => <div className="log-line" key={log.id}>
          <time dateTime={log.time}>{new Date(log.time).toLocaleString()}</time>
          <i className={log.level === 'warn' || log.level === 'error' ? log.level : log.type}>{log.type} · {log.level}</i>
          <p>{log.message}</p>
        </div>)}
      </div>
    </div>
  </>;
}
