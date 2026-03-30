import { getBusinessAPIBaseURL } from "../config";

import type { Style, StyleCreate, StyleUpdate } from "./types";

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

export async function loadStyles(params?: {
  category?: string;
  is_active?: boolean;
}): Promise<Style[]> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.is_active !== undefined)
    searchParams.set("is_active", String(params.is_active));
  const qs = searchParams.toString();
  const url = `${getBusinessAPIBaseURL()}/api/v1/styles${qs ? `?${qs}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data = await readJSONOrThrow<{ styles: Style[]; categories: string[] }>(response);
  return data.styles;
}

export async function loadStyleById(id: number): Promise<Style> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/styles/${id}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );
  return readJSONOrThrow<Style>(response);
}

export async function createStyle(payload: StyleCreate): Promise<Style> {
  const response = await fetch(`${getBusinessAPIBaseURL()}/api/v1/styles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJSONOrThrow<Style>(response);
}

export async function updateStyle(
  id: number,
  payload: StyleUpdate,
): Promise<Style> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/styles/${id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return readJSONOrThrow<Style>(response);
}

export async function deleteStyle(id: number): Promise<void> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/styles/${id}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!response.ok) {
    await readJSONOrThrow<{ message: string }>(response);
  }
}
