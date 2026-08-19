import { useState, type FC, type FormEvent } from "react";
import { addDevice } from "../api/devices";

interface AddDevicePanelProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export const AddDevicePanel: FC<AddDevicePanelProps> = ({ open, onClose, onAdded }) => {
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [type, setType] = useState("esp");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("Device name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await addDevice({ name: name.trim(), ip: ip.trim() || undefined, type });
      setName("");
      setIp("");
      setType("esp");
      onAdded();
      onClose();
    } catch (err) {
      console.error("Error adding device", err);
      setError("Device could not be added.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`add-device-modal ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="panel-header">
        <div>
          <h3>Add Device</h3>
          <p>Manual enrollment for NET 0.1 test environment.</p>
        </div>
        <button className="close-panel" onClick={onClose} aria-label="Close add device panel">
          x
        </button>
      </div>

      <form className="panel-form" onSubmit={handleSubmit}>
        <label>Device Name</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          type="text"
          placeholder="ESP Workshop"
        />

        <label>IP Address</label>
        <input
          value={ip}
          onChange={(event) => setIp(event.target.value)}
          type="text"
          placeholder="192.168.1.150"
        />

        <label>Device Type</label>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="esp">ESP generic</option>
          <option value="wled">WLED node</option>
          <option value="sensor">Sensor node</option>
          <option value="relay">Relay node</option>
        </select>

        <div className="modal-future-box">
          <strong>Future enrollment</strong>
          <span>Auto discovery, QR pairing and ESP allowlist will plug into this dialog later.</span>
        </div>

        {error && <div className="panel-error">{error}</div>}

        <button type="submit" className="save-btn" disabled={saving}>
          {saving ? "Adding..." : "Add Device"}
        </button>
      </form>
    </section>
  );
};
