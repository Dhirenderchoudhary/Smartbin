import { getToken, signOut } from "./auth";

// Plain fetch wrapper, kept framework-free so the Expo app can copy it as is.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(init.body !== undefined && { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach SmartBin. Check your connection and try again.");
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    if (res.status === 401) await signOut();
    const err = json?.error;
    throw new ApiError(res.status, err?.code ?? "UNKNOWN", err?.message ?? "Something went wrong, try again.", err?.details);
  }
  return json.data as T;
}

export type Role = "USER" | "ADMIN";

export interface Me {
  id: string;
  email: string | null;
  role: Role;
}

export interface Quota {
  month: string;
  resetsOn: string;
  limits: { registrations: number; missingReports: number };
  used: { registrations: number; missingReports: number };
  remaining: { registrations: number; missingReports: number };
}
