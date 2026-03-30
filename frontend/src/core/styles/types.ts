export type StyleCategory = "anime" | "realism" | "commercial" | "artistic" | "general";

export interface Style {
  id: number;
  name: string;
  name_en: string;
  category: StyleCategory;
  description?: string;
  preview_image_url?: string;
  prompt: string;
  negative_prompt?: string;
  is_active: boolean;
  is_preset: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StyleCreate {
  name: string;
  name_en: string;
  category?: StyleCategory;
  description?: string;
  preview_image_url?: string;
  prompt: string;
  negative_prompt?: string;
  is_active?: boolean;
  is_preset?: boolean;
  sort_order?: number;
}

export interface StyleUpdate {
  name?: string;
  name_en?: string;
  category?: StyleCategory;
  description?: string;
  preview_image_url?: string;
  prompt?: string;
  negative_prompt?: string;
  is_active?: boolean;
  is_preset?: boolean;
  sort_order?: number;
}
