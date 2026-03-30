"use client";

import {
  Bookmark,
  Edit3,
  Film,
  Grid3X3,
  LayoutGrid,
  LoaderCircle,
  Plus,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useStudioHeader } from "@/components/studio/header-context";
import {
  createEpisode,
  deleteEpisode,
  loadProjectByCode,
  loadProjectEpisodes,
  updateEpisode,
  type EpisodeListItem,
  type ProjectDetailItem,
} from "@/core/projects";

import { ProjectSettingsModal } from "./_components/project-settings-modal";

function statusClass(status: string | null | undefined) {
  if (status === "in_progress") {
    return "border border-blue-500/30 bg-blue-500/20 text-blue-400";
  }
  if (status === "completed") {
    return "border border-green-500/30 bg-green-500/20 text-green-400";
  }
  return "bg-neutral-700 text-neutral-300";
}

function statusLabel(status: string | null | undefined, isZh: boolean) {
  if (status === "in_progress") return isZh ? "进行中" : "In Progress";
  if (status === "completed") return isZh ? "已完成" : "Completed";
  if (status === "draft") return isZh ? "草稿" : "Draft";
  return isZh ? "草稿" : "Draft";
}

function episodeNumberOf(episode: EpisodeListItem, fallbackIndex: number) {
  if (episode.episode_number && episode.episode_number > 0) {
    return episode.episode_number;
  }
  const match = /第(\d+)集/.exec(episode.name);
  if (match?.[1]) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallbackIndex;
}

function synopsisOf(episode: EpisodeListItem, isZh: boolean) {
  const raw = episode.idea ?? episode.description ?? "";
  if (!raw) {
    return isZh ? "暂无简介" : "No synopsis";
  }
  return raw;
}

function titleOf(episode: EpisodeListItem, index: number) {
  const number = String(episodeNumberOf(episode, index + 1)).padStart(3, "0");
  return `第${number}集. ${episode.name}`;
}

function nextEpisodeNumber(episodes: EpisodeListItem[]) {
  let maxNumber = 0;
  episodes.forEach((episode, index) => {
    const current = episodeNumberOf(episode, index + 1);
    if (current > maxNumber) {
      maxNumber = current;
    }
  });
  return maxNumber + 1;
}

type EpisodeFormValues = {
  name: string;
  episodeNumber: number;
  idea: string;
};

