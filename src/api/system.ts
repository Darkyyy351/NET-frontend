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
