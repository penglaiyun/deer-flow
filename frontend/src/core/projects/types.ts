export type ProjectStatus = "active" | "draft" | "completed" | string;

export interface ProjectListItem {
  id: number;
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  cover_image_url: string | null;
  style: string | null;
  style_template: string | null;
  video_resolution: string | null;
  aspect_ratio: string | null;
  created_at: string | null;
  updated_at: string | null;
  episode_count: number;
  subject_count: number;
  video_count: number;
  image_count: number;
}

export interface ProjectDetailItem {
  id: number;
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  cover_image_url: string | null;
  style: string | null;
  style_template: string | null;
  project_type: string | null;
  video_resolution: string | null;
  aspect_ratio: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  status?: string;
  style?: string;
  style_template?: string;
  project_type?: string;
  video_resolution?: string;
  aspect_ratio?: string;
}

export interface UploadProjectCoverResponse {
  message: string;
  url_path: string;
  cover_image_url: string;
}

export interface EpisodeListItem {
  id: number;
  name: string;
  description: string | null;
  script: string | null;
  script_analysis?: string | null;
  idea: string | null;
  project_id: number;
  episode_number: number;
  total_duration: number;
  status: "draft" | "in_progress" | "completed" | string | null;
  in_todo_list: boolean;
  created_at: string;
  updated_at: string;
  character_ids?: number[] | null;
  scene_ids?: number[] | null;
  prop_ids?: number[] | null;
}

export interface CreateEpisodePayload {
  name: string;
  project_id: number;
  description?: string;
  script?: string;
  script_analysis?: string;
  idea?: string;
  episode_number?: number;
  total_duration?: number;
  status?: string;
  in_todo_list?: boolean;
  character_ids?: number[];
  scene_ids?: number[];
  prop_ids?: number[];
}