function EpisodeFormModal({
  open,
  title,
  defaults,
  error,
  submitting,
  submitText,
  isZh,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  defaults: EpisodeFormValues;
  error: string;
  submitting: boolean;
  submitText: string;
  isZh: boolean;
  onClose: () => void;
  onSubmit: (values: EpisodeFormValues) => void;
}) {
  const [name, setName] = useState(defaults.name);
  const [episodeNumber, setEpisodeNumber] = useState(defaults.episodeNumber);
  const [idea, setIdea] = useState(defaults.idea);

  useEffect(() => {
    if (!open) return;
    setName(defaults.name);
    setEpisodeNumber(defaults.episodeNumber);
    setIdea(defaults.idea);
  }, [defaults.episodeNumber, defaults.idea, defaults.name, open]);

  if (!open || typeof window === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-[1120px] max-w-[96vw] flex-col overflow-hidden rounded-3xl border border-neutral-800 bg-[#111] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-6 py-4">
          <h2 className="font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-neutral-800"
          >
            <X size={16} className="text-neutral-500" />
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ name, episodeNumber, idea });
          }}
          className="min-h-0 flex flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="flex min-h-[520px] flex-col">
              <div className="flex-1 space-y-4">
                <label className="block">
                  <div className="text-sm font-bold uppercase tracking-widest text-neutral-600">
                    {isZh ? "剧集名称" : "Episode Name"}
                  </div>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    spellCheck={false}
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-white placeholder-neutral-600 focus:border-neutral-700 focus:outline-none focus:ring-0"
                  />
                </label>
                <label className="block">
                  <div className="text-sm font-bold uppercase tracking-widest text-neutral-600">
                    {isZh ? "编号" : "Episode Number"}
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={episodeNumber}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      setEpisodeNumber(
                        Number.isFinite(parsed) && parsed >= 1 ? parsed : 1,
                      );
                    }}
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-white placeholder-neutral-600 focus:border-neutral-700 focus:outline-none focus:ring-0"
                  />
                </label>
                <label className="flex flex-1 flex-col">
                  <div className="text-sm font-bold uppercase tracking-widest text-neutral-600">
                    {isZh ? "创意" : "Idea"}
                  </div>
                  <textarea
                    rows={14}
                    value={idea}
                    onChange={(event) => setIdea(event.target.value)}
                    spellCheck={false}
                    className="mt-1 min-h-[140px] w-full flex-1 resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-white placeholder-neutral-600 focus:border-neutral-700 focus:outline-none focus:ring-0"
                  />
                </label>
                {error ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="space-y-4 lg:min-h-[520px] lg:border-l lg:border-neutral-800 lg:pl-6">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold uppercase tracking-widest text-neutral-600">
                  {isZh ? "角色" : "Characters"}
                </label>
                <button type="button" disabled className="text-sm font-bold text-orange-500/60">
                  {isZh ? "添加角色(0)" : "Add Character (0)"}
                </button>
              </div>
              <div className="min-h-[160px] max-h-[240px] overflow-auto rounded-xl border border-neutral-800 bg-[#0d0d0d]">
                <table className="w-full table-fixed">
                  <thead className="border-b border-neutral-800 bg-[#0d0d0d]">
                    <tr>
                      <th className="w-[30%] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                        {isZh ? "角色" : "Name"}
                      </th>
                      <th className="w-[50%] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                        {isZh ? "备注" : "Note"}
                      </th>
                      <th className="w-[20%] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                        {isZh ? "操作" : "Action"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-sm text-neutral-500">
                        {isZh ? "暂无数据" : "No data"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold uppercase tracking-widest text-neutral-600">
                  {isZh ? "场景" : "Scenes"}
                </label>
                <button type="button" disabled className="text-sm font-bold text-orange-500/60">
                  {isZh ? "添加场景(0)" : "Add Scene (0)"}
                </button>
              </div>
              <div className="min-h-[160px] max-h-[240px] overflow-auto rounded-xl border border-neutral-800 bg-[#0d0d0d]">
                <table className="w-full table-fixed">
                  <thead className="border-b border-neutral-800 bg-[#0d0d0d]">
                    <tr>
                      <th className="w-[30%] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                        {isZh ? "场景" : "Name"}
                      </th>
                      <th className="w-[50%] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                        {isZh ? "备注" : "Note"}
                      </th>
                      <th className="w-[20%] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                        {isZh ? "操作" : "Action"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-sm text-neutral-500">
                        {isZh ? "暂无数据" : "No data"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold uppercase tracking-widest text-neutral-600">
                  {isZh ? "道具" : "Props"}
                </label>
                <button type="button" disabled className="text-sm font-bold text-orange-500/60">
                  {isZh ? "添加道具(0)" : "Add Prop (0)"}
                </button>
              </div>
              <div className="min-h-[160px] max-h-[240px] overflow-auto rounded-xl border border-neutral-800 bg-[#0d0d0d]">
                <table className="w-full table-fixed">
                  <thead className="border-b border-neutral-800 bg-[#0d0d0d]">
                    <tr>
                      <th className="w-[30%] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                        {isZh ? "道具" : "Name"}
                      </th>
                      <th className="w-[50%] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                        {isZh ? "备注" : "Note"}
                      </th>
                      <th className="w-[20%] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                        {isZh ? "操作" : "Action"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-sm text-neutral-500">
                        {isZh ? "暂无数据" : "No data"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          </div>
          <div className="shrink-0 border-t border-neutral-800 px-6 py-4">
            <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isZh ? "取消" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : null}
              {submitText}
            </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const { setHeader, resetHeader } = useStudioHeader();
  const params = useParams<{ projectCode: string }>();
  const projectCode = params?.projectCode ?? "";
  const isZh =
    typeof document !== "undefined" ? document.documentElement.lang.startsWith("zh") : true;

  const [project, setProject] = useState<ProjectDetailItem | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCreateEpisodeOpen, setIsCreateEpisodeOpen] = useState(false);
  const [isCreatingEpisode, setIsCreatingEpisode] = useState(false);
  const [createEpisodeError, setCreateEpisodeError] = useState("");
  const [editingEpisode, setEditingEpisode] = useState<EpisodeListItem | null>(null);
  const [isUpdatingEpisode, setIsUpdatingEpisode] = useState(false);
  const [updateEpisodeError, setUpdateEpisodeError] = useState("");
  const [publishingEpisodeId, setPublishingEpisodeId] = useState<number | null>(null);
  const [deletingEpisodeId, setDeletingEpisodeId] = useState<number | null>(null);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [createEpisodeDefaults, setCreateEpisodeDefaults] = useState({
    name: "",
    episodeNumber: 1,
    idea: "",
  });
  const [editEpisodeDefaults, setEditEpisodeDefaults] = useState({
    name: "",
    episodeNumber: 1,
    idea: "",
  });

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!projectCode) {
        setProject(null);
        setEpisodes([]);
        setErrorMessage(isZh ? "项目参数缺失" : "Missing project parameter");
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorMessage("");
      try {
        const [projectData, episodeData] = await Promise.all([
          loadProjectByCode(projectCode),
          loadProjectEpisodes(projectCode),
        ]);
        if (!cancelled) {
          setProject(projectData);
          setEpisodes(episodeData);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : isZh
                ? "加载项目详情失败"
                : "Failed to load project detail",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [isZh, projectCode]);

  useEffect(() => {
    if (!project) {
      resetHeader();
      return;
    }
    setHeader({
      backHref: "/projects",
      title: project.name || "",
      subtitle: "",
    });
    return () => {
      resetHeader();
    };
  }, [project, resetHeader, setHeader]);

  const sortedEpisodes = useMemo(() => {
    return [...episodes].sort((a, b) => {
      return episodeNumberOf(b, 0) - episodeNumberOf(a, 0);
    });
  }, [episodes]);

  const openCreateEpisodeModal = () => {
    const next = nextEpisodeNumber(episodes);
    setCreateEpisodeDefaults({
      name: `第${next}集`,
      episodeNumber: next,
      idea: "",
    });
    setCreateEpisodeError("");
    setIsCreateEpisodeOpen(true);
  };

  const closeCreateEpisodeModal = () => {
    setIsCreateEpisodeOpen(false);
    setCreateEpisodeError("");
    setIsCreatingEpisode(false);
  };

  const handleCreateEpisode = async (values: EpisodeFormValues) => {
    if (!project) {
      return;
    }
    const name = values.name.trim();
    const episodeNumber = values.episodeNumber;
    const idea = values.idea.trim();
    if (!name) {
      setCreateEpisodeError(isZh ? "请输入剧集名称" : "Episode name is required");
      return;
    }
    setIsCreatingEpisode(true);
    setCreateEpisodeError("");
    try {
      await createEpisode({
        name,
        project_id: project.id,
        episode_number: episodeNumber,
        idea: idea || undefined,
      });
      const latestEpisodes = await loadProjectEpisodes(projectCode);
      setEpisodes(latestEpisodes);
      closeCreateEpisodeModal();
    } catch (error) {
      setCreateEpisodeError(
        error instanceof Error
          ? error.message
          : isZh
            ? "创建剧集失败，请稍后重试"
            : "Failed to create episode",
      );
      setIsCreatingEpisode(false);
    }
  };

  const openEditEpisodeModal = (episode: EpisodeListItem) => {
    setEditingEpisode(episode);
    setEditEpisodeDefaults({
      name: episode.name,
      episodeNumber: episode.episode_number && episode.episode_number > 0 ? episode.episode_number : 1,
      idea: episode.idea ?? "",
    });
    setUpdateEpisodeError("");
  };

  const closeEditEpisodeModal = () => {
    setEditingEpisode(null);
    setIsUpdatingEpisode(false);
    setUpdateEpisodeError("");
  };

  const handleUpdateEpisode = async (values: EpisodeFormValues) => {
    if (!editingEpisode) {
      return;
    }
    const name = values.name.trim();
    const episodeNumber = values.episodeNumber;
    const idea = values.idea.trim();
    if (!name) {
      setUpdateEpisodeError(isZh ? "请输入剧集名称" : "Episode name is required");
      return;
    }
    setIsUpdatingEpisode(true);
    setUpdateEpisodeError("");
    try {
      await updateEpisode(editingEpisode.id, {
        name,
        episode_number: episodeNumber,
        idea: idea || undefined,
      });
      const latestEpisodes = await loadProjectEpisodes(projectCode);
      setEpisodes(latestEpisodes);
      closeEditEpisodeModal();
    } catch (error) {
      setUpdateEpisodeError(
        error instanceof Error
          ? error.message
          : isZh
            ? "更新剧集失败，请稍后重试"
            : "Failed to update episode",
      );
      setIsUpdatingEpisode(false);
    }
  };

  const handlePublishEpisode = async (episode: EpisodeListItem) => {
    setPublishingEpisodeId(episode.id);
    try {
      await updateEpisode(episode.id, { status: "completed" });
      const latestEpisodes = await loadProjectEpisodes(projectCode);
      setEpisodes(latestEpisodes);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : isZh
            ? "发布失败，请稍后重试"
            : "Failed to publish episode",
      );
    } finally {
      setPublishingEpisodeId(null);
    }
  };

  const handleDeleteEpisode = async (episode: EpisodeListItem) => {
    const confirmed = window.confirm(
      isZh ? `确定删除剧集「${episode.name}」吗？` : `Delete episode "${episode.name}"?`,
    );
    if (!confirmed) return;
    setDeletingEpisodeId(episode.id);
    try {
      await deleteEpisode(episode.id);
      setEpisodes((prev) => prev.filter((item) => item.id !== episode.id));
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : isZh
            ? "删除失败，请稍后重试"
            : "Failed to delete episode",
      );
    } finally {
      setDeletingEpisodeId(null);
    }
  };

  if (loading) {
    return (
      <div className="m-4 flex items-center justify-center py-12">
        <div className="text-sm text-neutral-500">
          {isZh ? "加载中..." : "Loading..."}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="m-4 flex flex-col items-center justify-center py-12 text-center">
        <div className="text-sm text-neutral-500">
          {errorMessage || (isZh ? "项目不存在" : "Project not found")}
        </div>
      </div>
    );
  }

  return (
    <div className="m-4 flex flex-col">
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-3">
          <button
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-orange-500"
            title={isZh ? "切换到工作台" : "Open Workbench"}
            disabled
          >
            <Grid3X3 size={24} />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <button
              className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-white transition-colors hover:bg-neutral-800"
              onClick={() => setIsProjectSettingsOpen(true)}
            >
              <Settings2 size={18} />
              {isZh ? "项目设置" : "Project Settings"}
            </button>
            <button
              className="flex items-center gap-2 rounded-lg bg-neutral-700 px-4 py-2 text-white transition-colors hover:bg-neutral-600"
              onClick={() => router.push(`/projects/${projectCode}/subjects`)}
            >
              {isZh ? "主体管理" : "Subjects"}
            </button>
            <button
              className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700"
              onClick={openCreateEpisodeModal}
            >
              <Plus size={18} />
              {isZh ? "新建剧集" : "New Episode"}
            </button>
          </div>
        </div>
        {project.description && (
          <p className="text-neutral-500">{project.description}</p>
        )}
      </div>

      {sortedEpisodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Film size={48} className="mb-4 text-neutral-700" />
          <p className="text-sm text-neutral-500">
            {isZh
              ? "还没有剧集，创建一个开始创作吧"
              : "No episodes yet, create one to start."}
          </p>
          <button
            onClick={openCreateEpisodeModal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
          >
            <Plus size={16} />
            {isZh ? "新建剧集" : "New Episode"}
          </button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-4">
          {sortedEpisodes.map((episode, index) => (
            <div
              key={episode.id}
              className="group rounded-xl border border-neutral-800 bg-[#111] p-6 transition-colors hover:border-neutral-700"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white transition-colors hover:text-orange-500">
                      {titleOf(episode, index)}
                    </h3>
                    <button
                      className={`rounded p-1 transition-colors ${
                        episode.in_todo_list
                          ? "text-orange-500"
                          : "text-neutral-600 hover:text-neutral-400"
                      }`}
                      disabled
                    >
                      <Bookmark
                        size={16}
                        fill={episode.in_todo_list ? "currentColor" : "none"}
                      />
                    </button>
                  </div>

                  <p className="mb-3 line-clamp-2 text-sm text-neutral-500">
                    {synopsisOf(episode, isZh)}
                  </p>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded px-3 py-1 text-xs font-medium ${statusClass(episode.status)}`}
                    >
                      {statusLabel(episode.status, isZh)}
                    </span>
                    {episode.in_todo_list && (
                      <span className="text-xs text-orange-500">
                        {isZh ? "待制作" : "Todo"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditEpisodeModal(episode)}
                    className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
                  >
                    <Edit3 size={14} />
                    {isZh ? "编辑" : "Edit"}
                  </button>
                  <button
                    onClick={() => handlePublishEpisode(episode)}
                    disabled={publishingEpisodeId === episode.id}
                    className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {publishingEpisodeId === episode.id ? (
                      <LoaderCircle size={14} className="animate-spin" />
                    ) : (
                      <Upload size={14} />
                    )}
                    {isZh ? "发布" : "Publish"}
                  </button>
                  <button
                    onClick={() =>
                      router.push(
                        `/projects/${projectCode}/director/${episode.id}`,
                      )
                    }
                    className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
                  >
                    <Film size={14} />
                    {isZh ? "制片" : "Production"}
                  </button>
                  <button
                    onClick={() =>
                      router.push(`/projects/${projectCode}/director/${episode.id}?tab=storyboard`)
                    }
                    className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
                  >
                    <LayoutGrid size={14} />
                    Flow
                  </button>
                  <button
                    onClick={() => handleDeleteEpisode(episode)}
                    disabled={deletingEpisodeId === episode.id}
                    className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-600/10 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingEpisodeId === episode.id ? (
                      <LoaderCircle size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    {isZh ? "删除" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <EpisodeFormModal
        open={isCreateEpisodeOpen}
        title={isZh ? "新建剧集" : "New Episode"}
        defaults={createEpisodeDefaults}
        error={createEpisodeError}
        submitting={isCreatingEpisode}
        submitText={isZh ? "创建剧集" : "Create Episode"}
        isZh={isZh}
        onClose={closeCreateEpisodeModal}
        onSubmit={handleCreateEpisode}
      />
      <EpisodeFormModal
        open={Boolean(editingEpisode)}
        title={isZh ? "编辑剧集" : "Edit Episode"}
        defaults={editEpisodeDefaults}
        error={updateEpisodeError}
        submitting={isUpdatingEpisode}
        submitText={isZh ? "保存修改" : "Save"}
        isZh={isZh}
        onClose={closeEditEpisodeModal}
        onSubmit={handleUpdateEpisode}
      />
      <ProjectSettingsModal
        open={isProjectSettingsOpen}
        project={project}
        isZh={isZh}
        onClose={() => setIsProjectSettingsOpen(false)}
        onSaved={(updatedProject) => setProject(updatedProject)}
      />
    </div>
  );
}
