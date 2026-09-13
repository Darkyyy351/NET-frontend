import { api } from "./axios";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface Device {
  admission?: 'pending' | 'approved' | 'rejected';
  id: string;
  name: string;
  purpose?: string;
  ip: string | null;
  type: string;
  boardProfile?: { id: string; revision: number } | null;
  status: string;
  firmware: string | null;
  capabilities: string[];
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
  pendingCommands: number;
}

export async function getConnectionRequests(status: 'pending' | 'rejected' = 'pending'): Promise<Device[]> {
  return (await api.get<ApiResponse<Device[]>>('/devices/requests', { params: { status } })).data.data;
}

export async function decideConnection(id: string, decision: 'approved' | 'rejected' | 'pending') {
  await api.post(`/devices/${encodeURIComponent(id)}/admission`, { decision });
}

export type VerificationState = 'checking' | 'confirmed' | 'no-response' | 'unsupported' | 'error';

export async function verifyDevice(id: string): Promise<VerificationState> {
  const base = `/devices/${encodeURIComponent(id)}/verify`;
  const start = (await api.post<ApiResponse<{ id?: string; status: string }>>(base)).data.data;
  if (start.status === 'unsupported') return 'unsupported';
  if (!start.id) throw new Error('Invalid verification response');
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const result = (await api.get<ApiResponse<{ status: VerificationState }>>(`${base}/${encodeURIComponent(start.id)}`)).data.data;
    if (result.status !== 'checking') return result.status;
    await new Promise(resolve => setTimeout(resolve, 750));
  }
  return 'error';
}

export interface DeviceCommand {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "done" | "failed";
  createdAt: string;
  updatedAt: string;
}

export async function getDevices({ fresh = false }: { fresh?: boolean } = {}): Promise<Device[]> {
  const res = await api.get<ApiResponse<Device[]>>("/devices", fresh ? {
    params: { refresh: Date.now() },
  } : undefined);
  return res.data.data;
}

export async function addDevice(device: { name: string; ip: string; type: string }) {
  const res = await api.post<ApiResponse<Device>>("/devices", device);
  return res.data.data;
}

export async function assignDeviceBoard(id: string, boardProfile: Device['boardProfile']): Promise<Device> {
  const res = await api.post<ApiResponse<Device>>(`/devices/${encodeURIComponent(id)}/board-profile`, { boardProfile });
  return res.data.data;
}

export async function setDevicePurpose(id: string, purpose: string): Promise<Device> {
  return (await api.post<ApiResponse<Device>>(`/devices/${encodeURIComponent(id)}/purpose`, { purpose })).data.data;
}

export async function deleteDevice(id: string) {
  await api.delete(`/devices/${id}`);
}

export async function queueCommand(id: string, command: { type: string; payload?: Record<string, unknown> }) {
  const res = await api.post<ApiResponse<DeviceCommand>>(`/devices/${id}/commands`, command);
  return res.data.data;
}

export async function getDeviceCommands(id: string): Promise<DeviceCommand[]> {
  const res = await api.get<ApiResponse<DeviceCommand[]>>(`/devices/${id}/commands`);
  return res.data.data;
}
