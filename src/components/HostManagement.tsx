import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleCheckBig, CircleX, Clock3, Download, LoaderCircle, Power, RefreshCw, X } from 'lucide-react';
import { api } from '../api/axios';
import { HoldPowerButton } from './HoldPowerButton';

type Release = { version: string; backend: string; frontend: string; notes: string[] };
type UpdateHistoryEntry = { version: string; state: 'baseline' | 'succeeded' | 'failed' | string; at: string | null; message?: string };
type HostStatus = { available: boolean; powerAvailable: boolean; updateState: string; checkedAt: string | null;
  checking: boolean; error?: string; release: Release | null;
  operation: { state: string; message?: string; version?: string; action?: string; at?: string };
  history?: UpdateHistoryEntry[] };
type Action = 'install' | 'reboot' | 'poweroff' | 'cancel-power';
const labels: Record<string, string> = { current: 'Verze je aktuální', available: 'Dostupná aktualizace',
  unchecked: 'Zatím neověřeno', unavailable: 'Kontrola není dostupná', installing: 'Probíhá instalace' };
const confirmations: Record<Action, string> = { install: 'UPDATE NET', reboot: 'RESTART CM5', poweroff: 'VYPNOUT CM5', 'cancel-power': 'ZRUSIT' };
const actionNames: Record<Action, string> = { install: 'Instalovat aktualizaci', reboot: 'Restartovat CM5', poweroff: 'Vypnout CM5', 'cancel-power': 'Zrušit naplánovanou akci' };
const baselineHistory: UpdateHistoryEntry[] = [{ version: '0.2.0-dev.2', state: 'baseline', at: null }];

