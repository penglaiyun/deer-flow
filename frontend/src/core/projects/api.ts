import { getBusinessAPIBaseURL } from "@/core/config";

import type {
  CreateEpisodePayload,
  CreateProjectPayload,
  EpisodeListItem,
  ProjectDetailItem,
  ProjectListItem,
  UploadProjectCoverResponse,
} from "./types";

export interface EpisodeScriptPayload {
  content: string;
  source: "script" | "idea" | "empty" | string;
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
    const message =
      detail || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function loadProjects(): Promise<ProjectListItem[]> {
  const response = await fetch(`${getBusinessAPIBaseURL()}/api/v1/projects`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return readJSONOrThrow<ProjectListItem[]>(response);
}

export async function createProject(
  payload: CreateProjectPayload,
): Promise<ProjectDetailItem> {
  const response = await fetch(`${getBusinessAPIBaseURL()}/api/v1/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return readJSONOrThrow<ProjectDetailItem>(response);
}

export async function uploadProjectCover(
  projectCode: string,
  file: File,
): Promise<UploadProjectCoverResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/projects/code/${projectCode}/upload-cover`,
    {
      method: "POST",
      body: formData,
    },
  );
  return readJSONOrThrow<UploadProjectCoverResponse>(response);
}

export async function loadProjectByCode(
  projectCode: string,
): Promise<ProjectDetailItem> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/projects/code/${projectCode}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  return readJSONOrThrow<ProjectDetailItem>(response);
}

export async function updateProjectByCode(
  projectCode: string,
  payload: Partial<CreateProjectPayload>,
): Promise<ProjectDetailItem> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/projects/code/${projectCode}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  return readJSONOrThrow<ProjectDetailItem>(response);
}

export async function loadProjectEpisodes(
  projectCode: string,
): Promise<EpisodeListItem[]> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/projects/${projectCode}/episodes`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  return readJSONOrThrow<EpisodeListItem[]>(response);
}

export async function createEpisode(
  payload: CreateEpisodePayload,
): Promise<EpisodeListItem> {
  const response = await fetch(`${getBusinessAPIBaseURL()}/api/v1/episodes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return readJSONOrThrow<EpisodeListItem>(response);
}

export async function loadEpisodeById(
  episodeId: number,
): Promise<EpisodeListItem> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/episodes/${episodeId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  return readJSONOrThrow<EpisodeListItem>(response);
}

export async function updateEpisode(
  episodeId: number,
  payload: Partial<CreateEpisodePayload>,
): Promise<EpisodeListItem> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/episodes/${episodeId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  return readJSONOrThrow<EpisodeListItem>(response);
}

export async function deleteEpisode(episodeId: number): Promise<void> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/episodes/${episodeId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  if (!response.ok) {
    await readJSONOrThrow(response);
  }
}

export async function loadEpisodeScript(
  episodeId: number,
): Promise<EpisodeScriptPayload> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/episodes/${episodeId}/script`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  return readJSONOrThrow<EpisodeScriptPayload>(response);
}
