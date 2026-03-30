"use client";

import { Download, Edit2, Image as ImageIcon, Loader2, MoreVertical, Plus, Sparkles, Trash2, Upload, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { downloadImageFromUrl, ImagePreview } from "@/components/image-preview";
import { getBusinessAPIBaseURL } from "@/core/config";
import { updateEpisode, type EpisodeListItem } from "@/core/projects";

import { useDirectorEventBus } from "./director-event-bus";

type DirectorSubjectCategory = "character" | "scene" | "prop";

type DirectorSubject = {
  id: number;
  name: string;
  category: string;
  alias?: string | null;
  description?: string | null;
  image_url?: string | null;
  project_id: number;
  extra_metadata?: Record<string, unknown> | null;
};

type DirectorSubjectVariant = {
  id: number;
  subject_id: number;
  name: string;
  description?: string | null;
  image_url?: string | null;
  variant_type?: string | null;
  extra_metadata?: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
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

async function createSubject(payload: {
  project_id: number;
  name: string;
  description?: string;
  category: DirectorSubjectCategory;
  episode_id: number | null;
}): Promise<DirectorSubject> {
  const response = await fetch(`${getBusinessAPIBaseURL()}/api/v1/subjects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJSONOrThrow<DirectorSubject>(response);
}

async function updateSubject(
  subjectId: number,
  payload: { name?: string; description?: string },
): Promise<DirectorSubject> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/subjects/${subjectId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return readJSONOrThrow<DirectorSubject>(response);
}

async function deleteSubject(subjectId: number): Promise<void> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/subjects/${subjectId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!response.ok) {
    await readJSONOrThrow<{ message: string }>(response);
  }
}

async function uploadSubjectImage(
  projectCode: string,
  subjectId: number,
  file: File,
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/projects/${projectCode}/subjects/${subjectId}/upload-image`,
    {
      method: "POST",
      body: formData,
    },
  );
  if (!response.ok) {
    await readJSONOrThrow<{ message: string }>(response);
  }
}

async function loadSubjectVariants(
  subjectId: number,
): Promise<DirectorSubjectVariant[]> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/subjects/${subjectId}/variants`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );
  const data = await readJSONOrThrow<{ data?: DirectorSubjectVariant[] }>(response);
  return Array.isArray(data.data) ? data.data : [];
}

function isVariantMatchedEpisode(
  variant: DirectorSubjectVariant,
  episodeId: number,
): boolean {
  const metadata = asRecord(variant.extra_metadata);
  const episodeIdCandidates: unknown[] = [
    metadata.episode_id,
    metadata.episodeId,
    metadata.scoped_episode_id,
  ];
  if (
    episodeIdCandidates.some((item) => {
      if (typeof item === "number") {
        return item === episodeId;
      }
      if (typeof item === "string") {
        return Number(item) === episodeId;
      }
      return false;
    })
  ) {
    return true;
  }
  const episodeListCandidates: unknown[] = [
    metadata.episode_ids,
    metadata.episodeIds,
    metadata.scoped_episode_ids,
    metadata.episodes,
  ];
  return episodeListCandidates.some((list) => {
    if (!Array.isArray(list)) {
      return false;
    }
    return list.some((item) => {
      if (typeof item === "number") {
        return item === episodeId;
      }
      if (typeof item === "string") {
        return Number(item) === episodeId;
      }
      return false;
    });
  });
}

function DirectorSubjectSection({
  title,
  count,
  isZh,
  children,
}: {
  title: string;
  count: number;
  isZh: boolean;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium text-white">{title}</h3>
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400">
            {count}
          </span>
        </div>
      </div>
      {count === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-neutral-800 bg-[#111] text-sm text-neutral-500">
          {isZh ? `暂无${title}` : `No ${title}`}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function DirectorSubjectGrid({
  subjects,
  isZh,
  episodeId,
  activeMenuSubjectId,
  onOpenMenu,
  onEdit,
  onDelete,
  onGenerate,
  onUpload,
  fileInputRefs,
  subjectVariantMap,
}: {
  subjects: DirectorSubject[];
  isZh: boolean;
  episodeId: number;
  activeMenuSubjectId: number | null;
  onOpenMenu: (subjectId: number | null) => void;
  onEdit: (subject: DirectorSubject) => void;
  onDelete: (subject: DirectorSubject) => void;
  onGenerate?: (subject: DirectorSubject) => void;
  onUpload: (subject: DirectorSubject, file: File) => void;
  fileInputRefs: React.MutableRefObject<Record<number, HTMLInputElement | null>>;
  subjectVariantMap: Record<number, DirectorSubjectVariant[]>;
}) {
  const [activeTabKeyBySubject, setActiveTabKeyBySubject] = useState<
    Record<number, string>
  >({});

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      {subjects.map((subject) => {
        const allVariants = subjectVariantMap[subject.id] ?? [];
        const episodeVariants = allVariants.filter((variant) =>
          isVariantMatchedEpisode(variant, episodeId),
        );
        const displayVariants =
          episodeVariants.length > 0 ? episodeVariants : allVariants;
        const tabs = [
          {
            key: `subject-${subject.id}`,
            name: isZh ? "本体" : "Base",
            displayName: subject.name,
            description: subject.description,
            imageUrl: subject.image_url,
          },
          ...displayVariants.map((variant) => ({
            key: `variant-${variant.id}`,
            name: variant.name,
            displayName: variant.name,
            description: variant.description,
            imageUrl: variant.image_url,
          })),
        ];
        const activeKey = activeTabKeyBySubject[subject.id];
        const selectedTab = tabs.find((item) => item.key === activeKey) ?? tabs[0]!;
        const selectedImageUrl = resolveBusinessAssetUrl(selectedTab.imageUrl);
        const selectedDescription =
          selectedTab.description ?? (isZh ? "暂无描述" : "No description");
        return (
          <div
            key={subject.id}
            className="flex flex-col overflow-hidden rounded-lg border border-neutral-800 bg-[#141414] transition-all hover:border-neutral-700"
          >
            <div className="group relative aspect-video shrink-0 bg-neutral-900">
              {selectedImageUrl ? (
                <>
                  <img
                    src={selectedImageUrl}
                    alt={selectedTab.displayName}
                    className="h-full w-full object-contain"
                  />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-neutral-700">
                  <ImageIcon size={24} />
                </div>
              )}
              <div
                className={`absolute right-2 bottom-2 z-10 transition-opacity ${
                  activeMenuSubjectId === subject.id
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <ImagePreview
                  src={selectedImageUrl}
                  alt={selectedTab.displayName}
                  buttonSize={14}
                  triggerClassName="flex h-7 w-7 items-center justify-center rounded bg-black/50 p-1.5 text-neutral-200 transition-colors hover:bg-black/70"
                />
              </div>
              <div
                className={`absolute top-2 right-2 z-10 transition-opacity ${
                  activeMenuSubjectId === subject.id
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <div className="relative">
                  <button
                    onClick={() =>
                      onOpenMenu(activeMenuSubjectId === subject.id ? null : subject.id)
                    }
                    className="flex h-7 w-7 items-center justify-center rounded bg-black/50 p-1.5 text-neutral-200 transition-colors hover:bg-black/70"
                  >
                    <MoreVertical size={14} />
                  </button>
                  {activeMenuSubjectId === subject.id ? (
                    <div className="absolute top-full right-0 z-20 mt-1 flex w-24 flex-col rounded border border-neutral-700 bg-[#1a1a1a] py-1">
                      <button
                        onClick={() => {
                          if (selectedImageUrl) {
                            void downloadImageFromUrl({
                              url: selectedImageUrl,
                              filenameBase: selectedTab.displayName,
                            });
                          }
                          onOpenMenu(null);
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-left text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white"
                      >
                        <Download size={12} />
                        {isZh ? "下载" : "Download"}
                      </button>
                      <button
                        onClick={() => {
                          onOpenMenu(null);
                          onDelete(subject);
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-left text-xs text-red-400 hover:bg-neutral-800"
                      >
                        <Trash2 size={12} />
                        {isZh ? "删除" : "Delete"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex flex-col p-3">
              <div>
                <div className="mb-2 h-6 overflow-x-auto">
                  <div className="flex w-max gap-1 pr-1">
                    {tabs.map((tab) => {
                      const active = tab.key === selectedTab.key;
                      return (
                        <button
                          key={tab.key}
                          onClick={() =>
                            setActiveTabKeyBySubject((prev) => ({
                              ...prev,
                              [subject.id]: tab.key,
                            }))
                          }
                          className={`shrink-0 rounded border px-2 py-0.5 text-[10px] transition-colors ${
                            active
                              ? "border-orange-500/70 bg-orange-500/15 text-orange-300"
                              : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600"
                          }`}
                        >
                          {tab.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <h4 className="truncate text-sm font-medium text-white">
                  {selectedTab.displayName}
                </h4>
                <p
                  title={selectedDescription}
                  className="mt-1 line-clamp-3 text-xs leading-5 text-neutral-500"
                >
                  {selectedDescription}
                </p>
              </div>
              <div
                className={`mt-3 grid gap-4 border-t border-neutral-800 pt-2 ${
                  onGenerate ? "grid-cols-4" : "grid-cols-3"
                }`}
              >
                {onGenerate ? (
                  <button
                    onClick={() => onGenerate(subject)}
                    className="flex flex-col items-center justify-center gap-1 rounded py-1 text-[10px] text-emerald-400 hover:bg-neutral-800"
                  >
                    <Sparkles size={12} />
                    {isZh ? "生成" : "Generate"}
                  </button>
                ) : null}
                <button
                  onClick={() => fileInputRefs.current[subject.id]?.click()}
                  className="flex flex-col items-center justify-center gap-1 rounded py-1 text-[10px] text-neutral-400 hover:bg-neutral-800 hover:text-white"
                >
                  <Upload size={12} />
                  {isZh ? "上传" : "Upload"}
                </button>
                <button
                  onClick={() => onEdit(subject)}
                  className="flex flex-col items-center justify-center gap-1 rounded py-1 text-[10px] text-neutral-400 hover:bg-neutral-800 hover:text-white"
                >
                  <Edit2 size={12} />
                  {isZh ? "编辑" : "Edit"}
                </button>
                <button
                  onClick={() => onDelete(subject)}
                  className="flex flex-col items-center justify-center gap-1 rounded py-1 text-[10px] text-red-400 hover:bg-neutral-800"
                >
                  <Trash2 size={12} />
                  {isZh ? "删除" : "Delete"}
                </button>
              </div>
            </div>
            <input
              ref={(element) => {
                fileInputRefs.current[subject.id] = element;
              }}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (file) {
                  void onUpload(subject, file);
                }
                event.target.value = "";
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function DirectorModal({
  title,
  isZh,
  confirmLabel,
  onClose,
  onConfirm,
  loading,
  disabled,
  children,
}: {
  title: string;
  isZh: boolean;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-700 bg-[#1a1a1a] p-5">
        <h3 className="mb-3 text-base font-medium text-white">{title}</h3>
        {children}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-neutral-400 hover:text-white"
          >
            {isZh ? "取消" : "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            disabled={disabled || loading}
            className="inline-flex items-center gap-2 rounded bg-orange-600 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DirectorCharacterPanel({
  projectCode,
  projectId,
  episode,
  isZh,
  onEpisodeChange,
  onGenerateCharacterPrompt,
}: {
  projectCode: string;
  projectId: number;
  episode: EpisodeListItem;
  isZh: boolean;
  onEpisodeChange: (episode: EpisodeListItem) => void;
  onGenerateCharacterPrompt?: (payload: {
    subjectId: number;
    category: "character" | "scene" | "prop";
    name: string;
    description: string;
  }) => void;
}) {
  const { subscribe } = useDirectorEventBus();
  const [characters, setCharacters] = useState<DirectorSubject[]>([]);
  const [scenes, setScenes] = useState<DirectorSubject[]>([]);
  const [props, setProps] = useState<DirectorSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createCategory, setCreateCategory] =
    useState<DirectorSubjectCategory>("character");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingSubject, setEditingSubject] = useState<DirectorSubject | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [activeMenuSubjectId, setActiveMenuSubjectId] = useState<number | null>(null);
  const [episodeCharacterIds, setEpisodeCharacterIds] = useState<number[]>([]);
  const [episodeSceneIds, setEpisodeSceneIds] = useState<number[]>([]);
  const [episodePropIds, setEpisodePropIds] = useState<number[]>([]);
  const [subjectVariantMap, setSubjectVariantMap] = useState<
    Record<number, DirectorSubjectVariant[]>
  >({});
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    setEpisodeCharacterIds(
      Array.isArray(episode.character_ids) ? episode.character_ids : [],
    );
    setEpisodeSceneIds(Array.isArray(episode.scene_ids) ? episode.scene_ids : []);
    setEpisodePropIds(Array.isArray(episode.prop_ids) ? episode.prop_ids : []);
  }, [episode.character_ids, episode.id, episode.prop_ids, episode.scene_ids]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const [characterList, sceneList, propList, latestEpisode] = await Promise.all([
        loadProjectSubjects(projectCode, "character"),
        loadProjectSubjects(projectCode, "scene"),
        loadProjectSubjects(projectCode, "prop"),
        readJSONOrThrow<EpisodeListItem>(
          await fetch(`${getBusinessAPIBaseURL()}/api/v1/episodes/${episode.id}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ]);
      const allSubjects = [...characterList, ...sceneList, ...propList];
      const uniqueSubjectIds = Array.from(
        new Set(allSubjects.map((item) => item.id)),
      );
      const variantResults = await Promise.allSettled(
        uniqueSubjectIds.map(async (subjectId) => ({
          subjectId,
          variants: await loadSubjectVariants(subjectId),
        })),
      );
      const nextVariantMap: Record<number, DirectorSubjectVariant[]> = {};
      variantResults.forEach((result) => {
        if (result.status === "fulfilled") {
          nextVariantMap[result.value.subjectId] = result.value.variants;
        }
      });
      setCharacters(characterList);
      setScenes(sceneList);
      setProps(propList);
      setSubjectVariantMap(nextVariantMap);
      setEpisodeCharacterIds(
        Array.isArray(latestEpisode.character_ids) ? latestEpisode.character_ids : [],
      );
      setEpisodeSceneIds(
        Array.isArray(latestEpisode.scene_ids) ? latestEpisode.scene_ids : [],
      );
      setEpisodePropIds(
        Array.isArray(latestEpisode.prop_ids) ? latestEpisode.prop_ids : [],
      );
      onEpisodeChange(latestEpisode);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "加载角色与资产失败"
            : "Failed to load characters and assets",
      );
    } finally {
      setLoading(false);
    }
  }, [episode.id, isZh, onEpisodeChange, projectCode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    return subscribe("asset.image.generate", (event) => {
      console.log("[DirectorCharacter] event", event.method, event.payload);
      if (event.projectCode !== projectCode) {
        return;
      }
      if (event.method !== "completed") {
        return;
      }
      const imageUrl = event.payload.imageUrl;
      if (!imageUrl) {
        return;
      }
      const assetType = event.payload.assetType;
      if (assetType === "subject" && imageUrl) {
        const metadata = asRecord(event.payload.metadata);
        const subjectId =
          event.payload.subjectId ??
          toNumberOrUndefined(metadata.subject_id) ??
          (metadata.source_type === "subject"
            ? toNumberOrUndefined(metadata.source_id)
            : undefined);
        if (!subjectId) {
          void loadData();
          return;
        }
        setCharacters((prev) =>
          prev.map((item) =>
            item.id === subjectId
              ? {
                  ...item,
                  image_url: imageUrl,
                }
              : item,
          ),
        );
        setScenes((prev) =>
          prev.map((item) =>
            item.id === subjectId
              ? {
                  ...item,
                  image_url: imageUrl,
                }
              : item,
          ),
        );
        setProps((prev) =>
          prev.map((item) =>
            item.id === subjectId
              ? {
                  ...item,
                  image_url: imageUrl,
                }
              : item,
          ),
        );
        setSubjectVariantMap((prev) => {
          const variants = prev[subjectId];
          if (!variants || variants.length === 0) {
            return prev;
          }
          const updated = variants.map((variant) =>
            variant.image_url
              ? variant
              : {
                  ...variant,
                  image_url: imageUrl,
                },
          );
          return {
            ...prev,
            [subjectId]: updated,
          };
        });
        return;
      }
      if (assetType === "variant" && imageUrl) {
        const metadata = asRecord(event.payload.metadata);
        const variantId =
          event.payload.variantId ??
          toNumberOrUndefined(metadata.variant_id) ??
          ((metadata.source_type === "variant" || metadata.source_type === "subject_variant")
            ? toNumberOrUndefined(metadata.source_id)
            : undefined);
        if (!variantId) {
          void loadData();
          return;
        }
        setSubjectVariantMap((prev) => {
          const next: Record<number, DirectorSubjectVariant[]> = {};
          let changed = false;
          for (const [key, variants] of Object.entries(prev)) {
            const subjectId = Number(key);
            const updated = variants.map((variant) => {
              if (variant.id !== variantId) {
                return variant;
              }
              changed = true;
              return {
                ...variant,
                image_url: imageUrl,
              };
            });
            next[subjectId] = updated;
          }
          return changed ? next : prev;
        });
        return;
      }
      void loadData();
    });
  }, [loadData, projectCode, subscribe]);

  const applyEpisodeSubjectUpdate = useCallback(
    async (next: {
      character_ids: number[];
      scene_ids: number[];
      prop_ids: number[];
    }) => {
      const updatedEpisode = await updateEpisode(episode.id, next);
      setEpisodeCharacterIds(next.character_ids);
      setEpisodeSceneIds(next.scene_ids);
      setEpisodePropIds(next.prop_ids);
      onEpisodeChange(updatedEpisode);
    },
    [episode.id, onEpisodeChange],
  );

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) {
      return;
    }
    setIsCreating(true);
    try {
      const created = await createSubject({
        project_id: projectId,
        name: newName.trim(),
        description: newDesc.trim(),
        category: createCategory,
        episode_id: null,
      });
      const next = {
        character_ids: [...episodeCharacterIds],
        scene_ids: [...episodeSceneIds],
        prop_ids: [...episodePropIds],
      };
      if (createCategory === "character" && !next.character_ids.includes(created.id)) {
        next.character_ids.push(created.id);
      }
      if (createCategory === "scene" && !next.scene_ids.includes(created.id)) {
        next.scene_ids.push(created.id);
      }
      if (createCategory === "prop" && !next.prop_ids.includes(created.id)) {
        next.prop_ids.push(created.id);
      }
      await applyEpisodeSubjectUpdate(next);
      setShowCreateModal(false);
      setNewName("");
      setNewDesc("");
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "创建资产失败"
            : "Failed to create asset",
      );
    } finally {
      setIsCreating(false);
    }
  }, [
    applyEpisodeSubjectUpdate,
    createCategory,
    episodeCharacterIds,
    episodePropIds,
    episodeSceneIds,
    isZh,
    loadData,
    newDesc,
    newName,
    projectId,
  ]);

  const handleUpdate = useCallback(async () => {
    if (!editingSubject || !editName.trim()) {
      return;
    }
    setIsUpdating(true);
    try {
      await updateSubject(editingSubject.id, {
        name: editName.trim(),
        description: editDesc.trim(),
      });
      setEditingSubject(null);
      setEditName("");
      setEditDesc("");
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "更新资产失败"
            : "Failed to update asset",
      );
    } finally {
      setIsUpdating(false);
    }
  }, [editDesc, editName, editingSubject, isZh, loadData]);

  const handleDelete = useCallback(
    async (subject: DirectorSubject) => {
      const confirmed = window.confirm(
        isZh
          ? `确定删除「${subject.name}」吗？`
          : `Delete "${subject.name}"?`,
      );
      if (!confirmed) {
        return;
      }
      try {
        await deleteSubject(subject.id);
        const next = {
          character_ids: episodeCharacterIds.filter((id) => id !== subject.id),
          scene_ids: episodeSceneIds.filter((id) => id !== subject.id),
          prop_ids: episodePropIds.filter((id) => id !== subject.id),
        };
        await applyEpisodeSubjectUpdate(next);
        await loadData();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : isZh
              ? "删除资产失败"
              : "Failed to delete asset",
        );
      }
    },
    [
      applyEpisodeSubjectUpdate,
      episodeCharacterIds,
      episodePropIds,
      episodeSceneIds,
      isZh,
      loadData,
    ],
  );

  const handleUploadImage = useCallback(
    async (subject: DirectorSubject, file: File) => {
      try {
        await uploadSubjectImage(projectCode, subject.id, file);
        await loadData();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : isZh
              ? "上传图片失败"
              : "Failed to upload image",
        );
      }
    },
    [isZh, loadData, projectCode],
  );

  const charactersInEpisode = useMemo(
    () =>
      episodeCharacterIds.length > 0
        ? characters.filter((item) => episodeCharacterIds.includes(item.id))
        : characters,
    [characters, episodeCharacterIds],
  );
  const scenesInEpisode = useMemo(
    () =>
      episodeSceneIds.length > 0
        ? scenes.filter((item) => episodeSceneIds.includes(item.id))
        : scenes,
    [episodeSceneIds, scenes],
  );
  const propsInEpisode = useMemo(
    () =>
      episodePropIds.length > 0
        ? props.filter((item) => episodePropIds.includes(item.id))
        : props,
    [episodePropIds, props],
  );

  return (
    <div className="p-4 [&_button:not(:disabled)]:cursor-pointer">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-neutral-300">
          <Users size={18} />
          <span className="text-sm font-medium">{isZh ? "资产管理" : "Assets"}</span>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowAddMenu((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700"
          >
            <Plus size={14} />
            {isZh ? "添加" : "Add"}
          </button>
          {showAddMenu ? (
            <div className="absolute top-full right-0 z-20 mt-1 flex w-32 flex-col rounded-md border border-neutral-700 bg-[#1a1a1a] py-1">
              <button
                onClick={() => {
                  setCreateCategory("character");
                  setShowCreateModal(true);
                  setShowAddMenu(false);
                }}
                className="px-3 py-2 text-left text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white"
              >
                {isZh ? "添加角色" : "Add Character"}
              </button>
              <button
                onClick={() => {
                  setCreateCategory("scene");
                  setShowCreateModal(true);
                  setShowAddMenu(false);
                }}
                className="px-3 py-2 text-left text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white"
              >
                {isZh ? "添加场景" : "Add Scene"}
              </button>
              <button
                onClick={() => {
                  setCreateCategory("prop");
                  setShowCreateModal(true);
                  setShowAddMenu(false);
                }}
                className="px-3 py-2 text-left text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white"
              >
                {isZh ? "添加道具" : "Add Prop"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {errorMessage ? (
        <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {errorMessage}
        </div>
      ) : null}
      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center gap-2 text-sm text-neutral-500">
          <Loader2 size={16} className="animate-spin" />
          {isZh ? "加载中..." : "Loading..."}
        </div>
      ) : (
        <div className="space-y-8">
          <DirectorSubjectSection
            title={isZh ? "角色" : "Characters"}
            count={charactersInEpisode.length}
            isZh={isZh}
          >
            <DirectorSubjectGrid
              subjects={charactersInEpisode}
              isZh={isZh}
              episodeId={episode.id}
              activeMenuSubjectId={activeMenuSubjectId}
              onOpenMenu={setActiveMenuSubjectId}
              onEdit={(subject) => {
                setEditingSubject(subject);
                setEditName(subject.name);
                setEditDesc(subject.description ?? "");
              }}
              onDelete={handleDelete}
              onGenerate={(subject) => {
                const description = subject.description?.trim();
                onGenerateCharacterPrompt?.({
                  subjectId: subject.id,
                  category: "character",
                  name: subject.name,
                  description:
                    description && description.length > 0
                      ? description
                      : isZh
                        ? "暂无描述"
                        : "No description",
                });
              }}
              onUpload={handleUploadImage}
              fileInputRefs={fileInputRefs}
              subjectVariantMap={subjectVariantMap}
            />
          </DirectorSubjectSection>
          <DirectorSubjectSection
            title={isZh ? "场景" : "Scenes"}
            count={scenesInEpisode.length}
            isZh={isZh}
          >
            <DirectorSubjectGrid
              subjects={scenesInEpisode}
              isZh={isZh}
              episodeId={episode.id}
              activeMenuSubjectId={activeMenuSubjectId}
              onOpenMenu={setActiveMenuSubjectId}
              onEdit={(subject) => {
                setEditingSubject(subject);
                setEditName(subject.name);
                setEditDesc(subject.description ?? "");
              }}
              onDelete={handleDelete}
              onGenerate={(subject) => {
                const description = subject.description?.trim();
                onGenerateCharacterPrompt?.({
                  subjectId: subject.id,
                  category: "scene",
                  name: subject.name,
                  description:
                    description && description.length > 0
                      ? description
                      : isZh
                        ? "暂无描述"
                        : "No description",
                });
              }}
              onUpload={handleUploadImage}
              fileInputRefs={fileInputRefs}
              subjectVariantMap={subjectVariantMap}
            />
          </DirectorSubjectSection>
          <DirectorSubjectSection
            title={isZh ? "道具" : "Props"}
            count={propsInEpisode.length}
            isZh={isZh}
          >
            <DirectorSubjectGrid
              subjects={propsInEpisode}
              isZh={isZh}
              episodeId={episode.id}
              activeMenuSubjectId={activeMenuSubjectId}
              onOpenMenu={setActiveMenuSubjectId}
              onEdit={(subject) => {
                setEditingSubject(subject);
                setEditName(subject.name);
                setEditDesc(subject.description ?? "");
              }}
              onDelete={handleDelete}
              onGenerate={(subject) => {
                const description = subject.description?.trim();
                onGenerateCharacterPrompt?.({
                  subjectId: subject.id,
                  category: "prop",
                  name: subject.name,
                  description:
                    description && description.length > 0
                      ? description
                      : isZh
                        ? "暂无描述"
                        : "No description",
                });
              }}
              onUpload={handleUploadImage}
              fileInputRefs={fileInputRefs}
              subjectVariantMap={subjectVariantMap}
            />
          </DirectorSubjectSection>
        </div>
      )}
      {showCreateModal ? (
        <DirectorModal
          title={
            isZh
              ? `新建${createCategory === "character" ? "角色" : createCategory === "scene" ? "场景" : "道具"}`
              : `Create ${createCategory}`
          }
          isZh={isZh}
          confirmLabel={isZh ? "创建" : "Create"}
          onClose={() => {
            setShowCreateModal(false);
            setNewName("");
            setNewDesc("");
          }}
          onConfirm={() => {
            void handleCreate();
          }}
          loading={isCreating}
          disabled={!newName.trim()}
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">
                {isZh ? "名称" : "Name"}
              </label>
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">
                {isZh ? "描述" : "Description"}
              </label>
              <textarea
                value={newDesc}
                onChange={(event) => setNewDesc(event.target.value)}
                className="h-24 w-full resize-none rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </DirectorModal>
      ) : null}
      {editingSubject ? (
        <DirectorModal
          title={isZh ? "编辑资产" : "Edit Asset"}
          isZh={isZh}
          confirmLabel={isZh ? "保存" : "Save"}
          onClose={() => setEditingSubject(null)}
          onConfirm={() => {
            void handleUpdate();
          }}
          loading={isUpdating}
          disabled={!editName.trim()}
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">
                {isZh ? "名称" : "Name"}
              </label>
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">
                {isZh ? "描述" : "Description"}
              </label>
              <textarea
                value={editDesc}
                onChange={(event) => setEditDesc(event.target.value)}
                className="h-24 w-full resize-none rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </DirectorModal>
      ) : null}
    </div>
  );
}
