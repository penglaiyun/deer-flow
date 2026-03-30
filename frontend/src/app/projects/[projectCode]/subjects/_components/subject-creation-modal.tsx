"use client";

import {
  Download,
  Image as ImageIcon,
  Loader2,
  Palette,
  Sparkles,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { getBusinessAPIBaseURL } from "@/core/config";

type SubjectCategory = "character" | "scene" | "prop";

type SubjectItem = {
  id: number;
  name: string;
  category: SubjectCategory;
  description?: string | null;
  prompt?: string | null;
};

type SubjectVariantItem = {
  id: number;
  name: string;
  description?: string | null;
};

type ImageModelItem = {
  id: string;
  name: string;
  is_default?: boolean;
};

type StyleOption = {
  id: number;
  name: string;
  name_en: string;
  category?: string;
  preview_image_url?: string | null;
  prompt?: string | null;
};

type ImageGenerationRecordItem = {
  id: number;
  image_url?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type PromptVersionItem = {
  id: number;
  prompt_text?: string | null;
};

type PromptItem = {
  id: number;
  current_version_id?: number | null;
  versions?: PromptVersionItem[];
};

export type SubjectCreationTarget = {
  subject: SubjectItem;
  variant: SubjectVariantItem | null;
};

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

function resolveAssetUrl(path: string | null | undefined) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${getBusinessAPIBaseURL()}${path}`;
}

async function loadImageModels(): Promise<ImageModelItem[]> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/external/models/image?enabled_only=true`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );
  const data = await readJSONOrThrow<{ models?: ImageModelItem[] }>(response);
  return Array.isArray(data.models) ? data.models : [];
}

