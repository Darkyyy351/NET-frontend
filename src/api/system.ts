import { api } from "./axios";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface SystemService {
  id: "backend-api" | "docker-compose" | "mqtt" | string;
  name: string;
  status: "live" | "prepared" | "planned" | "offline" | string;
  detail: string;
}

export interface SystemStatus {
  build: {
    version: string;
    commit: string;
    builtAt: string | null;
    image: string | null;
  };
  deployment: {
    status: "healthy" | "rolled_back" | "untracked" | "unavailable" | "unknown" | string;
    deployedAt: string | null;
    backend: { commit: string | null; image: string | null } | null;
    frontend: { commit: string | null; image: string | null } | null;
  };
  operatingMode: {
    mode: "normal" | "eco";
    monitoringIntervalSeconds: number;
    heartbeatPersistenceSeconds: number;
  };
  host: {
    uptime: number | null;
    cpu: {
      usagePercent: number | null;
      cores: number | null;
    };
    memory: {
      total: number | null;
      used: number | null;
      available: number | null;
      usagePercent: number | null;
    };
    temperatureC: number | null;
    fan: {
      available: boolean;
      driver: string | null;
      rpm: number | null;
      pwm: number | null;
      pwmPercent: number | null;
      controlMode: number | null;
    };
    storage: {
      total: number | null;
      used: number | null;
      available: number | null;
      usagePercent: number | null;
    };
  };
  runtime: {
    uptime: number;
    timestamp: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
  };
  services: SystemService[];
}

export interface HealthStatus {
  success: boolean;
  status: string;
  uptime: number;
  timestamp: string;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const res = await api.get<HealthStatus>("/health");
  return res.data;
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const res = await api.get<ApiResponse<SystemStatus>>("/system/status");
  return res.data.data;
}

export async function setOperatingMode(mode: "normal" | "eco"): Promise<SystemStatus> {
  const res = await api.post<ApiResponse<SystemStatus>>("/system/mode", { mode });
  return res.data.data;
}
