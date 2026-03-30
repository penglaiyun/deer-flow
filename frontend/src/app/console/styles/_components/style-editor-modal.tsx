"use client";

import { Loader2, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import type { Style, StyleCategory, StyleCreate } from "@/core/styles";

const CATEGORIES: { value: StyleCategory; label: string }[] = [
  { value: "anime", label: "动漫" },
  { value: "realism", label: "写实" },
  { value: "commercial", label: "商业" },
  { value: "artistic", label: "艺术" },
  { value: "general", label: "通用" },
];

const EMPTY_FORM: StyleCreate = {
  name: "",
  name_en: "",
  category: "general",
  description: "",
  prompt: "",
  negative_prompt: "",
  preview_image_url: "",
  is_active: true,
  is_preset: false,
  sort_order: 0,
};

interface StyleEditorModalProps {
  style?: Style | null;
  loading: boolean;
  isZh: boolean;
  onClose: () => void;
  onConfirm: (data: StyleCreate) => void;
}

export function StyleEditorModal({
  style,
  loading,
  isZh,
  onClose,
  onConfirm,
}: StyleEditorModalProps) {
  const isEditing = Boolean(style);
  const [formData, setFormData] = useState<StyleCreate>(
    style
      ? {
          name: style.name,
          name_en: style.name_en,
          category: style.category,
          description: style.description ?? "",
          prompt: style.prompt,
          negative_prompt: style.negative_prompt ?? "",
          preview_image_url: style.preview_image_url ?? "",
          is_active: style.is_active,
          is_preset: style.is_preset,
          sort_order: style.sort_order,
        }
      : { ...EMPTY_FORM },
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onConfirm(formData);
  };

  const update = <K extends keyof StyleCreate>(
    key: K,
    value: StyleCreate[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#0b0b0b] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <h2 className="text-base font-semibold text-white">
            {isEditing
              ? isZh
                ? "编辑风格"
                : "Edit Style"
              : isZh
                ? "新建风格"
                : "New Style"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2 text-xs text-neutral-400">
              {isZh ? "名称（中文）" : "Name (Chinese)"}
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder={isZh ? "例如：赛博朋克" : "e.g. Cyberpunk"}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-orange-500/60"
              />
            </label>
            <label className="space-y-2 text-xs text-neutral-400">
              {isZh ? "标识（英文）" : "Identifier (English)"}
              <input
                type="text"
                required
                disabled={style?.is_preset}
                value={formData.name_en}
                onChange={(e) => update("name_en", e.target.value)}
                placeholder={isZh ? "例如：cyberpunk" : "e.g. cyberpunk"}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-orange-500/60 disabled:opacity-50"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2 text-xs text-neutral-400">
              {isZh ? "分类" : "Category"}
              <select
                value={formData.category}
                onChange={(e) => update("category", e.target.value as StyleCategory)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none transition-colors focus:border-orange-500/60"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-xs text-neutral-400">
              {isZh ? "排序权重" : "Sort Order"}
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) => update("sort_order", parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none transition-colors focus:border-orange-500/60"
              />
            </label>
          </div>

          <label className="space-y-2 text-xs text-neutral-400">
            {isZh ? "描述" : "Description"}
            <textarea
              value={formData.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
              rows={2}
              placeholder={
                isZh ? "简短描述这个风格的特点..." : "Brief description of this style..."
              }
              className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-orange-500/60"
            />
          </label>

          <label className="space-y-2 text-xs text-neutral-400">
            {isZh ? "正向提示词 (Prompt)" : "Positive Prompt"}
            <textarea
              required
              value={formData.prompt}
              onChange={(e) => update("prompt", e.target.value)}
              rows={4}
              placeholder={isZh ? "输入提示词模板..." : "Enter prompt template..."}
              className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm font-mono text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-orange-500/60"
            />
            <p className="text-[11px] text-neutral-500">
              {isZh
                ? "提示词将作为风格的基础Prompt使用"
                : "This prompt will be used as the base prompt for the style"}
            </p>
          </label>

          <label className="space-y-2 text-xs text-neutral-400">
            {isZh ? "负向提示词 (Negative Prompt)" : "Negative Prompt"}
            <textarea
              value={formData.negative_prompt ?? ""}
              onChange={(e) => update("negative_prompt", e.target.value)}
              rows={3}
              placeholder={isZh ? "输入负向提示词..." : "Enter negative prompt..."}
              className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm font-mono text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-orange-500/60"
            />
          </label>

          <label className="space-y-2 text-xs text-neutral-400">
            {isZh ? "预览图 URL" : "Preview Image URL"}
            <input
              type="text"
              value={formData.preview_image_url ?? ""}
              onChange={(e) => update("preview_image_url", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-orange-500/60"
            />
          </label>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => update("is_active", e.target.checked)}
              className="rounded border-neutral-600 bg-neutral-800 text-orange-600 focus:ring-orange-500"
            />
            <label
              htmlFor="is_active"
              className="select-none text-sm text-neutral-300"
            >
              {isZh ? "启用此风格" : "Enable this style"}
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-800 bg-[#0b0b0b] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isZh ? "取消" : "Cancel"}
          </button>
          <button
            onClick={() => onConfirm(formData)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {isEditing
              ? isZh
                ? "保存修改"
                : "Save Changes"
              : isZh
                ? "创建风格"
                : "Create Style"}
          </button>
        </div>
      </div>
    </div>
  );
}