async function loadStyles(): Promise<{ styles: StyleOption[]; categories: string[] }> {
  const response = await fetch(`${getBusinessAPIBaseURL()}/api/v1/styles?is_active=true`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data = await readJSONOrThrow<{ styles?: StyleOption[]; categories?: string[] }>(
    response,
  );
  return {
    styles: Array.isArray(data.styles) ? data.styles : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
  };
}

async function loadSubjectStyle(subjectId: number): Promise<{ style?: StyleOption | null }> {
  const response = await fetch(`${getBusinessAPIBaseURL()}/api/v1/subjects/${subjectId}/style`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return readJSONOrThrow<{ style?: StyleOption | null }>(response);
}

async function updateSubjectStyleSetting(
  subjectId: number,
  payload: { style_id: number; name: string; name_en: string; prompt?: string },
): Promise<void> {
  const response = await fetch(`${getBusinessAPIBaseURL()}/api/v1/subjects/${subjectId}/style`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    await readJSONOrThrow<{ message: string }>(response);
  }
}

async function uploadTempReferenceImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${getBusinessAPIBaseURL()}/api/v1/image/upload`, {
    method: "POST",
    body: formData,
  });
  return readJSONOrThrow<{ url: string }>(response);
}

async function generateSubjectImage(
  projectCode: string,
  payload: {
    subject_id: number;
    prompt: string;
    pre_prompt?: string;
    global_prompt?: string;
    style_template?: string;
    model?: string;
    aspect_ratio?: string;
    image_size?: string;
    reference_images?: string[];
  },
): Promise<{ task_id: string }> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/projects/${projectCode}/subjects/generate-image`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const data = await readJSONOrThrow<{ data?: { task_id?: string }; task_id?: string }>(
    response,
  );
  const taskId = data.data?.task_id ?? data.task_id;
  if (!taskId) {
    throw new Error("No task id");
  }
  return { task_id: taskId };
}

async function loadTask(taskId: string) {
  const response = await fetch(`${getBusinessAPIBaseURL()}/api/v1/tasks/${taskId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return readJSONOrThrow<{
    status?: string;
    result_url?: string | null;
    local_path?: string | null;
    result?: Record<string, unknown> | null;
    error?: string | null;
    error_message?: string | null;
  }>(response);
}

function extractTaskImageUrl(task: {
  result_url?: string | null;
  local_path?: string | null;
  result?: Record<string, unknown> | null;
}) {
  const result = task.result ?? {};
  const resultUrl = typeof task.result_url === "string" ? task.result_url : "";
  const localPath = typeof task.local_path === "string" ? task.local_path : "";
  const resultImageUrl =
    typeof result.image_url === "string" ? result.image_url : "";
  const resultUrl2 = typeof result.url === "string" ? result.url : "";
  return resultUrl || localPath || resultImageUrl || resultUrl2 || "";
}

async function loadImageGenerationRecords(
  projectCode: string,
  subjectId: number,
): Promise<ImageGenerationRecordItem[]> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/projects/${projectCode}/image-generation-records?subject_id=${subjectId}&limit=50`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );
  const data = await readJSONOrThrow<{ data?: ImageGenerationRecordItem[] }>(response);
  return Array.isArray(data.data) ? data.data : [];
}

async function loadPrePromptTemplates(): Promise<Record<SubjectCategory, string>> {
  const typeMap: Record<SubjectCategory, string> = {
    character: "standard-character-pre-prompt",
    scene: "standard-scene-pre-prompt",
    prop: "standard-prop-pre-prompt",
  };

  const templates: Record<SubjectCategory, string> = {
    character: "无阴影, 4k, 高清图, 电影质感, 角色全身像, 清晰面部特征",
    scene: "无阴影, 4k, 高清图, 电影质感, 广角镜头, 环境细节丰富",
    prop: "无阴影, 4k, 高清图, 电影质感, 产品摄影, 纯净背景",
  };

  await Promise.all(
    (Object.entries(typeMap) as Array<[SubjectCategory, string]>).map(
      async ([key, type]) => {
        try {
          const response = await fetch(
            `${getBusinessAPIBaseURL()}/api/v1/prompts?type=${encodeURIComponent(
              type,
            )}&status=active&limit=1`,
            {
              method: "GET",
              headers: { "Content-Type": "application/json" },
            },
          );
          const prompts = await readJSONOrThrow<PromptItem[]>(response);
          const prompt = prompts[0];
          const currentVersion = prompt?.versions?.find(
            (version) => version.id === prompt.current_version_id,
          );
          if (currentVersion?.prompt_text?.trim()) {
            templates[key] = currentVersion.prompt_text.trim();
          }
        } catch {
          return;
        }
      },
    ),
  );

  return templates;
}

export function SubjectCreationModal({
  isZh,
  projectCode,
  target,
  projectStyleTemplate,
  onClose,
  onApply,
}: {
  isZh: boolean;
  projectCode: string;
  target: SubjectCreationTarget;
  projectStyleTemplate?: string | null;
  onClose: () => void;
  onApply: (imageUrl: string, target: SubjectCreationTarget) => Promise<void>;
}) {
  const [models, setModels] = useState<ImageModelItem[]>([]);
  const [model, setModel] = useState("");
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [styleCategory, setStyleCategory] = useState("all");
  const [styleCategories, setStyleCategories] = useState<string[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<StyleOption | null>(null);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [imageSize, setImageSize] = useState("1K");
  const [imageCount, setImageCount] = useState(1);
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [prompt, setPrompt] = useState(
    target.variant?.description ??
      target.subject.prompt ??
      target.subject.description ??
      target.subject.name,
  );
  const [prePrompt, setPrePrompt] = useState("");
  const [loadingStyles, setLoadingStyles] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [historyRecords, setHistoryRecords] = useState<ImageGenerationRecordItem[]>([]);
  const [selectedHistoryImageUrl, setSelectedHistoryImageUrl] = useState("");
  const [showStylePrompt, setShowStylePrompt] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadBaseData = async () => {
      try {
        const [modelList, styleData] = await Promise.all([loadImageModels(), loadStyles()]);
        setModels(modelList);
        if (modelList.length > 0) {
          const defaultModel = modelList.find((item) => item.is_default) ?? modelList[0];
          if (defaultModel?.id) {
            setModel(defaultModel.id);
          }
        }
        const styleList = styleData.styles;
        const noStyleOption: StyleOption = {
          id: 0,
          name: isZh ? "无风格" : "No Style",
          name_en: "none",
          category: "general",
          prompt: "",
        };
        setStyles([noStyleOption, ...styleList]);
        setStyleCategories(["all", ...styleData.categories.filter((item) => item !== "all")]);
        setLoadingStyles(true);
        try {
          const styleResponse = await loadSubjectStyle(target.subject.id);
          const matchedSubjectStyle = styleResponse.style?.id
            ? styleList.find((item) => item.id === styleResponse.style?.id) ??
              styleResponse.style
            : null;
          if (matchedSubjectStyle) {
            setSelectedStyle(matchedSubjectStyle);
          } else if (projectStyleTemplate) {
            const matchedProjectStyle =
              styleList.find(
                (item) =>
                  item.name_en === projectStyleTemplate || item.name === projectStyleTemplate,
              ) ?? null;
            setSelectedStyle(matchedProjectStyle ?? noStyleOption);
          } else {
            setSelectedStyle(noStyleOption);
          }
        } finally {
          setLoadingStyles(false);
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : isZh
              ? "加载创作配置失败"
              : "Failed to load creation settings",
        );
      }
    };
    void loadBaseData();
  }, [isZh, projectStyleTemplate, target.subject.id]);

  useEffect(() => {
    const loadPrePrompts = async () => {
      try {
        const templates = await loadPrePromptTemplates();
        setPrePrompt(templates[target.subject.category] ?? "");
      } catch {
        setPrePrompt("");
      }
    };
    void loadPrePrompts();
  }, [target.subject.category]);

  const filteredStyles = useMemo(() => {
    if (styleCategory === "all") {
      return styles;
    }
    return styles.filter((item) => item.category === styleCategory);
  }, [styleCategory, styles]);

  const loadHistory = useCallback(async () => {
    try {
      const records = await loadImageGenerationRecords(projectCode, target.subject.id);
      setHistoryRecords(records);
      const latestImage = records.find(
        (item) => typeof item.image_url === "string" && Boolean(item.image_url),
      );
      if (latestImage?.image_url) {
        setSelectedHistoryImageUrl(resolveAssetUrl(latestImage.image_url));
      } else {
        setSelectedHistoryImageUrl("");
      }
    } catch {
      setHistoryRecords([]);
      setSelectedHistoryImageUrl("");
    }
  }, [projectCode, target.subject.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleSelectStyle = useCallback(
    async (styleId: number) => {
      const pickedStyle = styles.find((item) => item.id === styleId) ?? null;
      if (!pickedStyle) return;
      setSelectedStyle(pickedStyle);
      try {
        await updateSubjectStyleSetting(target.subject.id, {
          style_id: pickedStyle.id,
          name: pickedStyle.name,
          name_en: pickedStyle.name_en,
          prompt: pickedStyle.prompt ?? undefined,
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : isZh
              ? "保存风格失败"
              : "Failed to save style",
        );
      }
    },
    [isZh, styles, target.subject.id],
  );

  const handleReferenceFileChange = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        const uploaded = await uploadTempReferenceImage(file);
        setReferenceImageUrl(uploaded.url);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : isZh
              ? "上传参考图失败"
              : "Failed to upload reference image",
        );
      }
    },
    [isZh],
  );

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setErrorMessage("");
    setGeneratedImageUrl("");
    try {
      for (let round = 0; round < imageCount; round += 1) {
        const task = await generateSubjectImage(projectCode, {
          subject_id: target.subject.id,
          prompt: prompt.trim(),
          pre_prompt: prePrompt.trim() || undefined,
          global_prompt: (selectedStyle?.prompt ?? "").trim() || undefined,
          style_template:
            selectedStyle && selectedStyle.id > 0 ? selectedStyle.name_en : undefined,
          model: model || undefined,
          aspect_ratio: aspectRatio,
          image_size: imageSize,
          reference_images: referenceImageUrl ? [referenceImageUrl] : [],
        });
        let finished = false;
        for (let i = 0; i < 120; i += 1) {
          const taskData = await loadTask(task.task_id);
          const status = taskData.status ?? "";
          if (status === "completed") {
            const url = extractTaskImageUrl(taskData);
            if (!url) throw new Error(isZh ? "生成完成但未返回图片地址" : "No image url");
            const resolvedUrl = resolveAssetUrl(url);
            setGeneratedImageUrl(resolvedUrl);
            setSelectedHistoryImageUrl(resolvedUrl);
            void loadHistory();
            finished = true;
            break;
          }
          if (status === "failed" || status === "cancelled") {
            throw new Error(
              taskData.error_message ??
                taskData.error ??
                (isZh ? "生成失败" : "Generation failed"),
            );
          }
          await new Promise<void>((resolve) => {
            window.setTimeout(() => resolve(), 2000);
          });
        }
        if (!finished) {
          throw new Error(isZh ? "生成超时，请稍后重试" : "Generation timeout");
        }
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "创作失败"
            : "Creation failed",
      );
    } finally {
      setGenerating(false);
    }
  }, [
    aspectRatio,
    imageSize,
    isZh,
    model,
    prePrompt,
    projectCode,
    prompt,
    referenceImageUrl,
    selectedStyle,
    target.subject.id,
    imageCount,
    loadHistory,
  ]);

  const handleApply = useCallback(async () => {
    const applyUrl = selectedHistoryImageUrl || generatedImageUrl;
    if (!applyUrl) return;
    setApplying(true);
    setErrorMessage("");
    try {
      await onApply(applyUrl, target);
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "应用图片失败"
            : "Failed to apply image",
      );
    } finally {
      setApplying(false);
    }
  }, [generatedImageUrl, isZh, onApply, onClose, selectedHistoryImageUrl, target]);

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent
        showCloseButton={false}
        className=" w-full max-w-7xl max-h-[90vh] flex flex-col rounded-2xl border border-neutral-800 bg-[#111] p-0"
      >
        <DialogTitle className="sr-only">
          {isZh ? "主体创作" : "Subject Creation"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isZh
            ? "用于生成主体图片、查看历史记录并应用结果"
            : "Generate subject images, review history, and apply selected results"}
        </DialogDescription>
        <div className="flex items-center justify-between border-b border-neutral-800 p-6">
          <div>
            <h2 className="text-xl font-bold text-white">
              {isZh ? "主体创作" : "Subject Creation"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 主体内容 - 左右布局 */}
        <div className="flex-1 overflow-hidden flex gap-4 p-6 min-h-0">
          {/* 左侧：素材创作 */}
          <div className="flex-[4] flex gap-4 flex-col min-h-0">
            <div className="mb-4 flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  {target.variant?.name ?? target.subject.name}
                </h3>
                <p className="text-xs text-neutral-500">
                  {target.subject.category === "character"
                    ? isZh
                      ? "角色"
                      : "Character"
                    : target.subject.category === "scene"
                      ? isZh
                        ? "场景"
                        : "Scene"
                      : isZh
                        ? "道具"
                        : "Prop"}
                </p>
              </div>
              <button className="rounded bg-neutral-800 px-3 py-1.5 text-xs text-white hover:bg-neutral-700">
                {isZh ? "下一元素" : "Next"}
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-neutral-300">
                  {isZh ? "选择模型" : "Model"}
                </label>
                <select
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
                >
                  {models.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name || item.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-neutral-300">
                  {isZh ? "参考图 (非必选)" : "Reference (Optional)"}
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer rounded border-2 border-dashed border-neutral-700 p-4 text-center hover:border-neutral-600"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      void handleReferenceFileChange(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />
                  {referenceImageUrl ? (
                    <div className="relative mx-auto w-36">
                      <img
                        src={resolveAssetUrl(referenceImageUrl)}
                        alt="reference"
                        className="w-full rounded border border-neutral-700"
                      />
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setReferenceImageUrl("");
                        }}
                        className="absolute top-1 right-1 rounded bg-black/60 p-1 text-white"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-500">
                      <Upload size={20} className="mx-auto mb-1" />
                      {isZh ? "上传图片（JPG/PNG）" : "Upload image"}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-300">
                    {isZh ? "前置提示词" : "Pre Prompt"}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPrePrompt("")}
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-800"
                    >
                      <X size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowStylePrompt((prev) => !prev)}
                      className="rounded bg-neutral-800 px-2 py-1 text-[11px] text-white hover:bg-neutral-700"
                    >
                      {isZh ? "提示词模板" : "Template"}
                    </button>
                  </div>
                </div>
                <input
                  value={prePrompt}
                  onChange={(event) => setPrePrompt(event.target.value)}
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-300"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-300">
                    {isZh ? "提示词" : "Prompt"}
                  </label>
                  <div className="flex items-center gap-2">
                    <button className="rounded bg-neutral-800 px-2 py-1 text-[11px] text-white hover:bg-neutral-700">
                      {isZh ? "推荐提示词" : "Recommend"}
                    </button>
                    <button className="rounded bg-neutral-800 px-2 py-1 text-[11px] text-white hover:bg-neutral-700">
                      {isZh ? "提示词框架" : "Framework"}
                    </button>
                  </div>
                </div>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="h-28 w-full resize-none rounded border border-neutral-700 bg-neutral-900 p-3 text-xs text-neutral-300"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-300">
                    {isZh ? "全局提示词" : "Global Prompt"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowStyleSelector(true)}
                    className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2 py-1 text-[11px] text-white hover:bg-neutral-700"
                  >
                    <Palette size={12} />
                    {selectedStyle?.name ?? (isZh ? "选择风格" : "Style")}
                  </button>
                </div>
                <input
                  readOnly
                  value={selectedStyle?.prompt ?? ""}
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-400"
                />
                {showStylePrompt ? (
                  <textarea
                    readOnly
                    value={selectedStyle?.prompt ?? ""}
                    className="mt-2 h-20 w-full resize-none rounded border border-neutral-800 bg-neutral-950 p-2 text-xs text-neutral-500"
                  />
                ) : null}
              </div>

              {/* 按钮栏 */}
              <div className="flex items-center gap-2 pt-4 border-t border-neutral-800 flex-shrink-0">
                <select
                  value={aspectRatio}
                  onChange={(event) => setAspectRatio(event.target.value)}
                  className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-white"
                >
                  <option value="1:1">1:1</option>
                  <option value="3:4">3:4</option>
                  <option value="4:3">4:3</option>
                  <option value="9:16">9:16</option>
                  <option value="16:9">16:9</option>
                </select>
                <select
                  value={imageSize}
                  onChange={(event) => setImageSize(event.target.value)}
                  className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-white"
                >
                  <option value="1K">1K</option>
                  <option value="2K">2K</option>
                  <option value="4K">4K</option>
                </select>
                <select
                  value={String(imageCount)}
                  onChange={(event) => setImageCount(Number(event.target.value))}
                  className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-white"
                >
                  <option value="1">1张</option>
                  <option value="2">2张</option>
                  <option value="3">3张</option>
                  <option value="4">4张</option>
                </select>
                <button
                  onClick={() => {
                    void handleGenerate();
                  }}
                  disabled={generating || !prompt.trim()}
                  className="ml-auto inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  {generating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {isZh ? `立即生成 ${imageCount}` : `Generate ${imageCount}`}
                </button>
              </div>
            </div>
          </div>

          {/* 右侧：历史记录 */}
          <div className="flex-[6] bg-[#0d0d0d] rounded-xl border border-neutral-800 p-4 flex flex-col relative">
            <h3 className="text-lg font-bold text-white mb-4">历史记录</h3>
            {showStyleSelector ? (
              <div className="absolute inset-0 z-10 rounded bg-[#1a1a1a]/95 p-4">
                <div className="mb-3 flex items-center justify-between border-b border-neutral-700 pb-2">
                  <div className="text-sm font-bold text-white">{isZh ? "风格库" : "Styles"}</div>
                  <button
                    onClick={() => setShowStyleSelector(false)}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-800"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="mb-2 flex gap-2 overflow-x-auto">
                  <button
                    onClick={() => setStyleCategory("all")}
                    className={`rounded px-3 py-1 text-xs ${
                      styleCategory === "all"
                        ? "bg-emerald-600 text-white"
                        : "bg-neutral-800 text-neutral-300"
                    }`}
                  >
                    {isZh ? "全部" : "All"}
                  </button>
                  {styleCategories
                    .filter((item) => item !== "all")
                    .map((item) => (
                      <button
                        key={item}
                        onClick={() => setStyleCategory(item)}
                        className={`rounded px-3 py-1 text-xs ${
                          styleCategory === item
                            ? "bg-emerald-600 text-white"
                            : "bg-neutral-800 text-neutral-300"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                </div>
                <div className="grid max-h-[504px] grid-cols-4 gap-2 overflow-y-auto">
                  {loadingStyles ? (
                    <div className="col-span-4 flex items-center justify-center py-8 text-sm text-neutral-500">
                      <Loader2 size={14} className="mr-2 animate-spin" />
                      {isZh ? "加载中..." : "Loading..."}
                    </div>
                  ) : (
                    filteredStyles.map((style) => {
                      const active = selectedStyle?.id === style.id;
                      return (
                        <button
                          key={style.id}
                          onClick={() => {
                            void handleSelectStyle(style.id);
                          }}
                          className={`rounded border-2 p-2 ${
                            active
                              ? "border-emerald-500 bg-emerald-500/20"
                              : "border-neutral-700 bg-neutral-800"
                          }`}
                        >
                          <div className="mb-1 h-16 overflow-hidden rounded bg-neutral-900">
                            {style.preview_image_url ? (
                              <img
                                src={resolveAssetUrl(style.preview_image_url)}
                                alt={style.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-neutral-500">
                                <Palette size={20} />
                              </div>
                            )}
                          </div>
                          <div className="truncate text-[11px] text-neutral-200">{style.name}</div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
            <div className="h-[504px] overflow-y-auto">
              {historyRecords.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-neutral-500">
                  <ImageIcon size={48} className="mb-3 opacity-50" />
                  <p className="text-sm">{isZh ? "暂无生成记录" : "No history records"}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyRecords.map((record, index) => {
                    const recordUrl =
                      typeof record.image_url === "string"
                        ? resolveAssetUrl(record.image_url)
                        : "";
                    const active = recordUrl && recordUrl === selectedHistoryImageUrl;
                    const isGenerating = record.status === "generating";
                    const isFailed = record.status === "failed";
                    return (
                      <div key={record.id} className="group relative">
                        {recordUrl ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedHistoryImageUrl(recordUrl);
                            }}
                            className={`relative w-full overflow-hidden rounded border ${
                              active ? "border-emerald-500" : "border-neutral-800"
                            }`}
                          >
                            <div className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
                              {isZh ? `候选 ${index + 1}` : `Candidate ${index + 1}`}
                            </div>
                            <img
                              src={recordUrl}
                              alt={`history-${record.id}`}
                              className="w-full object-cover"
                            />
                            <div className="absolute inset-0 hidden items-center justify-center bg-black/30 group-hover:flex">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  const link = document.createElement("a");
                                  link.href = recordUrl;
                                  link.download = `subject-${Date.now()}.png`;
                                  link.click();
                                }}
                                className="rounded bg-black/70 p-2 text-white"
                              >
                                <Download size={14} />
                              </button>
                            </div>
                          </button>
                        ) : (
                          <div className="flex aspect-video w-full items-center justify-center rounded border border-neutral-800 bg-neutral-900">
                            {isFailed ? (
                              <div className="flex flex-col items-center text-red-400">
                                <XCircle size={24} />
                                <span className="mt-1 text-xs">{isZh ? "生成失败" : "Failed"}</span>
                              </div>
                            ) : isGenerating ? (
                              <div className="flex flex-col items-center text-neutral-400">
                                <Loader2 size={24} className="animate-spin" />
                                <span className="mt-1 text-xs">
                                  {isZh ? "生成中..." : "Generating..."}
                                </span>
                              </div>
                            ) : (
                              <div className="text-xs text-neutral-600">{isZh ? "无图" : "No Image"}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        {errorMessage ? (
          <div className="mx-6 mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {errorMessage}
          </div>
        ) : null}

      </DialogContent>
    </Dialog>
  );
}
