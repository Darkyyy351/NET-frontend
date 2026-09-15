import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { EventStream } from './components/EventStream';
import { HostManagement } from './components/HostManagement';
import { NotificationCenter } from './components/NotificationCenter';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCardSize } from './components/useCardSize';
import {
  Activity,
  Pencil,
  RotateCcw,
  Bell,
  Cable,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  Eye,
  Fan,
  FileText,
  Grid3X3,
  GitCommitHorizontal,
  KeyRound,
  Lock,
  Moon,
  MoreVertical,
  PackageCheck,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  Terminal,
  Thermometer,
  Trash2,
  Wifi,
  Wrench,
  X,
} from "lucide-react";
import { AddDevicePanel } from "./components/AddDevicePanel";
import { BoardCatalog } from './components/BoardCatalog';
import { DeviceBoardAssignment } from './components/DeviceBoardAssignment';
import { DevicePurpose } from './components/DevicePurpose';
import { ConnectionRequest } from './components/ConnectionRequest';
import { RejectedDevices } from './components/RejectedDevices';
import { getConnectionRequests, verifyDevice, type VerificationState } from './api/devices';
import { deleteDevice, getDeviceCommands, getDevices, queueCommand, type Device } from "./api/devices";
import { getLogs, type EventLog } from "./api/logs";
import {
  getHealthStatus,
  getFanControlStatus,
  getSystemStatus,
  setOperatingMode,
  startFanTest,
  stopFanTest,
  type FanControlStatus,
  type SystemService,
  type SystemStatus,
} from "./api/system";
import { getApiBaseUrl, getApiToken, saveApiConfig } from "./api/axios";
import { frontendBuild } from "./build";
import "./styles.css";

type View = "dashboard" | "monitoring" | "logs" | "security" | "settings" | "boards";
type CommandFeedback = {
  state: "sending" | "queued" | "waiting" | "success" | "failed";
  label: string;
};
type CoreTone = "stable" | "attention" | "critical" | "neutral";

const viewItems: Array<{ id: View; label: string; icon: typeof Grid3X3 }> = [
  { id: "dashboard", label: "Dashboard", icon: Grid3X3 },
  { id: "monitoring", label: "Monitoring", icon: Activity },
  { id: "logs", label: "Logs", icon: Terminal },
  { id: "security", label: "Security", icon: Shield },
  { id: "settings", label: "Nastavení", icon: Settings },
  { id: "boards", label: "Katalog desek", icon: Cpu },
];

const fallbackServiceStatuses: SystemService[] = [
  {
    id: "backend-api",
    name: "NET Backend API",
    status: "unavailable",
    detail: "Stav API není dostupný.",
  },
  {
    id: "docker-compose",
    name: "Docker Compose Runtime",
    status: "unavailable",
    detail: "Běhové prostředí se nepodařilo ověřit.",
  },
  {
    id: "mqtt",
    name: "Future MQTT Broker",
    status: "planned",
    detail: "Reserved for NET 1.0 low-latency messaging and automations",
  },
];

const monitoringModules = [
  { title: "Network latency map", value: "planned", text: "Per-device ping, packet loss and local subnet route checks." },
  { title: "Storage watchdog", value: "planned", text: "JSON store size, backup age and future database disk pressure." },
  { title: "Externí upozornění", value: "planned", text: "Telegram a e-mail. Upozornění ve webu a historie dostupnosti jsou implementované." },
];

const securityModules = [
  { title: "Oddělené přístupy", text: "Samostatné přihlašovací údaje pro dashboard a jednotlivá zařízení.", icon: KeyRound, status: "Plánováno" },
  { title: "Schvalování zařízení", text: "Přijetí, odmítnutí a opětovné otevření žádosti. Neschválená zařízení nesmí přijímat příkazy.", icon: Shield, status: "Implementováno" },
  { title: "Záznam událostí", text: "Příkazy, potvrzení a změny zařízení najdete v Logs. Identitu uživatele sdílený token zatím nerozlišuje.", icon: FileText, status: "Základ implementován" },
  { title: "Kontrola vystavení sítě", text: "Automatické ověření dostupnosti API mimo důvěryhodnou síť zatím není implementováno.", icon: Eye, status: "Plánováno" },
];

