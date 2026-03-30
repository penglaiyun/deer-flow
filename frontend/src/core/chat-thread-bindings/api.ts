import { getBusinessAPIBaseURL } from "@/core/config";

export interface ChatThreadBinding {
  id: number;
  scope_key: string;
  thread_id: string;
  title: string | null;
  is_default: boolean;
  last_active_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ListResponse {
  items: ChatThreadBinding[];
}

interface UpsertRequest {
  scope_key: string;
  thread_id: string;
  title?: string;
  set_default?: boolean;
}

async function readJSONOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = "";
    try {
      const errorJson = (await response.json()) as { detail?: string };
      detail = errorJson.detail ?? "";
    } catch {
      detail = "";
    }
    throw new Error(detail || `HTTP ${response.status}: ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export async function listChatThreadBindings(scopeKey: string) {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/chat-thread-bindings?scope_key=${encodeURIComponent(scopeKey)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );
  const data = await readJSONOrThrow<ListResponse>(response);
  return data.items ?? [];
}

export async function upsertChatThreadBinding(payload: UpsertRequest) {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/chat-thread-bindings`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return readJSONOrThrow<ChatThreadBinding>(response);
}
