"use client";

import {
  Download,
  Film,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { ImagePreview } from "@/components/image-preview";
import { getBusinessAPIBaseURL } from "@/core/config";

import { useDirectorEventBus } from "./director-event-bus";

type DirectorSubjectCategory = "character" | "scene" | "prop";

type DirectorSubject = {
  id: number;
  name: string;
  category: string;
  image_url?: string | null;
};

type DirectorStoryboardShot = {
  id: number;
  description?: string | null;
  motion_prompt?: string | null;
};

type DirectorStoryboard = {
  id: number;
  title?: string | null;
  narrative?: string | null;
  extra_data?: Record<string, unknown> | null;
  shots?: DirectorStoryboardShot[] | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function resolveBusinessAssetUrl(url: string | null | undefined) {
  if (!url) {
    return "";
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${getBusinessAPIBaseURL()}${url}`;
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

async function loadProjectSubjects(
  projectCode: string,
  category: DirectorSubjectCategory,
): Promise<DirectorSubject[]> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/projects/${projectCode}/subjects?category=${category}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );
  const data = await readJSONOrThrow<{ data?: DirectorSubject[] }>(response);
  return Array.isArray(data.data) ? data.data : [];
}

async function loadEpisodeStoryboards(
  episodeId: number,
): Promise<DirectorStoryboard[]> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/episodes/${episodeId}/storyboards`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );
  return readJSONOrThrow<DirectorStoryboard[]>(response);
}

async function updateEpisodeStoryboard(
  episodeId: number,
  storyboardId: number,
  payload: { narrative?: string; title?: string; extra_data?: Record<string, unknown> },
): Promise<DirectorStoryboard> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/episodes/${episodeId}/storyboards/${storyboardId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return readJSONOrThrow<DirectorStoryboard>(response);
}

async function deleteEpisodeStoryboard(
  episodeId: number,
  storyboardId: number,
): Promise<void> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/episodes/${episodeId}/storyboards/${storyboardId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!response.ok) {
    await readJSONOrThrow<{ message: string }>(response);
  }
}

async function loadVideoModels(): Promise<Array<{ id: string; is_default?: boolean }>> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/external/models/video?enabled_only=true`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );
  const data = await readJSONOrThrow<{
    models?: Array<{ id: string; is_default?: boolean }>;
  }>(response);
  return Array.isArray(data.models) ? data.models : [];
}

async function submitVideoGenerateTask(payload: {
  prompt: string;
  model_id: string;
  duration: number;
  resolution: string;
  aspect_ratio: string;
  mode: "text-to-video" | "image-to-video";
  reference_images: string[];
  episode_id: number;
  metadata: {
    storyboard_id: number;
  };
}): Promise<{ task_id: string }> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/external/video/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return readJSONOrThrow<{ task_id: string }>(response);
}

async function loadExternalTaskStatus(taskId: string): Promise<Record<string, unknown>> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/external/tasks/${taskId}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );
  return readJSONOrThrow<Record<string, unknown>>(response);
}

async function uploadStoryboardImage(
  episodeId: number,
  file: File,
): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("episode_id", String(episodeId));
  const response = await fetch(`${getBusinessAPIBaseURL()}/api/v1/image/upload`, {
    method: "POST",
    body: formData,
  });
  return readJSONOrThrow<{ url: string }>(response);
}

export function DirectorStoryboardPanel({
  episodeId,
  projectCode,
  isZh,
  onGenerateStoryboardPrompt,
}: {
  episodeId: number;
  projectCode: string;
  isZh: boolean;
  onGenerateStoryboardPrompt?: (payload: {
    storyboardId: number;
    narrative: string;
  }) => void;
}) {
  const { subscribe } = useDirectorEventBus();
  const [storyboards, setStoryboards] = useState<DirectorStoryboard[]>([]);
  const [subjectMap, setSubjectMap] = useState<Record<number, DirectorSubject>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [videoModelId, setVideoModelId] = useState("");
  const [videoGeneratingMap, setVideoGeneratingMap] = useState<Record<number, boolean>>(
    {},
  );
  const [videoStatusMap, setVideoStatusMap] = useState<Record<number, string>>({});
  const [imageUploadingMap, setImageUploadingMap] = useState<Record<number, boolean>>({});
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const refreshData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const [storyboardList, videoModels, characterSubjects, sceneSubjects, propSubjects] =
        await Promise.all([
          loadEpisodeStoryboards(episodeId),
          loadVideoModels().catch(() => []),
          loadProjectSubjects(projectCode, "character").catch(() => []),
          loadProjectSubjects(projectCode, "scene").catch(() => []),
          loadProjectSubjects(projectCode, "prop").catch(() => []),
        ]);
      setStoryboards(Array.isArray(storyboardList) ? storyboardList : []);
      const mergedSubjects = [...characterSubjects, ...sceneSubjects, ...propSubjects];
      const nextSubjectMap: Record<number, DirectorSubject> = {};
      for (const subject of mergedSubjects) {
        if (typeof subject.id === "number") {
          nextSubjectMap[subject.id] = subject;
        }
      }
      setSubjectMap(nextSubjectMap);
      if (videoModels.length > 0) {
        const picked = videoModels.find((item) => item.is_default) ?? videoModels[0];
        if (picked?.id) {
          setVideoModelId(picked.id);
        }
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "加载分镜板失败"
            : "Failed to load storyboard",
      );
    } finally {
      setLoading(false);
    }
  }, [episodeId, isZh, projectCode]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    return subscribe("asset.image.generate", (event) => {
      if (event.projectCode !== projectCode) {
        return;
      }
      if (event.method !== "completed") {
        return;
      }
      if (event.payload.assetType !== "shot") {
        return;
      }
      const storyboardId = event.payload.storyboardId;
      const imageUrl = event.payload.imageUrl;
      if (!storyboardId || !imageUrl) {
        return;
      }
      setStoryboards((prev) =>
        prev.map((item) => {
          if (item.id !== storyboardId) {
            return item;
          }
          const extra = asRecord(item.extra_data);
          return {
            ...item,
            extra_data: {
              ...extra,
              imageUrl,
            },
          };
        }),
      );
    });
  }, [projectCode, subscribe]);

  const handleDelete = useCallback(
    async (storyboardId: number) => {
      const confirmed = window.confirm(
        isZh ? "确定删除这个分镜段落吗？" : "Delete this storyboard segment?",
      );
      if (!confirmed) {
        return;
      }
      setDeletingId(storyboardId);
      try {
        await deleteEpisodeStoryboard(episodeId, storyboardId);
        setStoryboards((prev) => prev.filter((item) => item.id !== storyboardId));
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : isZh
              ? "删除分镜失败"
              : "Failed to delete storyboard",
        );
      } finally {
        setDeletingId(null);
      }
    },
    [episodeId, isZh],
  );

  const handleSaveEdit = useCallback(
    async (storyboardId: number) => {
      const current = storyboards.find((item) => item.id === storyboardId);
      const currentText = current?.narrative ?? current?.title ?? "";
      if (editingText === currentText) {
        setEditingId(null);
        setEditingText("");
        return;
      }
      try {
        const updated = await updateEpisodeStoryboard(episodeId, storyboardId, {
          narrative: editingText,
        });
        setStoryboards((prev) =>
          prev.map((item) => (item.id === storyboardId ? { ...item, ...updated } : item)),
        );
        setEditingId(null);
        setEditingText("");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : isZh
              ? "更新分镜失败"
              : "Failed to update storyboard",
        );
      }
    },
    [editingText, episodeId, isZh, storyboards],
  );

  const updateExtraData = useCallback(
    async (
      storyboardId: number,
      updater: (previous: Record<string, unknown>) => Record<string, unknown>,
    ) => {
      const target = storyboards.find((item) => item.id === storyboardId);
      if (!target) {
        return;
      }
      const previous = asRecord(target.extra_data);
      const next = updater(previous);
      const updated = await updateEpisodeStoryboard(episodeId, storyboardId, {
        extra_data: next,
      });
      setStoryboards((prev) =>
        prev.map((item) => (item.id === storyboardId ? { ...item, ...updated } : item)),
      );
    },
    [episodeId, storyboards],
  );

  const handleGenerateVideo = useCallback(
    async (storyboard: DirectorStoryboard) => {
      if (!videoModelId) {
        setErrorMessage(
          isZh ? "暂无可用视频模型，请先检查配置" : "No available video model",
        );
        return;
      }
      if (videoGeneratingMap[storyboard.id]) {
        return;
      }
      setVideoGeneratingMap((prev) => ({ ...prev, [storyboard.id]: true }));
      setVideoStatusMap((prev) => ({
        ...prev,
        [storyboard.id]: isZh ? "提交任务中..." : "Submitting...",
      }));
      const shotPrompt = (storyboard.shots ?? [])
        .map((shot) => shot.motion_prompt ?? shot.description ?? "")
        .filter(Boolean)
        .join("\n");
      const prompt =
        shotPrompt.trim().length > 0
          ? shotPrompt.trim()
          : (storyboard.narrative ??
            storyboard.title ??
            (isZh
              ? "电影感镜头，主体动作自然，运镜流畅"
              : "Cinematic shot, smooth motion"));
      const extra = asRecord(storyboard.extra_data);
      const imageUrlRaw = extra.imageUrl;
      const imageUrl = typeof imageUrlRaw === "string" ? imageUrlRaw : "";
      try {
        const task = await submitVideoGenerateTask({
          prompt,
          model_id: videoModelId,
          duration: 5,
          resolution: "720p",
          aspect_ratio: "16:9",
          mode: imageUrl ? "image-to-video" : "text-to-video",
          reference_images: imageUrl ? [imageUrl] : [],
          episode_id: episodeId,
          metadata: {
            storyboard_id: storyboard.id,
          },
        });
        await updateExtraData(storyboard.id, (previous) => ({
          ...previous,
          videoTaskId: task.task_id,
          videoStatus: "processing",
        }));
        for (let i = 0; i < 120; i += 1) {
          const statusData = await loadExternalTaskStatus(task.task_id);
          const status =
            typeof statusData.status === "string" ? statusData.status : "";
          if (status === "completed") {
            const resultData = asRecord(statusData.result);
            const resultUrl =
              typeof statusData.result_url === "string"
                ? statusData.result_url
                : undefined;
            const localPath =
              typeof statusData.local_path === "string"
                ? statusData.local_path
                : undefined;
            const resultVideoUrl =
              typeof resultData.video_url === "string"
                ? resultData.video_url
                : undefined;
            const resultGenericUrl =
              typeof resultData.url === "string" ? resultData.url : undefined;
            const videoUrl =
              resultUrl ??
              localPath ??
              resultVideoUrl ??
              resultGenericUrl ??
              "";
            if (!videoUrl) {
              throw new Error(
                isZh
                  ? "任务完成但未返回视频地址"
                  : "Task completed but no video URL was returned",
              );
            }
            await updateExtraData(storyboard.id, (previous) => ({
              ...previous,
              videoUrl,
              videoTaskId: null,
              videoStatus: "completed",
            }));
            setVideoStatusMap((prev) => ({
              ...prev,
              [storyboard.id]: isZh ? "生成成功" : "Completed",
            }));
            return;
          }
          if (status === "failed" || status === "cancelled") {
            const message =
              (typeof statusData.error === "string" && statusData.error) ||
              (isZh ? "生成失败" : "Generation failed");
            throw new Error(message);
          }
          setVideoStatusMap((prev) => ({
            ...prev,
            [storyboard.id]: isZh ? "生成中..." : "Generating...",
          }));
          await new Promise<void>((resolve) => {
            window.setTimeout(() => resolve(), 3000);
          });
        }
        throw new Error(isZh ? "生成超时，请稍后重试" : "Generation timed out");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : isZh
              ? "视频生成失败"
              : "Failed to generate video";
        setVideoStatusMap((prev) => ({ ...prev, [storyboard.id]: message }));
        try {
          await updateExtraData(storyboard.id, (previous) => ({
            ...previous,
            videoStatus: "failed",
          }));
        } catch {
        }
      } finally {
        setVideoGeneratingMap((prev) => ({ ...prev, [storyboard.id]: false }));
      }
    },
    [episodeId, isZh, updateExtraData, videoGeneratingMap, videoModelId],
  );

  const handleUploadStoryboardImage = useCallback(
    async (storyboardId: number, file: File) => {
      setImageUploadingMap((prev) => ({ ...prev, [storyboardId]: true }));
      try {
        const uploaded = await uploadStoryboardImage(episodeId, file);
        await updateExtraData(storyboardId, (previous) => ({
          ...previous,
          imageUrl: uploaded.url,
        }));
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : isZh
              ? "上传分镜图片失败"
              : "Failed to upload storyboard image",
        );
      } finally {
        setImageUploadingMap((prev) => ({ ...prev, [storyboardId]: false }));
      }
    },
    [episodeId, isZh, updateExtraData],
  );

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-sm text-neutral-500">
        <Loader2 size={16} className="animate-spin" />
        {isZh ? "加载中..." : "Loading..."}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="p-4 [&_button:not(:disabled)]:cursor-pointer">
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {errorMessage}
        </div>
      </div>
    );
  }

  if (storyboards.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 text-neutral-500">
        <LayoutGrid size={28} className="opacity-60" />
        <p className="text-sm">{isZh ? "暂无分镜数据" : "No storyboard data"}</p>
        <button
          onClick={() => {
            void refreshData();
          }}
          className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          {isZh ? "刷新" : "Refresh"}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 [&_button:not(:disabled)]:cursor-pointer">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-white">
          <LayoutGrid size={16} />
          <span>{isZh ? "分镜板" : "Storyboard"}</span>
          <span className="text-xs text-neutral-500">
            {isZh ? `共 ${storyboards.length} 个段落` : `${storyboards.length} segments`}
          </span>
        </div>
        <button
          onClick={() => {
            void refreshData();
          }}
          className="inline-flex items-center gap-2 rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          <RefreshCw size={12} />
          {isZh ? "刷新" : "Refresh"}
        </button>
      </div>
      <div className="space-y-3">
        {storyboards.map((storyboard, index) => {
          const extra = asRecord(storyboard.extra_data);
          const mappingRaw = extra.assets_mapping;
          const getTypeOrder = (value: unknown): number => {
            const normalized =
              typeof value === "string" ? value.toLowerCase() : "";
            if (normalized.includes("character") || normalized.includes("人物")) {
              return 0;
            }
            if (normalized.includes("scene") || normalized.includes("场景")) {
              return 1;
            }
            if (normalized.includes("prop") || normalized.includes("道具")) {
              return 2;
            }
            return 3;
          };
          const getReferenceOrder = (item: unknown): number => {
            const record = asRecord(item);
            const refRaw = record.reference_id ?? record.ref_id;
            const refText = typeof refRaw === "string" ? refRaw : "";
            const match = /\d+/.exec(refText);
            return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
          };
          const mappings = Array.isArray(mappingRaw)
            ? mappingRaw
                .slice()
                .sort((a, b) => {
                  const aRecord = asRecord(a);
                  const bRecord = asRecord(b);
                  const typeDelta =
                    getTypeOrder(aRecord.type) - getTypeOrder(bRecord.type);
                  if (typeDelta !== 0) {
                    return typeDelta;
                  }
                  return getReferenceOrder(a) - getReferenceOrder(b);
                })
                .slice(0, 6)
            : [];
          const subjectIdsRaw = extra.subject_ids;
          const subjectIds = Array.isArray(subjectIdsRaw)
            ? subjectIdsRaw
                .map((item) => (typeof item === "number" ? item : Number(item)))
                .filter((item) => Number.isFinite(item) && item > 0)
            : [];
          const fallbackMappings = subjectIds
            .map((subjectId) => subjectMap[subjectId] ?? null)
            .filter((item): item is DirectorSubject => Boolean(item))
            .sort((a, b) => {
              const typeDelta = getTypeOrder(a.category) - getTypeOrder(b.category);
              if (typeDelta !== 0) {
                return typeDelta;
              }
              return a.id - b.id;
            })
            .map((subject) => ({
              reference_id: `#${subject.id}`,
              asset_name: subject.name,
              type: subject.category,
              subject_id: subject.id,
              image_url: subject.image_url ?? null,
            }));
          const displayMappings = mappings.length > 0 ? mappings : fallbackMappings.slice(0, 6);
          const imageUrlRaw = extra.imageUrl;
          const imageUrl = typeof imageUrlRaw === "string" ? imageUrlRaw : "";
          const imageDisplayUrl = resolveBusinessAssetUrl(imageUrl);
          const videoUrlRaw = extra.videoUrl;
          const videoUrl = typeof videoUrlRaw === "string" ? videoUrlRaw : "";
          return (
            <div
              key={storyboard.id}
              className="grid grid-cols-[40px_minmax(320,1fr)_minmax(160px,480px)_minmax(200px,480px)_minmax(200px,480px)] gap-4 rounded-lg border border-neutral-800 bg-[#141414] p-4"
            >
              <div className="flex flex-col items-center gap-2 border-r border-neutral-800 pr-3">
                <span className="text-base font-semibold text-neutral-500">#{index + 1}</span>
                <button
                  onClick={() => {
                    void handleDelete(storyboard.id);
                  }}
                  disabled={deletingId === storyboard.id}
                  className="rounded p-1 text-red-400 hover:bg-neutral-800 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="min-w-0">
                {editingId === storyboard.id ? (
                  <textarea
                    value={editingText}
                    autoFocus
                    onChange={(event) => setEditingText(event.target.value)}
                    onBlur={() => {
                      void handleSaveEdit(storyboard.id);
                    }}
                    onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setEditingId(null);
                        setEditingText("");
                      }
                    }}
                    className="h-[176px] w-full resize-none rounded border border-orange-500/50 bg-neutral-900 p-2 text-xs leading-6 text-neutral-100 outline-none"
                  />
                ) : (
                  <div
                    onClick={() => {
                      setEditingId(storyboard.id);
                      setEditingText(storyboard.narrative ?? storyboard.title ?? "");
                    }}
                    className="h-[176px] cursor-text overflow-y-auto rounded border border-transparent p-2 text-xs leading-6 text-neutral-300 hover:border-orange-500/40 hover:text-neutral-100"
                  >
                    {storyboard.narrative ??
                      storyboard.title ??
                      (isZh ? "暂无描述" : "No description")}
                  </div>
                )}
              </div>
              <div className="@container min-w-0 border-l border-neutral-800 pl-3">
                <div className="grid grid-cols-2 gap-2 @md:grid-cols-3">
                  {displayMappings.length > 0 ? (
                    displayMappings.map((item, idx) => {
                      const record = asRecord(item);
                      const referenceId =
                        typeof record.reference_id === "string"
                          ? record.reference_id
                          : typeof record.ref_id === "string"
                            ? record.ref_id
                            : String(idx);
                      const assetName =
                        typeof record.asset_name === "string"
                          ? record.asset_name
                          : typeof record.name === "string"
                            ? record.name
                            : isZh
                              ? "未命名素材"
                              : "Unnamed";
                      const subjectIdRaw = record.subject_id;
                      const subjectId =
                        typeof subjectIdRaw === "number"
                          ? subjectIdRaw
                          : typeof subjectIdRaw === "string"
                            ? Number(subjectIdRaw)
                            : NaN;
                      const subjectFromMap =
                        Number.isFinite(subjectId) && subjectId > 0
                          ? subjectMap[subjectId]
                          : undefined;
                      const cardImageRaw =
                        typeof record.image_url === "string"
                          ? record.image_url
                          : subjectFromMap?.image_url;
                      const cardImageUrl = resolveBusinessAssetUrl(cardImageRaw);
                      return (
                        <div
                          key={`${referenceId}-${idx}`}
                          className="overflow-hidden rounded border border-neutral-800 bg-neutral-900"
                        >
                          <div className="group relative aspect-video w-full border-b border-neutral-800 bg-neutral-950">
                            {cardImageUrl ? (
                              <img
                                src={cardImageUrl}
                                alt={assetName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-neutral-700">
                                <ImageIcon size={16} />
                              </div>
                            )}
                            <span className="absolute top-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-neutral-300">
                              {referenceId}
                            </span>
                          </div>
                          <div className="flex h-[28px] items-center text-center">
                            <div
                              title={assetName}
                              className="w-full truncate px-2 text-xs text-neutral-200"
                            >
                              {assetName}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-2 flex aspect-square items-center justify-center rounded border border-dashed border-neutral-800 bg-neutral-900 text-[11px] text-neutral-600">
                      {isZh ? "无参考" : "No refs"}
                    </div>
                  )}
                </div>
              </div>
              <div className="border-l border-neutral-800 pl-3">
                <div className="group relative aspect-video overflow-hidden rounded border border-neutral-800 bg-neutral-900">
                  {imageDisplayUrl ? (
                    <>
                      <img src={imageDisplayUrl} alt="storyboard" className="h-full w-full object-cover" />
                      <ImagePreview src={imageDisplayUrl} alt={`storyboard-${storyboard.id}`} />
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-neutral-700">
                      <ImageIcon size={24} />
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      const narrative = (
                        storyboard.narrative ??
                        storyboard.title ??
                        ""
                      ).trim();
                      onGenerateStoryboardPrompt?.({
                        storyboardId: storyboard.id,
                        narrative,
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded border border-emerald-900/50 bg-emerald-900/30 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-900/50"
                  >
                    <Wand2 size={11} />
                    {isZh ? "生成" : "Generate"}
                  </button>
                  <button
                    onClick={() => {
                      fileInputRefs.current[storyboard.id]?.click();
                    }}
                    disabled={Boolean(imageUploadingMap[storyboard.id])}
                    className="inline-flex items-center gap-1 rounded border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {imageUploadingMap[storyboard.id] ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Upload size={11} />
                    )}
                    {isZh ? "上传" : "Upload"}
                  </button>
                </div>
                <input
                  ref={(element) => {
                    fileInputRefs.current[storyboard.id] = element;
                  }}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleUploadStoryboardImage(storyboard.id, file);
                    }
                    event.target.value = "";
                  }}
                />
              </div>
              <div className="border-l border-neutral-800 pl-3">
                <div className="aspect-video overflow-hidden rounded border border-neutral-800 bg-neutral-900">
                  {videoUrl ? (
                    <video src={videoUrl} controls className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-neutral-700">
                      <Film size={24} />
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      void handleGenerateVideo(storyboard);
                    }}
                    disabled={Boolean(videoGeneratingMap[storyboard.id])}
                    className="inline-flex items-center gap-1 rounded border border-purple-900/50 bg-purple-900/30 px-3 py-1 text-xs text-purple-300 hover:bg-purple-900/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Wand2 size={11} />
                    {videoGeneratingMap[storyboard.id]
                      ? isZh
                        ? "生成中"
                        : "Generating"
                      : isZh
                        ? "生成"
                        : "Generate"}
                  </button>
                  <button
                    onClick={() => {
                      if (videoUrl) {
                        window.open(videoUrl, "_blank");
                      }
                    }}
                    className="rounded border border-neutral-700 bg-neutral-800 p-1.5 text-neutral-300 hover:bg-neutral-700"
                  >
                    <Download size={11} />
                  </button>
                </div>
                {videoStatusMap[storyboard.id] ? (
                  <div className="mt-1 text-center text-[11px] text-neutral-500">
                    {videoStatusMap[storyboard.id]}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
