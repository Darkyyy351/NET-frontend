import { api } from "./axios";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface EventLog {
  id: string;
  time: string;
  type: "auth" | "cmd" | "device" | "heartbeat" | "sys" | string;
  level: "info" | "warn" | "error" | string;
  message: string;
  meta: Record<string, unknown> | null;
}

export async function getLogs(limit = 100): Promise<EventLog[]> {
  const res = await api.get<ApiResponse<EventLog[]>>("/logs", {
    params: { limit },
  });

  return res.data.data;
}
