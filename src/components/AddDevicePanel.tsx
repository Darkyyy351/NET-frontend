import { useState, type FC, type FormEvent } from "react";
import { addDevice } from "../api/devices";

const deviceTypes = new Set(["esp", "wled", "sensor", "relay"]);

interface AddDevicePanelProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

function isValidIpv4(value: string) {
  const parts = value.split(".");

  return (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^\d{1,3}$/.test(part)) {
        return false;
      }

      const number = Number(part);
      return number >= 0 && number <= 255;
    })
  );
}

function errorMessage(err: unknown) {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response;

    if (response?.data?.error) {
      return response.data.error;
    }
  }

  return "Device could not be added. Check the fields and backend connection.";
}

export const AddDevicePanel: FC<AddDevicePanelProps> = ({ open, onClose, onAdded }) => {
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [type, setType] = useState("esp");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedIp = ip.trim();

    if (!trimmedName || !trimmedIp) {
      setError("Device name and IP address are required.");
      return;
    }

    if (!isValidIpv4(trimmedIp)) {
      setError("IP address must be a valid IPv4 address, for example 192.168.1.150.");
      return;
    }

    if (!deviceTypes.has(type)) {
      setError("Device type is invalid.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await addDevice({ name: trimmedName, ip: trimmedIp, type });
      setName("");
      setIp("");
      setType("esp");
      onAdded();
      onClose();
    } catch (err) {
      console.error("Error adding device", err);
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`add-device-modal ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="panel-header">
        <div>
          <h3>Add Device</h3>
          <p>Manual enrollment for the NET test environment.</p>
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

        {error && (
          <div className="panel-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="save-btn" disabled={saving}>
          {saving ? "Adding..." : "Add Device"}
        </button>
      </form>
    </section>
  );
};
