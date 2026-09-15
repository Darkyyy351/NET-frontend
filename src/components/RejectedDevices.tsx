import { useEffect, useState } from 'react';
import { Cpu, RefreshCw, RotateCcw, ShieldCheck, ShieldX } from 'lucide-react';
import { decideConnection, getConnectionRequests, type Device } from '../api/devices';

export function RejectedDevices({ onReopened }: { onReopened: (device: Device) => void }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getConnectionRequests('rejected').then(result => {
      if (!cancelled) { setDevices(result); setError(''); }
    }).catch(() => {
      if (!cancelled) setError('Zamítnutá zařízení se nepodařilo načíst.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);
  const reopen = async (device: Device) => {
    if (busy) return;
    setBusy(device.id);
    setError('');
    try {
      await decideConnection(device.id, 'pending');
      setDevices(current => current.filter(d => d.id !== device.id));
      onReopened({ ...device, admission: 'pending' });
    } catch { setError('Žádost se nepodařilo obnovit. Obnovte seznam a zkuste to znovu.'); }
    finally { setBusy(null); }
  };
  return <section className="rejected-devices" aria-labelledby="rejected-title">
    <header className="rejected-header">
      <div className="rejected-heading">
        <span className="rejected-heading-icon"><ShieldX size={20} /></span>
        <div><span className="rejected-kicker">Řízení zařízení</span><h2 id="rejected-title">Zamítnuté žádosti</h2>
          <p>Zařízení, kterým byl odepřen přístup. Žádost lze bezpečně vrátit do fronty ke schválení.</p></div>
      </div>
      <div className="rejected-header-actions"><span className="request-count"><strong>{loading ? '…' : devices.length}</strong> zamítnuto</span>
        <button className="ghost-action request-icon-button" title="Obnovit seznam" aria-label="Obnovit zamítnuté žádosti" disabled={loading || !!busy} onClick={() => setRevision(v => v + 1)}><RefreshCw size={16} className={loading ? 'is-spinning' : ''} /></button></div>
    </header>
    {error && <p className="panel-error" role="alert">{error}</p>}
    <div className="rejected-list">
      {loading ? <div className="request-empty" role="status"><RefreshCw size={20} className="is-spinning" /><div><strong>Načítám žádosti</strong><span>Kontroluji seznam zamítnutých zařízení…</span></div></div> :
        !error && devices.length === 0 ? <div className="request-empty clear"><ShieldCheck size={22} /><div><strong>Fronta je čistá</strong><span>Žádné zamítnuté žádosti.</span></div></div> : devices.map(device => <div className="rejected-device-row" key={device.id}>
          <span className="request-device-icon"><Cpu size={19} /></span>
          <div className="rejected-device-copy"><strong>{device.name}</strong><code>{device.id}</code>
            <div className="request-metadata"><span>{device.ip || 'Neznámá IP'}</span><span>{device.firmware || 'Neznámý firmware'}</span></div></div>
          <button className="ghost-action request-restore" disabled={!!busy} onClick={() => reopen(device)}><RotateCcw size={15} className={busy === device.id ? 'is-spinning' : ''} />{busy === device.id ? 'Obnovuji…' : 'Vrátit ke schválení'}</button>
        </div>)}
    </div>
  </section>;
}
