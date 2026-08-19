import { api } from "./axios";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface Device {
  id: string;
  name: string;
  ip: string | null;
  type: string;
  status: string;
  firmware: string | null;
  capabilities: string[];
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
  pendingCommands: number;
}

export interface DeviceCommand {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "done" | "failed";
  createdAt: string;
  updatedAt: string;
}

export async function getDevices(): Promise<Device[]> {
  const res = await api.get<ApiResponse<Device[]>>("/devices");
  return res.data.data;
}

export async function addDevice(device: { name: string; ip: string; type: string }) {
  const res = await api.post<ApiResponse<Device>>("/devices", device);
  return res.data.data;
}

export async function deleteDevice(id: string) {
  await api.delete(`/devices/${id}`);
}

export async function queueCommand(id: string, command: { type: string; payload?: Record<string, unknown> }) {
  const res = await api.post<ApiResponse<DeviceCommand>>(`/devices/${id}/commands`, command);
  return res.data.data;
}
