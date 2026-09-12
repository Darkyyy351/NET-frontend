import { useState } from 'react';
import { Save } from 'lucide-react';
import { setDevicePurpose, type Device } from '../api/devices';

export function DevicePurpose({ device, onSaved }: { device: Device; onSaved: (device: Device) => void }) {
  const [value, setValue] = useState(device.purpose || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || value.trim() === (device.purpose || '')) return;
    setSaving(true); setMessage(''); setFailed(false);
    try {
      const updated = await setDevicePurpose(device.id, value.trim());
      onSaved(updated); setValue(updated.purpose || ''); setMessage('Účel uložen.');
    } catch { setFailed(true); setMessage('Účel se nepodařilo uložit. Zkus to znovu.'); }
    finally { setSaving(false); }
  };
  return <form className="device-purpose-editor" onSubmit={event => void save(event)}>
    <label htmlFor="device-purpose">Účel zařízení <span>Volitelné</span></label>
    <div className="device-purpose-input-row">
      <input id="device-purpose" value={value} maxLength={80} disabled={saving} placeholder="Např. osvětlení pracovního stolu" onChange={event => { setValue(event.target.value); setMessage(''); }} />
      <button className="secondary-button" type="submit" disabled={saving || value.trim() === (device.purpose || '')}><Save size={14} />{saving ? 'Ukládání…' : 'Uložit'}</button>
    </div>
    <div className="device-purpose-feedback"><span role={failed ? 'alert' : 'status'} className={failed ? 'purpose-error' : 'device-board-success'}>{message}</span><span>{value.length}/80</span></div>
  </form>;
}
