import { useState } from 'react';
import { Cpu, Save } from 'lucide-react';
import { assignDeviceBoard, type Device } from '../api/devices';
import { boards } from '../catalog/boards';

export function DeviceBoardAssignment({ device, onSaved, onOpen }: {
  device: Device; onSaved: (device: Device) => void; onOpen: (device: Device) => void;
}) {
  const [draft, setDraft] = useState(device.boardProfile?.id || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const assigned = boards.find(board => board.id === device.boardProfile?.id && board.revision === device.boardProfile?.revision);
  const chosen = boards.find(board => board.id === draft);
  const changed = draft !== (device.boardProfile?.id || '') || (!!chosen && chosen.revision !== device.boardProfile?.revision);
  const save = async () => {
    if (saving || !changed || (draft && !chosen)) return;
    setSaving(true); setMessage(''); setFailed(false);
    try {
      const updated = await assignDeviceBoard(device.id, chosen ? { id: chosen.id, revision: chosen.revision } : null);
      onSaved(updated);
      setMessage(chosen ? 'Model desky uložen.' : 'Přiřazení modelu odebráno.');
    } catch {
      setFailed(true);
      setMessage('Model se nepodařilo uložit. Ověř připojení, token a aktualizaci backendu.');
    } finally { setSaving(false); }
  };
  return <section className="device-board-assignment" aria-label="Model zařízení">
    <label className="board-selector">Model desky
      <select aria-label="Model desky" value={draft} disabled={saving} onChange={event => { setDraft(event.target.value); setMessage(''); }}>
        <option value="">Nepřiřazený</option>
        {device.boardProfile && !boards.some(board => board.id === device.boardProfile?.id) && <option value={device.boardProfile.id}>Neznámý profil ({device.boardProfile.id})</option>}
        {boards.map(board => <option key={board.id} value={board.id}>{board.name}</option>)}
      </select>
    </label>
    {device.boardProfile && !assigned && <p role="status">Uložený profil nebo jeho revizi tento frontend nezná.</p>}
    <div className="device-board-actions">
      <button type="button" className="secondary-button" disabled={saving || !changed || (!!draft && !chosen)} onClick={() => void save()}><Save size={14} />{saving ? 'Ukládání…' : 'Uložit model'}</button>
      <button type="button" className="secondary-button" disabled={!assigned || saving || changed} onClick={() => onOpen(device)}><Cpu size={14} />Pinout zařízení</button>
    </div>
    {message && <p className={failed ? 'panel-error' : 'device-board-success'} role={failed ? 'alert' : 'status'}>{message}</p>}
  </section>;
}
