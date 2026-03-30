"use client";

import { Image as ImageIcon, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { getBusinessAPIBaseURL } from "@/core/config";

type SubjectCategory = "character" | "scene" | "prop";

type SubjectFormValue = {
  name: string;
  category: SubjectCategory;
  alias: string;
  description: string;
  prompt: string;
  remarks: string;
};

type VariantFormValue = {
  name: string;
  description: string;
  variant_type: string;
};

type TaskDetail = {
  status?: string;
  result_url?: string | null;
  local_path?: string | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  error_message?: string | null;
};

function resolveAssetUrl(path: string | null | undefined) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${getBusinessAPIBaseURL()}${path}`;
}

export function AssetEditorModal({
  title,
  confirmLabel,
  isZh,
  projectCode,
  subjectId,
  previewImageUrl,
  imageUploadEnabled,
  onUploadImage,
  loading,
  subjectMode,
  subjectForm,
  variantForm,
  onChangeSubjectForm,
  onChangeVariantForm,
  onClose,
  onConfirm,
}: {
  title: string;
  confirmLabel: string;
  isZh: boolean;
  projectCode: string;
  subjectId?: number | null;
  previewImageUrl?: string | null;
  imageUploadEnabled?: boolean;
  onUploadImage?: (file: File) => Promise<void>;
  loading: boolean;
  subjectMode: boolean;
  subjectForm: SubjectFormValue;
  variantForm: VariantFormValue;
  onChangeSubjectForm: (next: SubjectFormValue) => void;
  onChangeVariantForm: (next: VariantFormValue) => void;
  onClose: () => void;
  onConfirm: (generatedImageUrl?: string | null) => void;
}) {
  const [optimizingPrompt, setOptimizingPrompt] = useState(false);
  const [localPreviewImageUrl, setLocalPreviewImageUrl] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [draggingImage, setDraggingImage] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const disabled = subjectMode ? !subjectForm.name.trim() : !variantForm.name.trim();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resolvedPreviewImageUrl = localPreviewImageUrl || resolveAssetUrl(previewImageUrl);

  useEffect(() => {
    setLocalPreviewImageUrl("");
    setGeneratedImageUrl(null);
    setGenerationError("");
  }, [previewImageUrl]);

  const handleOptimizePrompt = useCallback(async () => {
    if (!subjectMode || !projectCode) {
      return;
    }
    const typeMap: Record<SubjectCategory, string> = {
      character: "subject-character",
      scene: "subject-scene",
      prop: "subject-prop",
    };
    setOptimizingPrompt(true);
    try {
      const response = await fetch(
        `${getBusinessAPIBaseURL()}/api/v9/llm/optimize-prompt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: typeMap[subjectForm.category],
            legacy_prompt: subjectForm.prompt || undefined,
            description: subjectForm.description,
            user_feedback: subjectForm.remarks || undefined,
            language: isZh ? "zh" : "en",
          }),
        },
      );
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as {
        data?: { optimized_prompt?: string };
      };
      const optimizedPrompt = data.data?.optimized_prompt?.trim();
      if (optimizedPrompt) {
        onChangeSubjectForm({ ...subjectForm, prompt: optimizedPrompt });
      }
    } finally {
      setOptimizingPrompt(false);
    }
  }, [
    isZh,
    onChangeSubjectForm,
    projectCode,
    subjectForm,
    subjectMode,
  ]);

  const handleUploadImage = useCallback(
    async (file: File | null) => {
      if (!file || !onUploadImage) {
        return;
      }
      const nextPreviewImageUrl = URL.createObjectURL(file);
      setLocalPreviewImageUrl(nextPreviewImageUrl);
      await onUploadImage(file);
    },
    [onUploadImage],
  );

  const handleGenerateImage = useCallback(async () => {
    if (!subjectMode || !projectCode || !subjectForm.prompt.trim()) {
      return;
    }
    setGeneratingImage(true);
    setGenerationError("");
    try {
      const response = await fetch(
        `${getBusinessAPIBaseURL()}/api/v9/image/projects/${projectCode}/subjects/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: subjectForm.prompt.trim(),
            subject_id: subjectId ?? undefined,
            category: subjectForm.category,
          }),
        },
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "generate failed");
      }
      const data = (await response.json()) as {
        data?: { task_id?: string };
      };
      const taskId = data.data?.task_id;
      if (!taskId) {
        throw new Error(isZh ? "未返回任务ID" : "Missing task id");
      }

      for (let i = 0; i < 120; i += 1) {
        const taskResponse = await fetch(`${getBusinessAPIBaseURL()}/api/v1/tasks/${taskId}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!taskResponse.ok) {
          throw new Error(isZh ? "获取任务状态失败" : "Failed to load task");
        }
        const task = (await taskResponse.json()) as TaskDetail;
        const status = task.status ?? "";
        if (status === "completed") {
          const result = task.result ?? {};
          const resultImageUrl =
            typeof result.image_url === "string" ? result.image_url : null;
          const resultFallbackUrl =
            typeof result.url === "string" ? result.url : null;
          const imageUrl =
            task.result_url ??
            task.local_path ??
            resultImageUrl ??
            resultFallbackUrl ??
            "";
          if (!imageUrl) {
            throw new Error(isZh ? "生成完成但没有返回图片" : "No image returned");
          }
          const resolvedImageUrl = resolveAssetUrl(imageUrl);
          setLocalPreviewImageUrl(resolvedImageUrl);
          setGeneratedImageUrl(resolvedImageUrl);
          return;
        }
        if (status === "failed" || status === "cancelled") {
          throw new Error(
            task.error_message ??
              task.error ??
              (isZh ? "生成失败" : "Generation failed"),
          );
        }
        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), 2000);
        });
      }
      throw new Error(isZh ? "生成超时，请稍后重试" : "Generation timeout");
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : isZh
            ? "生成失败"
            : "Generation failed",
      );
    } finally {
      setGeneratingImage(false);
    }
  }, [isZh, projectCode, subjectForm.category, subjectForm.prompt, subjectId, subjectMode]);

  const labelClassName =
    "w-12 shrink-0 text-xs text-neutral-400";
  const rowClassName = "flex items-center gap-2";
  const fieldClassName =
    "w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-500";
  const compactFieldClassName =
    "w-[180px] rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-500";

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent
        showCloseButton={false}
        className="flex min-h-[44rem] w-full max-w-5xl max-h-[92vh] flex-col rounded-2xl border border-neutral-800 bg-[#111] p-0"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {subjectMode
            ? isZh
              ? "编辑主体信息对话框"
              : "Edit subject information dialog"
            : isZh
              ? "编辑变体信息对话框"
              : "Edit variant information dialog"}
        </DialogDescription>
        <div className="flex items-center justify-between border-b border-neutral-800 p-6">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5">
            <div className="space-y-3 border-r border-neutral-800 pr-5">
              <div className={rowClassName}>
                <label className={labelClassName}>{isZh ? "类型" : "Category"}</label>
                {subjectMode ? (
                  <select
                    value={subjectForm.category}
                    onChange={(event) =>
                      onChangeSubjectForm({
                        ...subjectForm,
                        category: event.target.value as SubjectCategory,
                      })
                    }
                    className={compactFieldClassName}
                  >
                    <option value="character">{isZh ? "角色" : "Character"}</option>
                    <option value="scene">{isZh ? "场景" : "Scene"}</option>
                    <option value="prop">{isZh ? "道具" : "Prop"}</option>
                  </select>
                ) : (
                  <input
                    value={variantForm.variant_type}
                    onChange={(event) =>
                      onChangeVariantForm({
                        ...variantForm,
                        variant_type: event.target.value,
                      })
                    }
                    className={compactFieldClassName}
                  />
                )}
              </div>
              <div className={rowClassName}>
                <label className={labelClassName}>{isZh ? "名称" : "Name"}</label>
                <input
                  value={subjectMode ? subjectForm.name : variantForm.name}
                  onChange={(event) => {
                    if (subjectMode) {
                      onChangeSubjectForm({
                        ...subjectForm,
                        name: event.target.value,
                      });
                    } else {
                      onChangeVariantForm({
                        ...variantForm,
                        name: event.target.value,
                      });
                    }
                  }}
                  className={fieldClassName}
                  autoFocus
                />
              </div>
              {subjectMode ? (
                <div className={rowClassName}>
                  <label className={labelClassName}>{isZh ? "别名" : "Alias"}</label>
                  <input
                    value={subjectForm.alias}
                    onChange={(event) =>
                      onChangeSubjectForm({
                        ...subjectForm,
                        alias: event.target.value,
                      })
                    }
                    className={fieldClassName}
                  />
                </div>
              ) : null}
              {subjectMode ? (
                <div className="flex items-start gap-2">
                  <label className={`${labelClassName} pt-2`}>
                    {isZh ? "备注" : "Remarks"}
                  </label>
                  <textarea
                    value={subjectForm.remarks}
                    onChange={(event) =>
                      onChangeSubjectForm({
                        ...subjectForm,
                        remarks: event.target.value,
                      })
                    }
                    className="h-20 w-full resize-none rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                  />
                </div>
              ) : null}
            </div>
            <div className="flex flex-col pl-0">
              <div
                className={`relative aspect-video overflow-hidden rounded-xl border border-dashed bg-neutral-900 transition-colors ${
                  draggingImage
                    ? "border-orange-500 bg-orange-500/10"
                    : "border-neutral-700"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (imageUploadEnabled && onUploadImage) {
                    setDraggingImage(true);
                  }
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDraggingImage(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDraggingImage(false);
                  const file = event.dataTransfer.files?.[0] ?? null;
                  void handleUploadImage(file);
                }}
              >
                {resolvedPreviewImageUrl ? (
                  <img
                    src={resolvedPreviewImageUrl}
                    alt={subjectMode ? subjectForm.name || title : variantForm.name || title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-neutral-600">
                    <ImageIcon size={28} />
                    <span className="text-xs">{isZh ? "拖拽图片到这里" : "Drop image here"}</span>
                    <span className="text-[11px] text-neutral-500">
                      {isZh ? "或点击下方上传按钮" : "or use upload button below"}
                    </span>
                  </div>
                )}
                {draggingImage ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-orange-300">
                    {isZh ? "释放以上传图片" : "Release to upload"}
                  </div>
                ) : null}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void handleUploadImage(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              <div className="mt-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    void handleGenerateImage();
                  }}
                  disabled={!subjectMode || !subjectForm.prompt.trim() || generatingImage}
                  className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingImage ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Wand2 size={12} />
                  )}
                  {isZh ? "生成" : "Generate"}
                </button>
              </div>
              {generationError ? (
                <div className="mt-2 text-xs text-red-400">{generationError}</div>
              ) : null}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <label className={`${labelClassName} pt-2`}>
              {isZh ? "描述" : "Description"}
            </label>
            <textarea
              value={subjectMode ? subjectForm.description : variantForm.description}
              onChange={(event) => {
                if (subjectMode) {
                  onChangeSubjectForm({
                    ...subjectForm,
                    description: event.target.value,
                  });
                } else {
                  onChangeVariantForm({
                    ...variantForm,
                    description: event.target.value,
                  });
                }
              }}
              className="h-24 w-full resize-none rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            />
          </div>
          {subjectMode ? (
            <div className="flex items-start gap-2">
              <label className={`${labelClassName} pt-2`}>
                {isZh ? "提示词" : "Prompt"}
              </label>
              <div className="w-full">
                <div className="relative">
                  <textarea
                    value={subjectForm.prompt}
                    onChange={(event) =>
                      onChangeSubjectForm({
                        ...subjectForm,
                        prompt: event.target.value,
                      })
                    }
                    className="h-36 w-full resize-none rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void handleOptimizePrompt();
                    }}
                    disabled={optimizingPrompt}
                    title={isZh ? "AI优化提示词" : "AI optimize prompt"}
                    className="absolute right-2 bottom-2 inline-flex h-8 w-8 items-center justify-center text-white hover:text-orange-300 disabled:opacity-60"
                  >
                    {optimizingPrompt ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Sparkles size={20} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-neutral-800 p-4">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-neutral-400 hover:text-white"
          >
            {isZh ? "取消" : "Cancel"}
          </button>
          <button
            onClick={() => onConfirm(generatedImageUrl)}
            disabled={disabled || loading}
            className="inline-flex items-center gap-2 rounded bg-orange-600 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
