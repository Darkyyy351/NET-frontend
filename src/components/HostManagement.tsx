import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Download, Power, RefreshCw, X } from 'lucide-react';
import { api } from '../api/axios';

type Release = { version: string; backend: string; frontend: string; notes: string[] };
type HostStatus = { available: boolean; powerAvailable: boolean; updateState: string; checkedAt: string | null;
  checking: boolean; error?: string; release: Release | null;
  operation: { state: string; message?: string; version?: string; action?: string } };
type Action = 'install' | 'reboot' | 'poweroff' | 'cancel-power';
const labels: Record<string, string> = { current: 'Verze je aktuální', available: 'Dostupná aktualizace',
  unchecked: 'Zatím neověřeno', unavailable: 'Kontrola není dostupná', installing: 'Probíhá instalace' };
const confirmations: Record<Action, string> = { install: 'UPDATE NET', reboot: 'RESTART CM5', poweroff: 'VYPNOUT CM5', 'cancel-power': 'ZRUSIT' };
const actionNames: Record<Action, string> = { install: 'Instalovat aktualizaci', reboot: 'Restartovat CM5', poweroff: 'Vypnout CM5', 'cancel-power': 'Zrušit naplánovanou akci' };

export function HostManagement({ children }: { children: (panels: { updates: ReactNode; power: ReactNode }) => ReactNode }) {
  const [status, setStatus] = useState<HostStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [credential, setCredential] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const response = await api.get<{ data: HostStatus }>('/system/host-control');
        if (!disposed) { setStatus(response.data.data); setError(''); }
      } catch {
        if (!disposed) setError('Spojení s hostitelem není dostupné. Během aktualizace nebo restartu může být přerušení očekávané.');
      } finally { inFlight = false; }
    };
    void poll();
    const timer = window.setInterval(poll, 5000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!action) return;
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => trigger.current?.focus();
  }, [action]);
  const active = status?.operation.state === 'installing' || status?.operation.state === 'scheduled';
  const open = (next: Action) => {
    trigger.current = document.activeElement as HTMLElement;
    setCredential(''); setConfirmation(''); setSelectedRelease(status?.release || null); setAction(next);
  };
  const close = () => { if (!busy) { setCredential(''); setConfirmation(''); setAction(null); } };
  const [actionError, setActionError] = useState('');
  const perform = async (target: Action | 'check') => {
    if (busy) return;
    setBusy(true); setActionError('');
    try {
      const body = target === 'check' ? {} : { credential, confirmation, ...(target === 'install' ? selectedRelease : {}) };
      const response = await api.post<{ data: HostStatus }>(`/system/host-control/${target}`, body);
      setStatus(response.data.data); setError(''); setAction(null);
    } catch {
      setActionError('Akci se nepodařilo potvrdit. Ověřte administrační klíč a stav hostitele před opakováním.');
    } finally { setCredential(''); setBusy(false); }
  };
  const tone = error ? 'unavailable' : status?.operation.state === 'installing' ? 'installing' : status?.updateState || 'unchecked';
  const powerOperation = !!status?.operation.action || status?.operation.state === 'cancelled';
  const feedback = <>
    {status && status.operation.state !== 'idle' && <p className="host-operation" role="status">{({ installing: 'Probíhá instalace. Připojení může být dočasně přerušeno.', scheduled: 'Power akce je naplánovaná za jednu minutu.', succeeded: 'Aktualizace dokončena. Obnovte stránku.', failed: 'Aktualizace selhala. Zkontrolujte hostitelský log.', interrupted: 'Předchozí operace byla přerušena nebo hostitel restartován. Ověřte jeho stav.', cancelled: 'Naplánovaná akce byla zrušena.' } as Record<string, string>)[status.operation.state] || status.operation.state}</p>}
  </>;
  const updates = <div className="host-management">
    <section className={`release-status ${tone}`} aria-label="Aktualizace NET">
      <div className="host-section-heading"><h3><Download size={16} /> Aktualizace NET</h3>
        <span className="release-badge">{labels[tone] || 'Neznámý stav'}</span></div>
      <div className="release-summary">
        {tone === 'current' ? <CheckCircle2 size={24} /> : <Download size={24} />}
        <div><strong>{status?.release ? `NET ${status.release.version}` : 'Čeká na release záznam'}</strong>
          <p>Poslední úspěšná kontrola: {status?.checkedAt ? new Date(status.checkedAt).toLocaleString() : 'dosud neproběhla'}</p></div>
      </div>
      {status?.release && <ul className="release-notes">{status.release.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>}
      {(error || status?.error) && <p className="host-warning" role="status">{error || status?.error}</p>}
      {!status?.available && <p className="host-warning">Hostitelský pomocník není připojený. Jednorázová instalace na CM5 je nutná.</p>}
      <div className="host-actions">
        <button className="ghost-action" disabled={busy || !!active || !status?.available || !!error || status.checking} onClick={() => void perform('check')}><RefreshCw size={15} />{status?.checking ? 'Ověřuji…' : 'Ověřit nyní'}</button>
        <button className="primary" disabled={busy || !!active || tone !== 'available' || !status?.available} onClick={() => open('install')}><Download size={15} /> Instalovat</button>
      </div>
      <p className="host-caption">Automatická kontrola každých 15 minut. Instalace pouze po potvrzení.</p>
    </section>
    {!powerOperation && feedback}
  </div>;
  const power = <section className="host-power" aria-label="CM5 Infrastructure Master Control">
      <div className="host-section-heading"><h3><AlertTriangle size={16} /> CM5 Infrastructure Master Control</h3>
        <span className={`release-badge ${active ? 'occupied' : status?.powerAvailable && !error ? 'current' : 'unavailable'}`}>{error ? 'Nedostupné' : active ? 'Probíhá akce' : status?.powerAvailable ? 'Připraveno' : 'Nedostupné'}</span></div>
      <div className="host-actions">
        <button className="ghost-action" disabled={!status?.powerAvailable || !!error || busy || !!active} onClick={() => open('reboot')}><RefreshCw size={15} /> Restartovat CM5</button>
        <button className="host-danger" disabled={!status?.powerAvailable || !!error || busy || !!active} onClick={() => open('poweroff')}><Power size={15} /> Vypnout CM5</button>
        {status?.operation.state === 'scheduled' && <button className="ghost-action" disabled={busy || !!error} onClick={() => open('cancel-power')}>Zrušit naplánovanou akci</button>}
      </div>
      {powerOperation && feedback}
    </section>;
  return <>
    {children({ updates, power })}
    {actionError && <p className="host-warning" role="alert">{actionError}</p>}
    {action && <div className="host-confirm-backdrop"><div className="host-confirm" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="host-confirm-title" onKeyDown={e => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const nodes = Array.from(dialog.current!.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)'));
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      <div className="host-section-heading"><h3 id="host-confirm-title">{actionNames[action]}</h3><button aria-label="Zavřít potvrzení" disabled={busy} onClick={close}><X size={18} /></button></div>
      <p>{action === 'install' ? `Instalace NET ${selectedRelease?.version} krátce přeruší dostupnost. Proběhne záloha dat a kontrola kontejnerů.` : action === 'poweroff' ? 'CM5 se za jednu minutu vypne, včetně NET a dalších služeb. Opětovné zapnutí vyžaduje fyzický zásah nebo samostatný mechanismus probuzení.' : action === 'reboot' ? 'CM5 se za jednu minutu restartuje. Přeruší se všechny služby hostitele, nejen NET.' : 'Zrušení platí jen pro akci, kterou naplánoval NET.'}</p>
      <label>Administrační klíč<input type="password" autoComplete="off" value={credential} disabled={busy} onChange={e => setCredential(e.target.value)} /></label>
      <label>Napište {confirmations[action]}<input value={confirmation} disabled={busy} autoComplete="off" onChange={e => setConfirmation(e.target.value)} /></label>
      {actionError && <p className="host-warning" role="alert">{actionError}</p>}
      <div className="host-actions"><button disabled={busy} onClick={close}>Zpět</button><button className="host-danger" disabled={busy || credential.length < 32 || confirmation !== confirmations[action]} onClick={() => void perform(action)}>{busy ? 'Odesílám…' : actionNames[action]}</button></div>
    </div></div>}
  </>;
}
