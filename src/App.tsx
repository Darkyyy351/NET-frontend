import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Cable,
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  FileText,
  Grid3X3,
  HardDrive,
  KeyRound,
  Lock,
  MoreVertical,
  Plus,
  Power,
  Radio,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  Terminal,
  Trash2,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";
import { AddDevicePanel } from "./components/AddDevicePanel";
import { deleteDevice, getDevices, queueCommand, type Device } from "./api/devices";
import { getLogs, type EventLog } from "./api/logs";
import { getHealthStatus, getSystemStatus, type SystemService, type SystemStatus } from "./api/system";
import { getApiBaseUrl, getApiToken, saveApiConfig } from "./api/axios";
import "./styles.css";

type View = "dashboard" | "monitoring" | "logs" | "security" | "settings";

const viewItems: Array<{ id: View; label: string; icon: typeof Grid3X3 }> = [
  { id: "dashboard", label: "Dashboard", icon: Grid3X3 },
  { id: "monitoring", label: "Monitoring", icon: Activity },
  { id: "logs", label: "Logs", icon: Terminal },
  { id: "security", label: "Security", icon: Shield },
  { id: "settings", label: "Nastaveni", icon: Settings },
];

const fallbackLogs: EventLog[] = [
  {
    id: "fallback-cmd",
    time: new Date().toISOString(),
    type: "cmd",
    level: "info",
    message: "Core accepted queued command packet for device control",
    meta: null,
  },
  {
    id: "fallback-auth",
    time: new Date().toISOString(),
    type: "auth",
    level: "info",
    message: "ESP node authorized through NET bearer token",
    meta: null,
  },
  {
    id: "fallback-sys",
    time: new Date().toISOString(),
    type: "sys",
    level: "info",
    message: "CM5 Core health endpoint reported stable uptime",
    meta: null,
  },
];

