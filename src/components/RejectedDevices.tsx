import { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
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
      if (!cancelled) setError('Zamitnuta zarizeni se nepodarilo nacist.');
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
    } catch { setError('Zadost se nepodarilo obnovit. Obnovte seznam a zkuste to znovu.'); }
    finally { setBusy(null); }
  };
  return <section className="rejected-devices" aria-labelledby="rejected-title">
    <header><h2 id="rejected-title">Zamitnute zadosti o pripojeni</h2>
      <button className="ghost-action" title="Obnovit seznam" aria-label="Obnovit zamitnute zadosti" disabled={loading || !!busy} onClick={() => setRevision(v => v + 1)}><RefreshCw size={16} /></button></header>
    {error && <p className="panel-error" role="alert">{error}</p>}
    {loading ? <p role="status">Nacitam...</p> : !error && devices.length === 0 ? <p>Zadne zamitnute zadosti.</p> : devices.map(device => <div className="rejected-device-row" key={device.id}>
      <div><strong>{device.id}</strong><span>{device.name} · {device.ip || 'Neznama IP'} · {device.firmware || 'Neznamy firmware'}</span></div>
      <button className="ghost-action" disabled={!!busy} onClick={() => reopen(device)}><RotateCcw size={15} />{busy === device.id ? 'Obnovuji...' : 'Vratit ke schvaleni'}</button>
    </div>)}
  </section>;
}
