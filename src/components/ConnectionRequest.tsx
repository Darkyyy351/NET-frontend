import { useEffect, useRef, useState } from 'react';
import { Check, Radio, X } from 'lucide-react';
import { decideConnection, type Device } from '../api/devices';

export function ConnectionRequest({ device, onClose, onDecided }: {
  device: Device; onClose: () => void; onDecided: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  const decide = async (decision: 'approved' | 'rejected') => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await decideConnection(device.id, decision); onDecided(); }
    catch { setError('Rozhodnutí se nepodařilo uložit. Zkuste to znovu.'); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="connection-request" aria-labelledby="connection-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><Radio size={22} /><h2 id="connection-title">Žádost o připojení</h2>
      <button className="ghost-action request-icon-button" onClick={onClose} disabled={busy} title="Později" aria-label="Později"><X size={18} /></button></header>
    <div className="request-identity"><span className="request-state">Čeká na schválení</span><h3>{device.id}</h3></div>
    <dl><dt>Název</dt><dd>{device.name}</dd><dt>Hlášený typ</dt><dd>{device.type}</dd>
      <dt>IP adresa</dt><dd>{device.ip || 'Neznámá'}</dd><dt>Firmware</dt><dd>{device.firmware || 'Neznámý'}</dd></dl>
    {error && <p role="alert" className="panel-error">{error}</p>}
    <footer><button className="secondary-button" disabled={busy} onClick={() => decide('rejected')}><X size={16} /> Zamítnout</button>
      <button className="primary-action" disabled={busy} onClick={() => decide('approved')}><Check size={16} /> {busy ? 'Ukládám…' : 'Přijmout'}</button></footer>
  </dialog>;
}