const fallbackServiceStatuses: SystemService[] = [
  {
    id: "backend-api",
    name: "NET Backend API",
    status: "live",
    detail: "Health endpoint + devices API reachable in test mode",
  },
  {
    id: "docker-compose",
    name: "Docker Compose Runtime",
    status: "prepared",
    detail: "Backend compose exists; frontend container export is being prepared",
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
  { title: "ESP heartbeat telemetry", value: "next", text: "RSSI, firmware, uptime and free heap from heartbeat payloads." },
  { title: "Storage watchdog", value: "prepared", text: "JSON store size, backup age and future database disk pressure." },
  { title: "Alert routing", value: "planned", text: "Telegram, dashboard toast and email hooks for offline nodes." },
];

const securityModules = [
  { title: "API token vault", text: "Rotate dashboard and ESP tokens from a controlled admin flow.", icon: KeyRound },
  { title: "Device enrollment policy", text: "Allowlist new ESP nodes before they can receive commands.", icon: Shield },
  { title: "Audit trail", text: "Who sent reboot/identify commands and when the device acknowledged them.", icon: FileText },
  { title: "Network exposure check", text: "Warn if the API is reachable outside the trusted LAN/VPN.", icon: Eye },
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

function formatLogTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function logClass(log: EventLog) {
  if (log.level === "error") {
    return "error";
  }

  if (log.level === "warn") {
    return "warn";
  }

  return log.type;
}

function nodeUptime(device: Device) {
  if (!device.lastSeen) {
    return "0h 0m";
  }

  return "heartbeat active";
}

function pingLabel(device: Device) {
  return device.status === "online" ? "< 50ms" : "--";
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

function formatBytes(value?: number) {
  if (!value) {
    return "N/A";
  }

  return `${Math.round(value / 1024 / 1024)} MB`;
}

function formatUptime(seconds?: number) {
  if (!seconds) {
    return "N/A";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}h ${minutes}m`;
}

export default function App() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [eventLogs, setEventLogs] = useState<EventLog[]>(fallbackLogs);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState(() => getApiBaseUrl());
  const [apiToken, setApiToken] = useState(() => getApiToken());
  const [connectionState, setConnectionState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [connectionMessage, setConnectionMessage] = useState("Runtime config is loaded from this browser.");

  const loadDevices = async () => {
    setLoading(true);
    setError(null);

    try {
      setDevices(await getDevices());
    } catch (err) {
      console.error("Error loading devices", err);
      setError("Backend is unreachable or the API token is invalid.");
    } finally {
      setLoading(false);
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
    try {
      setEventLogs(await getLogs(100));
    } catch (err) {
      console.warn("Logs endpoint unavailable", err);
      setEventLogs(fallbackLogs);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadDevices(), loadSystemStatus(), loadLogs()]);
  };

  useEffect(() => {
    refreshAll();
  }, []);

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
  const offlineCount = devices.length - onlineCount;
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

  const runCommand = async (device: Device, type: "blink" | "reboot") => {
    await queueCommand(device.id, {
      type,
      payload: type === "blink" ? { times: 2 } : {},
    });
    setActiveMenuId(null);
    await refreshAll();
  };

  const removeDevice = async (device: Device) => {
    await deleteDevice(device.id);
    setActiveMenuId(null);
    await refreshAll();
  };

  return (
    <div className="net-shell">
      <aside className="core-sidebar">
        <div>
          <div className="core-brand">
            <span className="brand-pulse" />
            <span>
              NET CORE <strong>0.1</strong>
            </span>
          </div>

          <nav className="core-nav">
            {viewItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  className={`core-nav-item ${activeView === item.id ? "active" : ""}`}
                  onClick={() => setActiveView(item.id)}
                  type="button"
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-status">CM5 OS - SYSTEM SECURE</div>
      </aside>

      <main className="core-main">
        {activeView === "dashboard" && (
          <section className="view-stack">
            <div className="view-header">
              <div>
                <h1>Dashboard</h1>
                <p>Rychly prehled a ovladani aktivnich uzlu v siti.</p>
              </div>

              <div className="view-actions">
                <label className="search-box">
                  <Search size={14} />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Hledat zarizeni..."
                    type="text"
                  />
                </label>

                <button className="primary-action" onClick={() => setIsPanelOpen(true)} type="button">
                  <Plus size={14} />
                  Add Device
                </button>
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

            {loading && <div className="state-card">Loading devices...</div>}
            {error && <div className="state-card error">{error}</div>}

            {!loading && !error && filteredDevices.length === 0 && (
              <div className="state-card">No devices match the current filter.</div>
            )}

            {!loading && !error && filteredDevices.length > 0 && (
              <div className="v4-device-grid">
                {filteredDevices.map((device) => (
                  <article className="v4-device-card" key={device.id}>
                    <div>
                      <div className="card-topline">
                        <div className="device-title-row">
                          <div className={`device-icon ${device.status === "online" ? "online" : "offline"}`}>
                            <Cpu size={16} />
                          </div>
                          <div>
                            <h2>{device.name}</h2>
                            <span className="device-type">{device.type || "ESP"}</span>
                          </div>
                        </div>

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
                              <button onClick={() => removeDevice(device)} type="button">
                                <Trash2 size={13} />
                                Remove
                              </button>
                            </div>
                          )}
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
                            <Wifi size={13} className={device.status === "online" ? "signal-on" : "signal-off"} />
                            N/A
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="card-footer">
                      <span className="status-line">
                        <i className={device.status === "online" ? "online" : "offline"} />
                        <strong className={device.status === "online" ? "online" : "offline"}>{device.status}</strong>
                      </span>
                      <div className="card-actions">
                        <button onClick={() => runCommand(device, "reboot")} type="button">
                          Reboot
                        </button>
                        <button className="blue" onClick={() => runCommand(device, "blink")} type="button">
                          Identify
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeView === "monitoring" && (
          <section className="view-stack">
            <div className="view-header compact">
              <div>
                <h1>Hardware & Network Telemetry</h1>
                <p>Detailni monitoring CM5 zakladny a kvality spojeni klientskych modulu.</p>
              </div>
              <button className="ghost-action" onClick={refreshAll} type="button">
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            <div className="telemetry-panel">
              <h3>
                <HardDrive size={15} />
                CM5 Compute Engine Stats
              </h3>
              <div className="telemetry-grid">
                <MetricTile label="Backend uptime" value={formatUptime(systemStatus?.runtime.uptime)} />
                <MetricTile label="Vytizeni CPU" value="N/A" tone="success" bar={12} />
                <MetricTile label="Heap used" value={formatBytes(systemStatus?.runtime.memory.heapUsed)} tone="blue" bar={42} />
                <MetricTile label="Runtime" value={systemStatus ? `${systemStatus.runtime.platform}/${systemStatus.runtime.arch}` : "N/A"} tone="amber" />
              </div>
            </div>

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
              <div className="table-title">Dostupnost a stabilita uzlu (SLA)</div>
              <div className="node-list">
                {devices.map((device) => (
                  <div className="node-row" key={device.id}>
                    <strong>{device.name}</strong>
                    <div className="node-metrics">
                      <MetricInline label="Node Uptime" value={nodeUptime(device)} />
                      <MetricInline label="Network Ping" value={pingLabel(device)} tone="blue" />
                      <MetricInline label="SLA Dostupnost" value={device.status === "online" ? "100%" : "unknown"} tone="success" />
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
                <h1>Systemovy Event Stream</h1>
                <p>Chronologicky prehled o deni v siti, prikazech a sitovych stavech.</p>
              </div>
              <button className="ghost-action" onClick={loadLogs} type="button">
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            <div className="log-panel">
              <div className="log-title">
                <span>cm5_event_handler.log</span>
                <em>STREAMING</em>
              </div>
              <div className="log-lines">
                {eventLogs.map((log) => (
                  <div className="log-line" key={log.id}>
                    <span>[{formatLogTime(log.time)}]</span>
                    <i className={logClass(log)}>{log.type}</i>
                    <p>{log.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeView === "security" && (
          <section className="view-stack">
            <div className="view-header compact">
              <div>
                <h1>Zabezpeceni a Pristupy</h1>
                <p>Sprava API klicu, autorizacnich tokenu a auditni komunikace.</p>
              </div>
            </div>

            <div className="security-card">
              <h3>
                <KeyRound size={15} />
                Vygenerovane API klice pro klientska ESP
              </h3>
              <div className="token-row">
                <div>
                  <strong>NET_Core_Bearer_Token</strong>
                  <span>Pouziva: Dashboard, ESP polling, command queue</span>
                </div>
                <code>****************</code>
              </div>
              <div className="token-row muted">
                <div>
                  <strong>
                    <Lock size={13} />
                    Token rotation
                  </strong>
                  <span>Prepared for NET 1.0; manual .env update for now.</span>
                </div>
                <code>0.1 mode</code>
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
                    <span>future hook</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeView === "settings" && (
          <section className="view-stack">
            <div className="view-header compact">
              <div>
                <h1>Systemova konfigurace</h1>
                <p>Sprava parametru aplikace a krizove rizeni zakladny CM5.</p>
              </div>
            </div>

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

              <div className="danger-panel">
                <h3>
                  <AlertTriangle size={15} />
                  CM5 Infrastructure Master Control
                </h3>
                <p>
                  Krizove hardwarove povely zatim nejsou aktivni. UI je pripravene, backend endpointy
                  pridame az s potvrzovacim workflow.
                </p>
                <div className="settings-actions">
                  <button disabled type="button">
                    <RefreshCw size={14} />
                    Reboot CM5 Core
                  </button>
                  <button disabled className="danger" type="button">
                    <Power size={14} />
                    Shutdown Core
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
                    disabled={service.status === "planned"}
                  />
                ))}
              </div>
            </div>

            <div className="settings-grid wide">
              <SettingsCard
                icon={CheckCircle2}
                title="Readiness Checklist"
                items={["Backend API stable", "Frontend Docker export pending", "ESP telemetry pending", "CM5 deploy pending"]}
              />
              <SettingsCard
                icon={Cable}
                title="Network Profile"
                items={["LAN-only API mode", "CORS origin controlled by .env", "Future VPN profile", "Future mDNS/UDP discovery"]}
              />
              <SettingsCard
                icon={Bell}
                title="Notification Routes"
                items={["Dashboard event stream", "Future Telegram bot", "Future email alerts", "Future offline escalation"]}
              />
              <SettingsCard
                icon={Wrench}
                title="Maintenance Windows"
                items={["Manual updates for 0.1", "Future scheduled reboots", "Future backup retention", "Future OTA rollout"]}
              />
            </div>
          </section>
        )}
      </main>

      <AddDevicePanel open={isPanelOpen} onClose={() => setIsPanelOpen(false)} onAdded={refreshAll} />
      {isPanelOpen && <div className="backdrop" onClick={() => setIsPanelOpen(false)} />}
      {activeMenuId && <div className="menu-backdrop" onClick={() => setActiveMenuId(null)} />}
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone,
  bar,
}: {
  label: string;
  value: string;
  tone?: "success" | "blue" | "amber";
  bar?: number;
}) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong className={tone || ""}>{value}</strong>
      {typeof bar === "number" && (
        <div className="metric-bar">
          <i style={{ width: `${bar}%` }} />
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

function ServiceRow({ name, status, disabled }: { name: string; status?: string; disabled?: boolean }) {
  return (
    <div className="service-row">
      <span>
        <Server size={14} />
        {name}
      </span>
      {status && <em className={`service-row-status ${status}`}>{status}</em>}
      <button disabled={disabled} type="button">
        <Zap size={13} />
        Restart Service
      </button>
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