export function HostManagement({ children }: { children: (panels: { updates: ReactNode; power: ReactNode }) => ReactNode }) {
  const [status, setStatus] = useState<HostStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [credential, setCredential] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [dismissedResult, setDismissedResult] = useState(() => window.localStorage.getItem('net-update-result-dismissed') || '');
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
      const body = target === 'check' ? {} : { credential, confirmation: target === 'cancel-power' ? confirmation : confirmations[target], ...(target === 'install' ? selectedRelease : {}) };
      const response = await api.post<{ data: HostStatus }>(`/system/host-control/${target}`, body);
      setStatus(response.data.data); setError(''); setAction(null);
    } catch {
      setActionError('Akci se nepodařilo potvrdit. Ověřte administrační klíč a stav hostitele před opakováním.');
    } finally { setCredential(''); setBusy(false); }
  };
  const tone = error ? 'unavailable' : status?.operation.state === 'installing' ? 'installing' : status?.updateState || 'unchecked';
  const powerOperation = !!status?.operation.action || status?.operation.state === 'cancelled';
  const history = status?.history?.length ? status.history : baselineHistory;
  const resultState = status?.operation.state === 'succeeded' || status?.operation.state === 'failed' ? status.operation.state : null;
  const resultKey = resultState ? `${resultState}:${status?.operation.version || 'unknown'}:${status?.operation.at || 'unknown'}` : '';
  const resultTime = status?.operation.at ? Date.parse(status.operation.at) : NaN;
  const showResult = !!resultState && resultKey !== dismissedResult && Number.isFinite(resultTime) && Math.abs(Date.now() - resultTime) < 86_400_000;
  const updateFrameState = status?.operation.state === 'installing' ? 'installing' : showResult ? resultState : null;
  const dismissResult = () => {
    window.localStorage.setItem('net-update-result-dismissed', resultKey);
    setDismissedResult(resultKey);
  };
  const feedback = <>
    {status && !['idle', 'succeeded', 'failed'].includes(status.operation.state) && <p className="host-operation" role="status">{({ installing: 'Probíhá instalace. Připojení může být dočasně přerušeno.', scheduled: 'Power akce je naplánovaná za jednu minutu.', interrupted: 'Předchozí operace byla přerušena nebo hostitel restartován. Ověřte jeho stav.', cancelled: 'Naplánovaná akce byla zrušena.' } as Record<string, string>)[status.operation.state] || status.operation.state}</p>}
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
      <div className="update-history">
        <div className="update-history-heading"><Clock3 size={15} /><div><strong>Historie aktualizací</strong><span>Poslední výsledky nasazení</span></div></div>
        <div className="update-history-list">
          {history.slice(0, 5).map((entry, index) => <div className={`update-history-item ${entry.state}`} key={`${entry.version}:${entry.at || index}`}>
            <span className="update-history-marker">{entry.state === 'succeeded' ? <CheckCircle2 size={14} /> : entry.state === 'failed' ? <CircleX size={14} /> : <Clock3 size={14} />}</span>
            <div><strong>NET {entry.version}</strong><small>{entry.state === 'succeeded' ? 'Instalace úspěšná' : entry.state === 'failed' ? 'Instalace neúspěšná' : 'Výchozí verze'}</small></div>
            <time>{entry.at ? new Date(entry.at).toLocaleString() : 'Před zavedením historie'}</time>
          </div>)}
        </div>
      </div>
    </section>
    {!powerOperation && feedback}
  </div>;
  const power = <section className="host-power" aria-label="CM5 Master Control">
      <div className="master-control-main">
        <span className="master-control-icon"><AlertTriangle size={21} /></span>
        <div className="master-control-copy"><span className="master-control-kicker">Řízení systému</span><h3>CM5 Master Control</h3>
          <p>Řízení celého hostitele. Restart i vypnutí ovlivní NET a všechny ostatní služby na CM5.</p></div>
        <span className={`master-control-status ${active ? 'occupied' : status?.powerAvailable && !error ? 'ready' : 'unavailable'}`}><i />{error ? 'Nedostupné' : active ? 'Probíhá akce' : status?.powerAvailable ? 'Připraveno' : 'Nedostupné'}</span>
      </div>
      <div className="master-control-actions">
        <button className="master-restart" aria-label="Restartovat CM5" disabled={!status?.powerAvailable || !!error || busy || !!active} onClick={() => open('reboot')}><span><RefreshCw size={17} /></span><div><strong>Restartovat CM5</strong><small>Bezpečný restart hostitele</small></div></button>
        <button className="master-poweroff" aria-label="Vypnout CM5" disabled={!status?.powerAvailable || !!error || busy || !!active} onClick={() => open('poweroff')}><span><Power size={17} /></span><div><strong>Vypnout CM5</strong><small>Vyžaduje následné zapnutí</small></div></button>
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
      {action === 'cancel-power' && <label>Napište {confirmations[action]}<input value={confirmation} disabled={busy} autoComplete="off" onChange={e => setConfirmation(e.target.value)} /></label>}
      {actionError && <p className="host-warning" role="alert">{actionError}</p>}
      <div className="host-actions"><button disabled={busy} onClick={close}>Zpět</button>
        {action === 'install' || action === 'reboot' || action === 'poweroff' ? <HoldPowerButton key={`${action}:${credential}`} tone={action === 'install' ? 'install' : 'danger'} label={busy ? 'Odesílám…' : actionNames[action]} disabled={busy || credential.length < 32 || !!error || (action !== 'install' && !status?.powerAvailable) || !!active} onConfirm={() => void perform(action)} /> :
          <button className="host-danger" disabled={busy || credential.length < 32 || confirmation !== confirmations[action]} onClick={() => void perform(action)}>{busy ? 'Odesílám…' : actionNames[action]}</button>}
      </div>
    </div></div>}
    {updateFrameState && <div className={`update-result-backdrop ${updateFrameState}`}><section className="update-result" role={updateFrameState === 'installing' ? 'dialog' : 'alertdialog'} aria-live="polite" aria-modal="true" aria-labelledby="update-result-title">
      <div className="update-stage-content" key={updateFrameState}>
        <span className="update-result-icon">{updateFrameState === 'installing' ? <LoaderCircle className="update-install-spinner" size={30} /> : updateFrameState === 'succeeded' ? <CircleCheckBig size={30} /> : <CircleX size={30} />}</span>
        <span className="update-result-kicker">NET {status?.operation.version || selectedRelease?.version || 'update'}</span>
        <h3 id="update-result-title">{updateFrameState === 'installing' ? 'Aktualizace se instaluje' : updateFrameState === 'succeeded' ? 'Aktualizace úspěšná' : 'Aktualizace neúspěšná'}</h3>
        <p>{updateFrameState === 'installing' ? 'Probíhá záloha dat, sestavení obrazů a kontrola služeb. NET může být krátce nedostupný.' : updateFrameState === 'succeeded' ? 'Nová verze je nasazená a služby prošly kontrolou. Obnovte stránku, aby se načetlo aktuální rozhraní.' : 'Původní verze zůstala nebo byla obnovena. Podrobnosti najdete v hostitelském update.log.'}</p>
        {updateFrameState === 'installing' ? <span className="update-progress-dots" aria-label="Instalace probíhá"><i /><i /><i /></span> : <div className="update-result-actions">
          {updateFrameState === 'succeeded' && <button className="update-refresh" onClick={() => window.location.reload()}><RefreshCw size={15} /> Obnovit stránku</button>}
          <button autoFocus className="update-done" onClick={dismissResult}>Hotovo</button>
        </div>}
      </div>
    </section></div>}
  </>;
}
