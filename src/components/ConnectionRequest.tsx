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
    setBusy(true);
    setError('');
    try { await decideConnection(device.id, decision); onDecided(); }
    catch { setError('Rozhodnuti se nepodarilo ulozit. Zkuste to znovu.'); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="connection-request" aria-labelledby="connection-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><Radio size={22} /><h2 id="connection-title">Zadost o pripojeni</h2>
      <button className="ghost-action" onClick={onClose} disabled={busy} title="Pozdeji" aria-label="Pozdeji"><X size={18} /></button></header>
    <h3>{device.id}</h3>
    <dl><dt>Nazev</dt><dd>{device.name}</dd><dt>Hlaseny typ</dt><dd>{device.type}</dd>
      <dt>IP adresa</dt><dd>{device.ip || 'Neznama'}</dd><dt>Firmware</dt><dd>{device.firmware || 'Neznamy'}</dd></dl>
    {error && <p role="alert" className="panel-error">{error}</p>}
    <footer><button className="secondary-button" disabled={busy} onClick={() => decide('rejected')}><X size={16} /> Zamitnout</button>
      <button className="primary-action" disabled={busy} onClick={() => decide('approved')}><Check size={16} /> {busy ? 'Ukladam...' : 'Prijmout'}</button></footer>
  </dialog>;
}