function formatLastSeen(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function nodeUptime(device: Device) {
  return freshTelemetry(device) ? formatUptime(device.telemetry!.uptimeSeconds) : "N/A";
}

function freshTelemetry(device: Device) {
  return device.status === "online" && device.telemetry &&
    Date.now() - Date.parse(device.telemetry.receivedAt) < 35000;
}

function deviceStatusClass(status: string) {
  if (status === "online") {
    return "online";
  }

  if (status === "offline") {
    return "offline";
  }

  return "unknown";
}

function serviceIcon(serviceId: string) {
  if (serviceId === "backend-api") {
    return Server;
  }

  if (serviceId === "docker-compose") {
    return Database;
  }

  if (serviceId === "mqtt") {
    return Radio;
  }

  return Cable;
}

function formatCapacity(value?: number | null) {
  if (!Number.isFinite(value) || !value) {
    return "N/A";
  }

  const gigabytes = value / 1024 / 1024 / 1024;

  if (gigabytes >= 1) {
    return `${gigabytes.toFixed(1)} GB`;
  }

  return `${Math.round(value / 1024 / 1024)} MB`;
}

function formatPercent(value?: number | null) {
  return Number.isFinite(value) ? `${value?.toFixed(1)}%` : "N/A";
}

function formatTemperature(value?: number | null) {
  return Number.isFinite(value) ? `${value?.toFixed(1)} C` : "N/A";
}

function formatRpm(value?: number | null) {
  return Number.isFinite(value) ? `${Math.round(value as number)} RPM` : "N/A";
}

function metricTone(value: number | null | undefined, attentionAt: number, criticalAt: number): CoreTone {
  if (!Number.isFinite(value)) {
    return "neutral";
  }

  if ((value as number) >= criticalAt) {
    return "critical";
  }

  return (value as number) >= attentionAt ? "attention" : "stable";
}

function coreHealth(status: SystemStatus | null): { label: string; tone: CoreTone } {
  if (!status) {
    return { label: "Awaiting telemetry", tone: "neutral" };
  }

  const { cpu, memory, storage, temperatureC, fan } = status.host;
  const values = [cpu.usagePercent, memory.usagePercent, storage.usagePercent, temperatureC];

  if (!values.some((value) => Number.isFinite(value))) {
    return { label: "Awaiting telemetry", tone: "neutral" };
  }

  const reaches = (value: number | null, threshold: number) => (
    typeof value === "number" && Number.isFinite(value) && value >= threshold
  );
  const fanFault = fan?.available && Number(fan.pwm) > 0 && fan.rpm === 0;
  const critical = reaches(cpu.usagePercent, 95) || reaches(memory.usagePercent, 95) ||
    reaches(storage.usagePercent, 98) || reaches(temperatureC, 85) || fanFault;

  if (critical) {
    return { label: "Critical", tone: "critical" };
  }

  const attention = reaches(cpu.usagePercent, 85) || reaches(memory.usagePercent, 85) ||
    reaches(storage.usagePercent, 90) || reaches(temperatureC, 67.5);

  return attention
    ? { label: "Attention", tone: "attention" }
    : { label: "Stable", tone: "stable" };
}

function fanState(status: SystemStatus | null): { label: string; tone: CoreTone } {
  const fan = status?.host.fan;

  if (!fan?.available) {
    return { label: "Unavailable", tone: "neutral" };
  }

  if (Number(fan.pwm) > 0 && fan.rpm === 0) {
    return { label: "Check fan", tone: "critical" };
  }

  return Number(fan.rpm) > 0
    ? { label: "Active", tone: "stable" }
    : { label: "Idle", tone: "neutral" };
}

function formatUptime(seconds?: number) {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return "N/A";
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function shortCommit(value?: string | null) {
  if (!value) {
    return "N/A";
  }

  return value === "development" ? value : value.slice(0, 12);
}

function formatDeploymentTime(value?: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid timestamp";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function deploymentStatusClass(status?: string) {
  if (status === "healthy") {
    return "healthy";
  }

  if (status === "rolled_back") {
    return "rolled-back";
  }

  return "unknown";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function App() {
  const cardLayout = useCardSize();
  const reducedMotion = useReducedMotion();
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  useEffect(() => {
    if (!selectedDevice) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedDevice(null); };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [selectedDevice]);
  const [boardDeviceId, setBoardDeviceId] = useState<string | null>(null);
  const [devicePendingRemoval, setDevicePendingRemoval] = useState<Device | null>(null);
  const [deleteState, setDeleteState] = useState<"idle" | "deleting" | "error">("idle");
  const [devices, setDevices] = useState<Device[]>([]);
  const sizingDeviceId = devices.find(device => device.id === cardLayout.activeId)?.id || devices[0]?.id;
  const [requests, setRequests] = useState<Device[]>([]);
  const [admissionRevision, setAdmissionRevision] = useState(0);
  const [dismissedRequests, setDismissedRequests] = useState<string[]>([]);
  const [verification, setVerification] = useState<Record<string, { state: VerificationState; at: string }>>({});
  const activeRequest = requests.find(d => !dismissedRequests.includes(d.id));

  useEffect(() => {
    let disposed = false;
    let busy = false;
    const poll = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try { const result = await getConnectionRequests(); if (!disposed) setRequests(result); }
      catch { /* Older backends do not expose admission requests. */ }
      finally { busy = false; }
    };
    void poll();
    const interval = window.setInterval(poll, 5000);
    return () => { disposed = true; window.clearInterval(interval); };
  }, []);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [logsFailed, setLogsFailed] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsUpdatedAt, setLogsUpdatedAt] = useState<string | null>(null);
  const logsBusy = useRef(false);
  const [commandFeedback, setCommandFeedback] = useState<Record<string, CommandFeedback>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState(() => getApiBaseUrl());
  const [apiToken, setApiToken] = useState(() => getApiToken());
  const [connectionState, setConnectionState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [connectionMessage, setConnectionMessage] = useState("Runtime config is loaded from this browser.");
  const [modeChangeState, setModeChangeState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [fanControlStatus, setFanControlStatus] = useState<FanControlStatus | null>(null);
  const [fanControlAction, setFanControlAction] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [fanControlMessage, setFanControlMessage] = useState("Manual tests return to kernel control after 60 seconds.");
  const [deviceRefreshState, setDeviceRefreshState] = useState<"idle" | "refreshing" | "success" | "error">("idle");

  const loadDevices = async ({ background = false, fresh = false }: { background?: boolean; fresh?: boolean } = {}) => {
    if (!background) {
      setLoading(true);
    }

    try {
      setDevices(await getDevices({ fresh }));
      setError(null);
      return true;
    } catch (err) {
      console.error("Error loading devices", err);
      setError("Backend is unreachable or the API token is invalid.");
      return false;
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  };

  const loadSystemStatus = async () => {
    try {
      setSystemStatus(await getSystemStatus());
    } catch (err) {
      console.warn("System status endpoint unavailable", err);
      setSystemStatus(null);
    }
  };

  const loadLogs = async () => {
    if (logsBusy.current) return;
    logsBusy.current = true;
    setLogsLoading(true);
    try {
      setEventLogs(await getLogs(100));
      setLogsFailed(false);
      setLogsUpdatedAt(new Date().toISOString());
    } catch (err) {
      console.warn("Logs endpoint unavailable", err);
      setLogsFailed(true);
    } finally {
      logsBusy.current = false;
      setLogsLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadDevices(), loadSystemStatus(), loadLogs()]);
  };

  const refreshDeviceList = async () => {
    if (deviceRefreshState === "refreshing") return;
    setDeviceRefreshState("refreshing");
    try {
      const latest = await getDevices({ fresh: true });
      setDevices(latest);
      setError(null);
      const pending = [...latest];
      let failed = false;
      await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
        while (pending.length) {
          const device = pending.shift()!;
          setVerification(current => ({ ...current, [device.id]: { state: 'checking', at: '' } }));
          let state: VerificationState;
          try { state = await verifyDevice(device.id); }
          catch { state = 'error'; }
          if (state === 'error') failed = true;
          setVerification(current => ({ ...current, [device.id]: { state, at: new Date().toLocaleTimeString() } }));
        }
      }));
      if (!await loadDevices({ background: true, fresh: true })) failed = true;
      setDeviceRefreshState(failed ? 'error' : 'success');
    } catch {
      setError('Stav zařízení se nepodařilo ověřit.');
      setDeviceRefreshState('error');
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (activeView !== "dashboard" && activeView !== "monitoring") {
      return undefined;
    }

    let disposed = false;
    let requestInFlight = false;
    const intervalSeconds = systemStatus?.operatingMode.mode === "eco" ? 30 : 5;

    const refreshDeviceStatus = async () => {
      if (disposed || document.visibilityState !== "visible" || requestInFlight) {
        return;
      }

      requestInFlight = true;
      await loadDevices({ background: true });
      requestInFlight = false;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshDeviceStatus();
      }
    };

    refreshDeviceStatus();
    const intervalId = window.setInterval(refreshDeviceStatus, intervalSeconds * 1000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeView, systemStatus?.operatingMode.mode]);

  useEffect(() => {
    setSelectedDevice((current) => {
      if (!current) return null;
      return devices.find((device) => device.id === current.id) || null;
    });
  }, [devices]);

  useEffect(() => {
    if (activeView !== "monitoring") {
      return undefined;
    }

    let disposed = false;
    let requestInFlight = false;
    const intervalSeconds = systemStatus?.operatingMode.monitoringIntervalSeconds || 1;

    const refreshTelemetry = async () => {
      if (document.visibilityState !== "visible" || requestInFlight) {
        return;
      }

      requestInFlight = true;

      try {
        const status = await getSystemStatus();

        if (!disposed) {
          setSystemStatus(status);
        }
      } catch (err) {
        console.warn("Live telemetry refresh failed", err);
      } finally {
        requestInFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshTelemetry();
      }
    };

    refreshTelemetry();
    const intervalId = window.setInterval(refreshTelemetry, intervalSeconds * 1000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeView, systemStatus?.operatingMode.monitoringIntervalSeconds]);

  useEffect(() => {
    if (activeView !== "settings") {
      return undefined;
    }

    let disposed = false;
    const refreshFanControl = async () => {
      try {
        const status = await getFanControlStatus();
        if (!disposed) setFanControlStatus(status);
      } catch {
        if (!disposed) setFanControlStatus(null);
      }
    };

    refreshFanControl();
    const intervalId = window.setInterval(refreshFanControl, 1000);
    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [activeView]);

  const filteredDevices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return devices;
    }

    return devices.filter((device) => {
      return (
        device.name.toLowerCase().includes(term) ||
        (device.ip || "").includes(term) ||
        device.id.toLowerCase().includes(term)
      );
    });
  }, [devices, searchTerm]);

  const onlineCount = devices.filter((device) => device.status === "online").length;
  const offlineCount = devices.filter((device) => device.status === "offline").length;
  const visibleServiceStatuses = systemStatus?.services || fallbackServiceStatuses;

  const saveConnectionConfig = async () => {
    saveApiConfig({ baseUrl: apiBaseUrl, token: apiToken });
    setConnectionState("idle");
    setConnectionMessage("API config saved in this browser.");
    await refreshAll();
  };

  const testConnection = async () => {
    saveApiConfig({ baseUrl: apiBaseUrl, token: apiToken });
    setConnectionState("testing");
    setConnectionMessage("Testing health and authorized system status endpoints...");

    try {
      const [health, status] = await Promise.all([getHealthStatus(), getSystemStatus()]);

      setSystemStatus(status);
      setConnectionState("success");
      setConnectionMessage(`Connected to ${health.status}. Backend uptime ${formatUptime(health.uptime)}.`);
      await loadDevices();
    } catch (err) {
      console.error("Connection test failed", err);
      setSystemStatus(null);
      setConnectionState("error");
      setConnectionMessage("Connection failed. Check API URL, CORS and bearer token.");
    }
  };

  const changeOperatingMode = async (mode: "normal" | "eco") => {
    if (mode === systemStatus?.operatingMode.mode || modeChangeState === "saving") {
      return;
    }

    setModeChangeState("saving");

    try {
      setSystemStatus(await setOperatingMode(mode));
      setModeChangeState("success");
      await loadLogs();
    } catch (err) {
      console.error("Operating mode change failed", err);
      setModeChangeState("error");
    }
  };

  const runFanTest = async (state: number) => {
    if (!fanControlStatus?.available || fanControlAction === "saving") return;
    setFanControlAction("saving");
    setFanControlMessage(`Applying fan state ${state}...`);

    try {
      setFanControlStatus(await startFanTest(state, 60));
      setFanControlAction("success");
      setFanControlMessage("Manual test active. Kernel control will return automatically.");
      await loadLogs();
    } catch (error) {
      console.error("Fan test failed", error);
      setFanControlAction("error");
      setFanControlMessage("Fan test was rejected by the safety helper.");
    }
  };

  const returnFanToSystem = async () => {
    if (!fanControlStatus?.available || fanControlAction === "saving") return;
    setFanControlAction("saving");
    setFanControlMessage("Restoring kernel fan control...");

    try {
      setFanControlStatus(await stopFanTest());
      setFanControlAction("success");
      setFanControlMessage("Kernel step_wise control restored.");
      await loadLogs();
    } catch (error) {
      console.error("Fan control restore failed", error);
      setFanControlAction("error");
      setFanControlMessage("Could not reach the fan safety helper.");
    }
  };

  const runCommand = async (device: Device, type: "identify" | "reboot") => {
    const label = type === "identify" ? "Identify" : "Reboot";

    setCommandFeedback((current) => ({
      ...current,
      [device.id]: { state: "sending", label: `${label} sending...` },
    }));

    try {
      const command = await queueCommand(device.id, {
        type,
        payload: type === "identify" ? { times: 2 } : {},
      });

      setCommandFeedback((current) => ({
        ...current,
        [device.id]: { state: "queued", label: `${label} queued` },
      }));
      setActiveMenuId(null);
      setDevices(await getDevices());
      await Promise.all([loadSystemStatus(), loadLogs()]);

      for (let attempt = 0; attempt < 20; attempt += 1) {
        await wait(1500);

        const commands = await getDeviceCommands(device.id);
        const updatedCommand = commands.find((item) => item.id === command.id);

        if (updatedCommand?.status === "done") {
          setCommandFeedback((current) => ({
            ...current,
            [device.id]: { state: "success", label: `${label} success` },
          }));
          await Promise.all([loadDevices(), loadLogs()]);
          return;
        }

        if (updatedCommand?.status === "failed") {
          setCommandFeedback((current) => ({
            ...current,
            [device.id]: { state: "failed", label: `${label} failed` },
          }));
          await loadLogs();
          return;
        }

        if (attempt === 3) {
          setCommandFeedback((current) => ({
            ...current,
            [device.id]: { state: "waiting", label: `${label} waiting for device ack` },
          }));
        }
      }

      setCommandFeedback((current) => ({
        ...current,
        [device.id]: { state: "queued", label: `${label} queued, no ack yet` },
      }));
    } catch (err) {
      console.error("Error queueing command", err);
      setCommandFeedback((current) => ({
        ...current,
        [device.id]: { state: "failed", label: `${label} failed` },
      }));
    }
  };

  const requestDeviceRemoval = (device: Device) => {
    setActiveMenuId(null);
    setDeleteState("idle");
    setDevicePendingRemoval(device);
  };

  const removeDevice = async () => {
    if (!devicePendingRemoval || deleteState === "deleting") {
      return;
    }

    setDeleteState("deleting");

    try {
      await deleteDevice(devicePendingRemoval.id);
      setDevices((current) => current.filter((device) => device.id !== devicePendingRemoval.id));
      setDevicePendingRemoval(null);
      setDeleteState("idle");
      await Promise.all([loadLogs(), loadSystemStatus()]);
    } catch (err) {
      console.error("Error removing device", err);
      setDeleteState("error");
    }
  };

  const openDeviceDetail = (device: Device) => {
    setIsPanelOpen(false);
    setActiveMenuId(null);
    setSelectedDevice(device);
  };

  return (
    <div className="net-shell">
      <aside className="core-sidebar">
        <div>
          <div className="core-brand">
            <span className="brand-pulse" />
            <span>
              NET CORE <strong>{frontendBuild.version}</strong>
            </span>
          </div>

          <nav className="core-nav">
            {viewItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  className={`core-nav-item ${activeView === item.id ? "active" : ""}`}
                  onClick={() => { setActiveView(item.id); setBoardDeviceId(null); }}
                  type="button"
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="notification-nav"><NotificationCenter key={getApiBaseUrl()} scope={getApiBaseUrl()} /></div>
        </div>

        <div className="sidebar-status">NET CORE - DASHBOARD</div>
      </aside>

      <main className="core-main">
        {activeView === 'boards' && (boardDeviceId ? (
          <BoardCatalog key={boardDeviceId} device={devices.find(device => device.id === boardDeviceId) || null}
            connectionError={!!error} onBack={() => { setBoardDeviceId(null); setActiveView('dashboard'); }} />
        ) : <BoardCatalog />)}
        {activeView === "dashboard" && (
          <section className="view-stack">
            <div className="view-header">
              <div>
                <h1>Dashboard</h1>
                <p>Rychlý přehled a ovládání aktivních uzlů v síti.</p>
              </div>

              <div className="view-actions">
                <label className="search-box">
                  <Search size={14} />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Hledat zařízení..."
                    type="text"
                  />
                </label>

                <button
                  className={`ghost-action device-refresh-action ${deviceRefreshState}`}
                  disabled={deviceRefreshState === "refreshing"}
                  onClick={refreshDeviceList}
                  title={`Automatic status refresh every ${systemStatus?.operatingMode.mode === "eco" ? 30 : 5} seconds`}
                  type="button"
                >
                  {deviceRefreshState === "success" ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <RefreshCw className={deviceRefreshState === "refreshing" ? "is-spinning" : ""} size={14} />
                  )}
                  {deviceRefreshState === "refreshing"
                    ? "Refreshing"
                    : deviceRefreshState === "success"
                      ? "Updated"
                      : deviceRefreshState === "error"
                        ? "Failed"
                        : "Refresh"}
                </button>

                <button className="primary-action" onClick={() => setIsPanelOpen(true)} type="button">
                  <Plus size={14} />
                  Add Device
                </button>
                <button className="ghost-action" type="button" aria-pressed={cardLayout.editing} onClick={() => cardLayout.setEditing(value => !value)}>
                  {cardLayout.editing ? <CheckCircle2 size={14} /> : <Pencil size={14} />}{cardLayout.editing ? 'Hotovo' : 'Edit'}
                </button>
                {requests.length > 0 && <button className="ghost-action" onClick={() => setDismissedRequests([])} type="button">
                  <Radio size={14} /> Žádosti ({requests.length})
                </button>}
              </div>
            </div>

            <div className="stats-row">
              <div className="stat-tile">
                <span>Celkem</span>
                <strong>{devices.length}</strong>
              </div>
              <div className="stat-tile">
                <span>Online</span>
                <strong className="success">{onlineCount}</strong>
              </div>
              <div className="stat-tile">
                <span>Offline</span>
                <strong className="danger">{offlineCount}</strong>
              </div>
            </div>
            {cardLayout.editing && sizingDeviceId && <div className="card-layout-toolbar">
              <select aria-label="Upravovaná karta" value={sizingDeviceId} onChange={event => cardLayout.setActiveId(event.target.value)}>{devices.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}</select>
              <label htmlFor="card-size">Velikost</label>
              <input id="card-size" type="range" min={280} max={520} step={20} value={cardLayout.sizeOf(sizingDeviceId)} onChange={event => cardLayout.setSize(sizingDeviceId, Number(event.target.value))} />
              <output htmlFor="card-size">{cardLayout.sizeOf(sizingDeviceId)} px</output>
              <button className="icon-button" type="button" title="Výchozí velikost této karty" aria-label="Výchozí velikost této karty" onClick={() => cardLayout.setSize(sizingDeviceId, 320)}><RotateCcw size={15} /></button>
            </div>}

            {loading && <div className="state-card">Loading devices...</div>}
            {error && <div className="state-card error">{error}</div>}

            {!loading && !error && filteredDevices.length === 0 && (
              <div className="state-card">No devices match the current filter.</div>
            )}

            {!loading && !error && filteredDevices.length > 0 && (
              <div className={`v4-device-grid is-sizeable ${cardLayout.editing ? 'is-editing' : ''}`}>
                {filteredDevices.map((device) => {
                  const feedback = commandFeedback[device.id];
                  const isSending = feedback?.state === "sending" || feedback?.state === "waiting";
                  const statusClass = deviceStatusClass(device.status);

                  return (
                    <article
                      className={`v4-device-card ${activeMenuId === device.id ? "menu-open" : ""}`}
                      key={device.id}
                      style={{ '--card-width': `${cardLayout.sizeOf(device.id)}px`, '--card-height': `${200 + (cardLayout.sizeOf(device.id) - 280) / 3}px` } as CSSProperties}
                    >
                      {cardLayout.editing && <button className="card-resize-handle" type="button" title="Změnit velikost karet" aria-label={`Změnit velikost karet: ${device.name}`}
                        onPointerDown={event => cardLayout.start(event, device.id)} onPointerMove={cardLayout.move} onPointerUp={cardLayout.stop} onPointerCancel={cardLayout.stop} onLostPointerCapture={cardLayout.stop}
                        onKeyDown={event => {
                          if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
                            event.preventDefault();
                            cardLayout.setSize(device.id, event.key === 'Home' ? 280 : event.key === 'End' ? 520 : cardLayout.sizeOf(device.id) + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 20 : -20));
                          }
                        }} />}
                      <div>
                        <div className="card-topline">
                          <div className="device-title-row">
                            <div className={`device-icon ${statusClass}`}>
                              <Cpu size={16} />
                            </div>
                            <div>
                              <h2>{device.name}</h2>
                              {device.purpose && <p className="device-purpose">{device.purpose}</p>}
                              <div className="device-badges">
                                <span className="device-type">{device.type || "ESP"}</span>
                                <span className={`card-status-chip ${statusClass}`}>
                                  {device.status}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="card-top-actions">
                            <button className="details-button" onClick={() => openDeviceDetail(device)} type="button">
                              Details
                            </button>
                            <div className="menu-wrap">
                              <button
                                className="icon-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActiveMenuId(activeMenuId === device.id ? null : device.id);
                                }}
                                type="button"
                                aria-label={`Open ${device.name} menu`}
                              >
                                <MoreVertical size={16} />
                              </button>

                              {activeMenuId === device.id && (
                                <div className="card-menu">
                                  <button onClick={() => requestDeviceRemoval(device)} type="button">
                                    <Trash2 size={13} />
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="device-card-data">
                          <div>
                            <span>IP Adresa:</span>
                            <strong>{device.ip || "Unknown"}</strong>
                          </div>
                          <div>
                            <span>Signal strength:</span>
                            <strong>
                              <Wifi
                                size={13}
                                className={`wifi-signal${freshTelemetry(device) ? "" : " signal-off"}`}
                                style={{ "--net-rssi-hue": Math.max(0, Math.min(120, ((device.telemetry?.rssi ?? -85) + 85) / 35 * 120)) } as CSSProperties}
                                aria-hidden="true"
                              />
                              {freshTelemetry(device) ? `${device.telemetry!.rssi} dBm` : "N/A"}
                            </strong>
                          </div>
                          <div><span>Uptime ESP:</span><strong>{nodeUptime(device)}</strong></div>
                          <div><span>Volná paměť:</span><strong>{freshTelemetry(device) ? `${(device.telemetry!.freeHeapBytes / 1024).toFixed(1)} kB` : "N/A"}</strong></div>
                          <div><span>Poslední kontakt:</span><strong>{formatLastSeen(device.lastSeen)}</strong></div>
                        </div>
                      </div>

                      <div className="card-footer">
                        <span className="status-line">
                          <i className={statusClass} />
                          <strong className={statusClass}>{device.status}</strong>
                        </span>
                        <div className="card-actions">
                          <button disabled={isSending} onClick={() => runCommand(device, "reboot")} type="button">
                            Reboot
                          </button>
                          <button
                            className="blue"
                            disabled={isSending}
                            onClick={() => runCommand(device, "identify")}
                            type="button"
                          >
                            Identify
                          </button>
                        </div>
                      </div>

                      {feedback && <div className={`command-feedback ${feedback.state}`}>{feedback.label}</div>}
                      {verification[device.id] && <div className="verification-result" data-state={verification[device.id].state} role="status">
                        {{ checking: 'Ověřuji spojení…', confirmed: 'Spojení potvrzeno', 'no-response': 'Bez odpovědi', unsupported: 'Firmware nepodporuje ověření', error: 'Ověření selhalo' }[verification[device.id].state]}
                        {' '}{verification[device.id].at}
                      </div>}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeView === "monitoring" && (
          <section className="view-stack">
            <div className="view-header compact">
              <div>
                <h1>Hardware & Network Telemetry</h1>
                <p>Detailní monitoring CM5 základny a kvality spojení klientských modulů.</p>
              </div>
              <div className="monitoring-header-actions">
                <span className={`refresh-rate ${systemStatus?.operatingMode.mode === "eco" ? "eco" : "normal"}`}>
                  <i />
                  {systemStatus?.operatingMode.mode === "eco" ? "ECO" : "LIVE"}{" "}
                  {systemStatus?.operatingMode.monitoringIntervalSeconds || 1}s
                </span>
                <button className="ghost-action" onClick={loadSystemStatus} type="button">
                  <RefreshCw size={14} />
                  Refresh
                </button>
              </div>
            </div>

            <section className="cm5-overview">
              <header className="cm5-overview-header">
                <div className="cm5-overview-title">
                  <span className="cm5-overview-icon"><Server size={18} /></span>
                  <div>
                    <span>CM5 Core</span>
                    <h2>Compute Engine</h2>
                  </div>
                </div>
                <div className="cm5-overview-summary">
                  <div className="cm5-facts">
                    <span>{systemStatus?.host.cpu.cores ?? "N/A"} CPU cores</span>
                    <span>{systemStatus?.operatingMode.mode === "eco" ? "Eco" : "Normal"} mode</span>
                    <span>{systemStatus?.operatingMode.monitoringIntervalSeconds || 1}s telemetry</span>
                  </div>
                  <span className={`cm5-health ${coreHealth(systemStatus).tone}`}>
                    <i />
                    {coreHealth(systemStatus).label}
                  </span>
                </div>
              </header>

              <div className="cm5-domain-grid">
                <article className="cm5-domain primary">
                  <div className="cm5-domain-header">
                    <Activity size={15} />
                    <div><span>Workload</span><strong>Core load</strong></div>
                  </div>
                  <div className="cm5-domain-stats">
                    <CoreMetric
                      label="Processor"
                      value={formatPercent(systemStatus?.host.cpu.usagePercent)}
                      detail={`${systemStatus?.host.cpu.cores ?? "N/A"} active cores`}
                      percent={systemStatus?.host.cpu.usagePercent}
                      tone={metricTone(systemStatus?.host.cpu.usagePercent, 85, 95)}
                    />
                    <CoreMetric
                      label="Memory"
                      value={formatPercent(systemStatus?.host.memory.usagePercent)}
                      detail={`${formatCapacity(systemStatus?.host.memory.used)} of ${formatCapacity(systemStatus?.host.memory.total)}`}
                      percent={systemStatus?.host.memory.usagePercent}
                      tone={metricTone(systemStatus?.host.memory.usagePercent, 85, 95)}
                    />
                  </div>
                </article>

                <article className="cm5-domain thermal">
                  <div className="cm5-domain-header">
                    <Thermometer size={15} />
                    <div><span>Thermal</span><strong>Temperature & cooling</strong></div>
                  </div>
                  <div className="cm5-domain-stats">
                    <CoreMetric
                      label="SoC temperature"
                      value={formatTemperature(systemStatus?.host.temperatureC)}
                      detail="CM5 package sensor"
                      tone={metricTone(systemStatus?.host.temperatureC, 67.5, 85)}
                    />
                    <CoreMetric
                      label="Cooling fan"
                      value={formatRpm(systemStatus?.host.fan?.rpm)}
                      detail={`${fanState(systemStatus).label} / PWM ${formatPercent(systemStatus?.host.fan?.pwmPercent)}`}
                      percent={systemStatus?.host.fan?.pwmPercent}
                      tone={fanState(systemStatus).tone}
                    />
                  </div>
                </article>

                <article className="cm5-domain runtime">
                  <div className="cm5-domain-header">
                    <Clock3 size={15} />
                    <div><span>Runtime</span><strong>Continuity & capacity</strong></div>
                  </div>
                  <div className="cm5-domain-stats">
                    <CoreMetric
                      label="System uptime"
                      value={formatUptime(systemStatus?.host.uptime || undefined)}
                      detail="Continuous core runtime"
                    />
                    <CoreMetric
                      label="Data storage"
                      value={formatPercent(systemStatus?.host.storage.usagePercent)}
                      detail={`${formatCapacity(systemStatus?.host.storage.used)} of ${formatCapacity(systemStatus?.host.storage.total)}`}
                      percent={systemStatus?.host.storage.usagePercent}
                      tone={metricTone(systemStatus?.host.storage.usagePercent, 90, 98)}
                    />
                  </div>
                </article>
              </div>
            </section>

            <div className="service-health-grid">
              {visibleServiceStatuses.map((service) => {
                const Icon = serviceIcon(service.id);

                return (
                  <div className={`service-health-card ${service.status}`} key={service.name}>
                    <div className="service-health-title">
                      <Icon size={16} />
                      <strong>{service.name}</strong>
                    </div>
                    <span>{service.status}</span>
                    <p>{service.detail}</p>
                  </div>
                );
              })}
            </div>

            <div className="future-module-grid">
              {monitoringModules.map((module) => (
                <div className="future-module-card" key={module.title}>
                  <span>{module.value}</span>
                  <strong>{module.title}</strong>
                  <p>{module.text}</p>
                </div>
              ))}
            </div>

            <div className="table-panel">
              <div className="table-title">Live node telemetry</div>
              <div className="node-list">
                {devices.map((device) => (
                  <div className="node-row" key={device.id}>
                    <strong>{device.name}</strong>
                    <div className="node-metrics">
                      <MetricInline label="Reported uptime" value={nodeUptime(device)} />
                      <MetricInline label="RSSI" value={freshTelemetry(device) ? `${device.telemetry!.rssi} dBm` : "N/A"} />
                      <MetricInline label="Volná paměť" value={freshTelemetry(device) ? `${(device.telemetry!.freeHeapBytes / 1024).toFixed(1)} kB` : "N/A"} />
                      <MetricInline label="Last seen" value={formatLastSeen(device.lastSeen)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeView === "logs" && (
          <section className="view-stack">
            <div className="view-header compact">
              <div>
                <h1>Systémový Event Stream</h1>
                <p>Chronologický přehled o dění v síti, příkazech a síťových stavech.</p>
              </div>
            </div>

            <EventStream logs={eventLogs} failed={logsFailed} loading={logsLoading} updatedAt={logsUpdatedAt} refresh={loadLogs} />
          </section>
        )}

        {activeView === "security" && (
          <section className="view-stack">
            <div className="view-header compact">
              <div>
                <h1>Zabezpečení a přístupy</h1>
                <p>Správa API klíčů, autorizačních tokenů a auditní komunikace.</p>
              </div>
            </div>

            <RejectedDevices key={admissionRevision} onReopened={device => {
              setDismissedRequests(current => current.filter(id => id !== device.id));
              setRequests(current => [...current.filter(d => d.id !== device.id), device]);
            }} />
            <div className="security-card">
              <h3>
                <KeyRound size={15} />
                Sdílený API token
              </h3>
              <div className="token-row">
                <div>
                  <strong>NET_Core_Bearer_Token</strong>
                  <span>Používá: Dashboard, ESP polling, command queue</span>
                </div>
                <code>****************</code>
              </div>
              <div className="token-row muted">
                <div>
                  <strong>
                    <Lock size={13} />
                    Token rotation
                  </strong>
                  <span>Ruční změna v .env a konfiguraci klientů. Automatická rotace zatím není dostupná.</span>
                </div>
                <code>legacy mode</code>
              </div>
            </div>

            <div className="security-module-grid">
              {securityModules.map((module) => {
                const Icon = module.icon;

                return (
                  <div className="security-module-card" key={module.title}>
                    <Icon size={18} />
                    <strong>{module.title}</strong>
                    <p>{module.text}</p>
                    <span>{module.status}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeView === "settings" && (
          <HostManagement>{({ updates, power }) => (
          <section className="view-stack settings-content">
            <div className="view-header compact">
              <div>
                <h1>Systémová konfigurace</h1>
                <p>Správa parametrů aplikace a krizové řízení základny CM5.</p>
              </div>
            </div>

            <h2 className="settings-section-title">Provoz a chlazení</h2>
            <div className="power-mode-panel">
              <div className="power-mode-copy">
                <div className="power-mode-title">
                  <Moon size={16} />
                  <div>
                    <h3>NET Operating Mode</h3>
                    <p>Keep control online while tuning background activity.</p>
                  </div>
                </div>
                <div className="power-mode-metrics">
                  <span>
                    Telemetry
                    <strong>{systemStatus?.operatingMode.monitoringIntervalSeconds || 1}s</strong>
                  </span>
                  <span>
                    Heartbeat writes
                    <strong>
                      {systemStatus?.operatingMode.heartbeatPersistenceSeconds
                        ? `${systemStatus.operatingMode.heartbeatPersistenceSeconds}s`
                        : "Every"}
                    </strong>
                  </span>
                </div>
              </div>
              <div className="mode-selector" aria-label="NET operating mode" role="group">
                <button
                  className={systemStatus?.operatingMode.mode !== "eco" ? "active" : ""}
                  disabled={!systemStatus || modeChangeState === "saving"}
                  onClick={() => changeOperatingMode("normal")}
                  type="button"
                >
                  <Activity size={14} />
                  Normal
                </button>
                <button
                  className={systemStatus?.operatingMode.mode === "eco" ? "active eco" : ""}
                  disabled={!systemStatus || modeChangeState === "saving"}
                  onClick={() => changeOperatingMode("eco")}
                  type="button"
                >
                  <Moon size={14} />
                  Eco
                </button>
              </div>
              <span className={`mode-change-state ${modeChangeState}`} aria-live="polite">
                {modeChangeState === "saving" && "Applying..."}
                {modeChangeState === "success" && "Mode updated"}
                {modeChangeState === "error" && "Mode change failed"}
              </span>
            </div>

            <section className="fan-control-panel">
              <div className="fan-control-header">
                <div className="fan-control-title">
                  <Fan size={16} />
                  <div>
                    <h3>CM5 Fan Control</h3>
                    <p>Time-limited hardware test with automatic kernel fallback.</p>
                  </div>
                </div>
                <span className={`fan-control-mode ${fanControlStatus?.mode || "unavailable"}`}>
                  {fanControlStatus?.mode === "manual_test" ? `Manual ${fanControlStatus.remainingSeconds || 0}s` :
                    fanControlStatus?.mode === "system" ? "System Auto" : "Unavailable"}
                </span>
              </div>

              <div className="fan-control-body">
                <div className="fan-control-metrics">
                  <span>Temperature<strong>{formatTemperature(fanControlStatus?.temperatureC)}</strong></span>
                  <span>Cooling state<strong>{fanControlStatus?.state ?? "N/A"} / 4</strong></span>
                  <span>Policy<strong>{fanControlStatus?.policy || "N/A"}</strong></span>
                </div>
                <div className="fan-state-selector" aria-label="Manual fan test state" role="group">
                  {["Off", "Low", "Medium", "High", "Max"].map((label, state) => (
                    <button
                      className={fanControlStatus?.mode === "manual_test" && fanControlStatus.requestedState === state ? "active" : ""}
                      disabled={!fanControlStatus?.available || fanControlAction === "saving" || (state === 0 && !fanControlStatus.offAllowed)}
                      key={label}
                      onClick={() => runFanTest(state)}
                      type="button"
                    >
                      <span>{state}</span>
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  className="fan-system-button"
                  disabled={!fanControlStatus?.available || fanControlStatus.mode !== "manual_test" || fanControlAction === "saving"}
                  onClick={returnFanToSystem}
                  type="button"
                >
                  <RefreshCw size={13} />
                  Return to System
                </button>
              </div>
              <div className={`fan-control-feedback ${fanControlAction}`} aria-live="polite">
                {fanControlStatus?.error || fanControlMessage}
              </div>
            </section>

            {power}

            <h2 className="settings-section-title">Připojení a služby</h2>
            <div className="settings-grid">
              <div className="config-panel">
                <h3>
                  <KeyRound size={15} />
                  Frontend API Connection
                </h3>
                <div className="config-form">
                  <label>
                    API Base URL
                    <input
                      value={apiBaseUrl}
                      onChange={(event) => setApiBaseUrl(event.target.value)}
                      placeholder="http://localhost:3000/api/v1"
                      type="url"
                    />
                  </label>
                  <label>
                    Bearer Token
                    <input
                      value={apiToken}
                      onChange={(event) => setApiToken(event.target.value)}
                      placeholder="Backend API token"
                      type="password"
                    />
                  </label>
                </div>
                <div className={`connection-state ${connectionState}`}>
                  <span>{connectionMessage}</span>
                </div>
                <div className="config-actions">
                  <button className="primary" onClick={saveConnectionConfig} type="button">
                    Save Config
                  </button>
                  <button disabled={connectionState === "testing"} onClick={testConnection} type="button">
                    <Activity size={13} />
                    Test Connection
                  </button>
                </div>
              </div>

              <div className="services-panel">
                <h3>
                  <Database size={15} />
                  System Software Services
                </h3>
                {visibleServiceStatuses.map((service) => (
                  <ServiceRow
                    key={service.id}
                    name={service.name}
                    status={service.status}
                  />
                ))}
              </div>
            </div>

            <div className="deployment-panel">
              <div className="deployment-header">
                <h3>
                  <PackageCheck size={15} />
                  Deployment & Version
                </h3>
                <span className={`deployment-state ${deploymentStatusClass(systemStatus?.deployment.status)}`}>
                  {systemStatus?.deployment.status || "unavailable"}
                </span>
              </div>
              <div className="deployment-grid">
                <DeploymentMetric
                  icon={PackageCheck}
                  label="Deployment"
                  value={systemStatus?.deployment.status || "Unavailable"}
                  detail="Managed by NET Deploy"
                />
                <DeploymentMetric
                  icon={Clock3}
                  label="Last update"
                  value={formatDeploymentTime(systemStatus?.deployment.deployedAt)}
                  detail="Recorded after both healthchecks"
                />
                <DeploymentMetric
                  icon={GitCommitHorizontal}
                  label="Backend build"
                  value={systemStatus?.build.version || "N/A"}
                  detail={shortCommit(systemStatus?.deployment.backend?.commit || systemStatus?.build.commit)}
                />
                <DeploymentMetric
                  icon={GitCommitHorizontal}
                  label="Frontend build"
                  value={frontendBuild.version}
                  detail={shortCommit(systemStatus?.deployment.frontend?.commit || frontendBuild.commit)}
                />
              </div>
              {updates}
            </div>

            <div className="settings-grid wide">
              <SettingsCard
                icon={CheckCircle2}
                title="Readiness Checklist"
                items={["Implementováno: verzované API a perzistence", "Implementováno: Docker nasazení", "Implementováno: řízené aktualizace CM5", "Implementováno: ESP telemetrie a schvalování"]}
              />
              <SettingsCard
                icon={Cable}
                title="Network Profile"
                items={["CORS konfigurace přes .env", "CORS nenahrazuje firewall ani omezení na LAN", "Plánováno: VPN profil", "Plánováno: mDNS/UDP discovery"]}
              />
              <SettingsCard
                icon={Bell}
                title="Notification Routes"
                items={["Implementováno: hledání, filtry a export událostí", "Implementováno: odpojení a návrat zařízení", "Implementováno: historie a ztišení upozornění", "Plánováno: Telegram a e-mail"]}
              />
              <SettingsCard
                icon={Wrench}
                title="Maintenance Windows"
                items={["NET Deploy managed updates", "Automatic image rollback", "Future backup retention", "Future OTA rollout"]}
              />
            </div>
          </section>
          )}</HostManagement>
        )}
      </main>

      <AddDevicePanel open={isPanelOpen} onClose={() => setIsPanelOpen(false)} onAdded={refreshAll} />
      <AnimatePresence>
      {selectedDevice && (
        <motion.section key="device-details" className="device-detail-modal" role="dialog" aria-modal="true" aria-label="Detail zařízení"
          style={{ x: '-50%', y: '-50%' }} initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.98 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>
          <div className="detail-header">
            <div>
              <span className={`card-status-chip ${deviceStatusClass(selectedDevice.status)}`}>
                {selectedDevice.status}
              </span>
              <h3>{selectedDevice.name}</h3>
            </div>
            <button className="icon-button" onClick={() => setSelectedDevice(null)} type="button" aria-label="Close device detail">
              <X size={16} />
            </button>
          </div>

          <DevicePurpose key={`purpose-${selectedDevice.id}`} device={selectedDevice} onSaved={updated => {
            setSelectedDevice(current => current?.id === updated.id ? updated : current);
            setDevices(current => current.map(device => device.id === updated.id ? updated : device));
            void loadLogs();
          }} />
          <DeviceBoardAssignment key={selectedDevice.id} device={selectedDevice}
            onSaved={updated => {
              setSelectedDevice(current => current?.id === updated.id ? updated : current);
              setDevices(current => current.map(device => device.id === updated.id ? updated : device));
              void loadLogs();
            }}
            onOpen={device => { setBoardDeviceId(device.id); setSelectedDevice(null); setActiveView('boards'); }} />
          <div className="detail-section-title">Připojení a systém</div>
          <div className="detail-grid">
            <DetailItem label="IP" value={selectedDevice.ip || "Unknown"} />
            <DetailItem label="Typ" value={selectedDevice.type || "ESP"} />
            <DetailItem label="Firmware" value={selectedDevice.firmware || "N/A"} />
            <DetailItem label="Poslední kontakt" value={formatLastSeen(selectedDevice.lastSeen)} />
            <DetailItem label="Čekající příkazy" value={String(selectedDevice.pendingCommands)} />
            <DetailItem label="ID zařízení" value={selectedDevice.id} />
          </div>
        </motion.section>
      )}
      </AnimatePresence>
      {devicePendingRemoval && (
        <section
          className="delete-device-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-device-title"
          aria-busy={deleteState === "deleting"}
        >
          <div className="delete-device-icon">
            <Trash2 size={18} />
          </div>
          <div>
            <h3 id="delete-device-title">Remove {devicePendingRemoval.name}?</h3>
            <p>The device will be removed from NET Core. This action will be recorded in the event log.</p>
          </div>

          {deleteState === "error" && (
            <div className="panel-error">Device could not be removed. Check the backend connection and try again.</div>
          )}

          <div className="delete-device-actions">
            <button
              className="secondary-button"
              disabled={deleteState === "deleting"}
              onClick={() => setDevicePendingRemoval(null)}
              type="button"
            >
              Cancel
            </button>
            <button className="danger-button" disabled={deleteState === "deleting"} onClick={removeDevice} type="button">
              <Trash2 size={14} />
              {deleteState === "deleting" ? "Removing..." : "Remove device"}
            </button>
          </div>
        </section>
      )}
      {isPanelOpen && <div className="backdrop" onClick={() => setIsPanelOpen(false)} />}
      {activeRequest && !isPanelOpen && !selectedDevice && !devicePendingRemoval && <ConnectionRequest key={activeRequest.id} device={activeRequest}
        onClose={() => setDismissedRequests(current => [...current, activeRequest.id])}
        onDecided={() => { setRequests(current => current.filter(d => d.id !== activeRequest.id)); setAdmissionRevision(v => v + 1); void refreshAll(); }} />}
      <AnimatePresence>{selectedDevice && <motion.div key="details-backdrop" className="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.16 }} onClick={() => setSelectedDevice(null)} />}</AnimatePresence>
      {devicePendingRemoval && deleteState !== "deleting" && (
        <div className="backdrop" onClick={() => setDevicePendingRemoval(null)} />
      )}
      {activeMenuId && <div className="menu-backdrop" onClick={() => setActiveMenuId(null)} />}
    </div>
  );
}

function CoreMetric({
  label,
  value,
  detail,
  tone,
  percent,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: CoreTone;
  percent?: number | null;
}) {
  return (
    <div className={`cm5-metric ${tone || "neutral"}`}>
      <span className="cm5-metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {typeof percent === "number" && (
        <div className="cm5-metric-bar">
          <i style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function MetricInline({ label, value, tone }: { label: string; value: string; tone?: "success" | "blue" }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={tone || ""}>{value}</strong>
    </div>
  );
}

function ServiceRow({ name, status }: { name: string; status?: string }) {
  return (
    <div className="service-row">
      <span>
        <Server size={14} />
        {name}
      </span>
      {status && <em className={`service-row-status ${status}`}>{status}</em>}
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Server;
  title: string;
  items: string[];
}) {
  return (
    <div className="settings-card">
      <h3>
        <Icon size={15} />
        {title}
      </h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function DeploymentMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="deployment-metric">
      <Icon size={15} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <code>{detail}</code>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
