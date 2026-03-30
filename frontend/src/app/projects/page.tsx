"use client";

import {
  CalendarDays,
  ImageIcon,
  LoaderCircle,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { getBusinessAPIBaseURL } from "@/core/config";
import { useI18n } from "@/core/i18n/hooks";
import { createProject, loadProjects, uploadProjectCover } from "@/core/projects";
import type { ProjectListItem } from "@/core/projects";

const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"] as const;
const PROJECT_STATUS_OPTIONS = ["draft", "active", "completed"] as const;
const PROJECT_TYPE_OPTIONS = ["电影", "短剧", "漫剧", "短视频", "MV", "广告"] as const;

function statusText(status: string, locale: string) {
  if (status === "active") return locale.startsWith("zh") ? "进行中" : "Active";
  if (status === "completed")
    return locale.startsWith("zh") ? "已完成" : "Completed";
  if (status === "draft") return locale.startsWith("zh") ? "草稿" : "Draft";
  return status ?? "Unknown";
}

function statusClassName(status: string) {
  if (status === "active") {
    return "bg-blue-500/90 text-white shadow-blue-500/30";
  }
  if (status === "completed") {
    return "bg-green-500/90 text-white shadow-green-500/30";
  }
  if (status === "draft") {
    return "bg-orange-500/90 text-white shadow-orange-500/30";
  }
  return "bg-neutral-700/90 text-neutral-100 shadow-neutral-700/30";
}

function projectGenre(project: ProjectListItem, locale: string) {
  if (project.style && project.style.trim().length > 0) {
    return project.style;
  }
  if (project.style_template && project.style_template.trim().length > 0) {
    return project.style_template;
  }
  return locale.startsWith("zh") ? "未设置" : "Not set";
}

function aspectRatioLabel(aspectRatio: string | null, locale: string) {
  const ratio = aspectRatio ?? "16:9";
  const mapZh: Record<string, string> = {
    "16:9": "16:9（横屏）",
    "9:16": "9:16（竖屏）",
    "1:1": "1:1（方形）",
    "4:3": "4:3（标准）",
    "3:4": "3:4（竖版）",
  };
  const mapEn: Record<string, string> = {
    "16:9": "16:9 (Landscape)",
    "9:16": "9:16 (Portrait)",
    "1:1": "1:1 (Square)",
    "4:3": "4:3 (Standard)",
    "3:4": "3:4 (Portrait)",
  };
  return locale.startsWith("zh") ? (mapZh[ratio] ?? ratio) : (mapEn[ratio] ?? ratio);
}

function formatDateString(value: string | null, locale: string) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function resolveCoverUrl(url: string | null) {
  if (!url) {
    return null;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${getBusinessAPIBaseURL()}${url}`;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createErrorMessage, setCreateErrorMessage] = useState("");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    status: "draft",
    projectType: "",
    style: "",
    aspectRatio: "16:9",
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);

  useEffect(() => {
    document.title = `${locale.startsWith("zh") ? "项目列表" : "Projects"} - ${t.pages.appName}`;
  }, [locale, t.pages.appName]);

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setCreateErrorMessage("");
    setCreateForm({
      name: "",
      description: "",
      status: "draft",
      projectType: "",
      style: "",
      aspectRatio: "16:9",
    });
    setCoverFile(null);
    setCoverPreviewUrl("");
  };

  const fetchProjects = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await loadProjects();
      setProjects(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load projects",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const data = await loadProjects();
        if (!cancelled) {
          setProjects(data);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to load projects",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    setIsLoading(true);
    setErrorMessage("");
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProjects = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return projects;
    }
    return projects.filter((project) => {
      const name = project.name.toLowerCase();
      const description = (project.description ?? "").toLowerCase();
      return name.includes(keyword) || description.includes(keyword);
    });
  }, [projects, searchQuery]);

  const subtitle = useMemo(() => {
    if (isLoading) {
      return locale.startsWith("zh") ? "正在加载项目列表..." : "Loading projects...";
    }
    if (errorMessage) {
      return locale.startsWith("zh")
        ? "项目接口请求失败，请检查后端服务连接。"
        : "Project API request failed. Please check backend connectivity.";
    }
    return locale.startsWith("zh")
      ? `已加载 ${projects.length} 个项目`
      : `${projects.length} project(s) loaded`;
  }, [errorMessage, isLoading, locale, projects.length]);

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = createForm.name.trim();
    if (!name) {
      setCreateErrorMessage(locale.startsWith("zh") ? "请输入项目名称" : "Project name is required");
      return;
    }
    setIsCreating(true);
    setCreateErrorMessage("");
    try {
      const createdProject = await createProject({
        name,
        description: createForm.description.trim() || undefined,
        status: createForm.status,
        project_type: createForm.projectType || undefined,
        style: createForm.style.trim() || undefined,
        style_template: createForm.style.trim() || undefined,
        aspect_ratio: createForm.aspectRatio,
      });
      if (coverFile) {
        await uploadProjectCover(createdProject.code, coverFile);
      }
      await fetchProjects();
      closeCreateModal();
    } catch (error) {
      setCreateErrorMessage(
        error instanceof Error
          ? error.message
          : locale.startsWith("zh")
            ? "创建项目失败，请稍后重试"
            : "Failed to create project",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleCoverFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) {
      return;
    }
    if (!nextFile.type.startsWith("image/")) {
      setCreateErrorMessage(locale.startsWith("zh") ? "请选择图片文件" : "Please select an image file");
      return;
    }
    if (nextFile.size > 5 * 1024 * 1024) {
      setCreateErrorMessage(locale.startsWith("zh") ? "图片大小不能超过 5MB" : "Image must be less than 5MB");
      return;
    }
    setCoverFile(nextFile);
    setCoverPreviewUrl(URL.createObjectURL(nextFile));
    setCreateErrorMessage("");
  };

  return (
    <div className="relative m-4 flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between pb-4">
        <div className="flex flex-1 items-center gap-3">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-1.5 text-[11px] font-bold text-neutral-500">
            {locale.startsWith("zh") ? "全部项目" : "All Projects"}
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-1.5 text-[11px] font-bold text-neutral-500">
            {locale.startsWith("zh") ? "状态筛选" : "Status"}
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-1.5 text-[11px] font-bold text-neutral-500">
            {locale.startsWith("zh") ? "创建时间" : "Created Time"}
          </div>
          <div className="relative ml-4 w-64">
            <Search
              size={14}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-neutral-600"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={
                locale.startsWith("zh")
                  ? "搜索项目名称或描述"
                  : "Search project name or description"
              }
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 py-1.5 pr-3 pl-9 text-xs text-neutral-300 placeholder-neutral-600 transition-colors focus:border-neutral-700 focus:ring-0"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void fetchProjects()}
            className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-neutral-400 transition-colors hover:text-white"
          >
            <RefreshCw size={12} />
            {locale.startsWith("zh") ? "刷新" : "Refresh"}
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-600/10 px-3 py-1.5 text-[11px] font-bold text-green-500 transition-all hover:bg-green-600 hover:text-white"
          >
            <Plus size={12} />
            {locale.startsWith("zh") ? "创建项目" : "New Project"}
          </button>
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-neutral-500">
            {locale.startsWith("zh") ? "加载中..." : "Loading..."}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-8 text-center text-sm text-neutral-500">
            {searchQuery
              ? locale.startsWith("zh")
                ? "未找到匹配的项目"
                : "No matched projects"
              : locale.startsWith("zh")
                ? "暂无项目"
                : "No projects"}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProjects.map((project) => {
              const coverUrl = resolveCoverUrl(project.cover_image_url);
              return (
                <div
                  key={project.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-[#0a0a0a] transition-all hover:border-neutral-700"
                >
                  <div className="group relative aspect-video w-full cursor-pointer overflow-hidden bg-neutral-800">
                    <div
                      className={`absolute top-2 left-2 z-20 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-lg ${statusClassName(project.status)}`}
                    >
                      {statusText(project.status, locale)}
                    </div>
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={project.name}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                          const placeholder =
                            event.currentTarget.parentElement?.querySelector(
                              ".placeholder-image",
                            );
                          if (placeholder) {
                            (placeholder as HTMLElement).style.display = "flex";
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className={`placeholder-image h-full w-full items-center justify-center ${
                        coverUrl ? "hidden" : "flex"
                      }`}
                    >
                      <div className="text-center">
                        <ImageIcon
                          size={42}
                          className="mx-auto mb-2 text-neutral-600 opacity-50"
                        />
                        <p className="text-xs text-neutral-600">
                          {locale.startsWith("zh") ? "暂无封面" : "No Cover"}
                        </p>
                      </div>
                    </div>
                    <button className="absolute top-2 right-2 z-20 rounded-md bg-black/40 p-1 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100">
                      <MoreVertical size={14} />
                    </button>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="mb-2 line-clamp-2 text-base font-bold text-white">
                      {project.name}
                    </h3>
                    <div className="mb-2 flex items-center gap-3 text-xs text-neutral-400">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <CalendarDays className="size-3.5" />
                        {formatDateString(project.updated_at, locale)}
                      </span>
                      <span className="truncate">
                        {projectGenre(project, locale)}
                        {" · "}
                        {aspectRatioLabel(project.aspect_ratio, locale)}
                      </span>
                    </div>
                    <p className="mb-3 line-clamp-3 h-[60px] text-xs leading-relaxed text-neutral-400">
                      {project.description ??
                        (locale.startsWith("zh")
                          ? "暂无项目描述"
                          : "No project description")}
                    </p>
                    <div className="mb-4 grid grid-cols-4 gap-3">
                      <div className="rounded-lg border border-neutral-800/50 bg-neutral-900/50 p-2 text-center">
                        <div className="mb-1 text-[10px] tracking-wide text-neutral-500 uppercase">
                          {locale.startsWith("zh") ? "剧集" : "Episodes"}
                        </div>
                        <div className="text-lg font-bold text-white">
                          {project.episode_count}
                        </div>
                      </div>
                      <div className="rounded-lg border border-neutral-800/50 bg-neutral-900/50 p-2 text-center">
                        <div className="mb-1 text-[10px] tracking-wide text-neutral-500 uppercase">
                          {locale.startsWith("zh") ? "主体" : "Subjects"}
                        </div>
                        <div className="text-lg font-bold text-white">
                          {project.subject_count}
                        </div>
                      </div>
                      <div className="rounded-lg border border-neutral-800/50 bg-neutral-900/50 p-2 text-center">
                        <div className="mb-1 text-[10px] tracking-wide text-neutral-500 uppercase">
                          {locale.startsWith("zh") ? "视频" : "Videos"}
                        </div>
                        <div className="text-lg font-bold text-white">
                          {project.video_count}
                        </div>
                      </div>
                      <div className="rounded-lg border border-neutral-800/50 bg-neutral-900/50 p-2 text-center">
                        <div className="mb-1 text-[10px] tracking-wide text-neutral-500 uppercase">
                          {locale.startsWith("zh") ? "图片" : "Images"}
                        </div>
                        <div className="text-lg font-bold text-white">
                          {project.image_count}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/projects/${project.code}`)}
                      className="mt-auto w-full rounded-lg bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-orange-500/20 transition-all hover:from-orange-700 hover:to-orange-600 hover:shadow-orange-500/30"
                    >
                      {locale.startsWith("zh") ? "进入项目" : "Open Project"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!isLoading && (
          <div className="pt-4 text-xs text-neutral-500">
            {subtitle}
            {errorMessage ? ` · ${errorMessage}` : ""}
          </div>
        )}
      </div>
      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-800 bg-[#0b0b0b]">
            <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
              <h2 className="text-base font-semibold text-white">
                {locale.startsWith("zh") ? "创建项目" : "Create Project"}
              </h2>
              <button
                onClick={closeCreateModal}
                className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-xs text-neutral-400">
                  {locale.startsWith("zh") ? "项目名称" : "Project Name"}
                  <input
                    value={createForm.name}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder={
                      locale.startsWith("zh") ? "请输入项目名称" : "Please input project name"
                    }
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-orange-500/60"
                  />
                </label>
                <label className="space-y-2 text-xs text-neutral-400">
                  {locale.startsWith("zh") ? "项目类型" : "Project Type"}
                  <select
                    value={createForm.projectType}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, projectType: event.target.value }))
                    }
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none transition-colors focus:border-orange-500/60"
                  >
                    <option value="">{locale.startsWith("zh") ? "未设置" : "Not set"}</option>
                    {PROJECT_TYPE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-xs text-neutral-400">
                  {locale.startsWith("zh") ? "项目状态" : "Status"}
                  <select
                    value={createForm.status}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, status: event.target.value }))
                    }
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none transition-colors focus:border-orange-500/60"
                  >
                    {PROJECT_STATUS_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {statusText(item, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-xs text-neutral-400">
                  {locale.startsWith("zh") ? "视频比例" : "Aspect Ratio"}
                  <select
                    value={createForm.aspectRatio}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, aspectRatio: event.target.value }))
                    }
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none transition-colors focus:border-orange-500/60"
                  >
                    {ASPECT_RATIOS.map((item) => (
                      <option key={item} value={item}>
                        {aspectRatioLabel(item, locale)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="space-y-2 text-xs text-neutral-400">
                {locale.startsWith("zh") ? "美术风格" : "Style"}
                <input
                  value={createForm.style}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, style: event.target.value }))
                  }
                  placeholder={locale.startsWith("zh") ? "例如：赛博朋克" : "e.g. Cyberpunk"}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-orange-500/60"
                />
              </label>
              <label className="space-y-2 text-xs text-neutral-400">
                {locale.startsWith("zh") ? "项目简介" : "Description"}
                <textarea
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                  placeholder={
                    locale.startsWith("zh") ? "请输入项目简介（可选）" : "Description (optional)"
                  }
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-orange-500/60"
                />
              </label>
              <div className="space-y-2 text-xs text-neutral-400">
                <div>{locale.startsWith("zh") ? "项目封面" : "Cover Image"}</div>
                {coverPreviewUrl ? (
                  <img
                    src={coverPreviewUrl}
                    alt={locale.startsWith("zh") ? "封面预览" : "Cover Preview"}
                    className="aspect-video w-full rounded-lg border border-neutral-800 object-cover"
                  />
                ) : null}
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-700">
                  <Upload size={15} />
                  {coverFile?.name ??
                    (locale.startsWith("zh")
                      ? "上传封面（JPG/PNG，5MB以内）"
                      : "Upload cover (JPG/PNG, max 5MB)")}
                  <input type="file" accept="image/*" onChange={handleCoverFileChange} className="hidden" />
                </label>
              </div>
              {createErrorMessage ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {createErrorMessage}
                </div>
              ) : null}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={isCreating}
                  className="rounded-lg border border-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {locale.startsWith("zh") ? "取消" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreating ? <LoaderCircle size={14} className="animate-spin" /> : null}
                  {locale.startsWith("zh") ? "创建项目" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
