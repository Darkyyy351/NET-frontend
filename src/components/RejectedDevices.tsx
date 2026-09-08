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
    <header><h2 id="rejected-title"><ShieldX size={18} />Zamítnuté žádosti <span className="request-count">{loading ? '…' : devices.length}</span></h2>
      <button className="ghost-action request-icon-button" title="Obnovit seznam" aria-label="Obnovit zamítnuté žádosti" disabled={loading || !!busy} onClick={() => setRevision(v => v + 1)}><RefreshCw size={16} className={loading ? 'is-spinning' : ''} /></button></header>
    {error && <p className="panel-error" role="alert">{error}</p>}
    {loading ? <p className="request-empty" role="status">Načítám žádosti…</p> : !error && devices.length === 0 ? <p className="request-empty"><ShieldCheck size={20} />Žádné zamítnuté žádosti</p> : devices.map(device => <div className="rejected-device-row" key={device.id}>
      <Cpu size={20} className="request-device-icon" />
      <div><strong>{device.id}</strong><span>{device.name}</span><span className="request-metadata">{device.ip || 'Neznámá IP'} · {device.firmware || 'Neznámý firmware'}</span></div>
      <button className="ghost-action request-restore" disabled={!!busy} onClick={() => reopen(device)}><RotateCcw size={15} className={busy === device.id ? 'is-spinning' : ''} />{busy === device.id ? 'Obnovuji…' : 'Vrátit ke schválení'}</button>
    </div>)}
  </section>;
}
