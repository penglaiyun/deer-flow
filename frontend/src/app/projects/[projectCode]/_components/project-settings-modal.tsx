"use client";

import { LoaderCircle, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { getBusinessAPIBaseURL } from "@/core/config";
import { updateProjectByCode, type ProjectDetailItem } from "@/core/projects";

type ProjectSettingsFormValues = {
  name: string;
  description: string;
  status: string;
  projectType: string;
  aspectRatio: string;
  style: string;
};

type StyleOption = {
  id: number;
  name: string;
  name_en: string;
};

const PROJECT_STATUS_OPTIONS = [
  { value: "draft", labelZh: "草稿", labelEn: "Draft" },
  { value: "active", labelZh: "进行中", labelEn: "Active" },
  { value: "completed", labelZh: "已完成", labelEn: "Completed" },
  { value: "archived", labelZh: "已归档", labelEn: "Archived" },
] as const;

const PROJECT_TYPE_OPTIONS = ["电影", "短剧", "漫剧", "短视频", "MV", "广告"] as const;
const ASPECT_RATIO_OPTIONS = ["16:9", "9:16", "1:1", "4:3", "3:4"] as const;

function defaultsOfProject(project: ProjectDetailItem): ProjectSettingsFormValues {
  return {
    name: project.name,
    description: project.description ?? "",
    status: project.status ?? "draft",
    projectType: project.project_type ?? "",
    aspectRatio: project.aspect_ratio ?? "16:9",
    style: project.style_template ?? project.style ?? "",
  };
}

export function ProjectSettingsModal({
  open,
  project,
  isZh,
  onClose,
  onSaved,
}: {
  open: boolean;
  project: ProjectDetailItem | null;
  isZh: boolean;
  onClose: () => void;
  onSaved: (project: ProjectDetailItem) => void;
}) {
  const [form, setForm] = useState<ProjectSettingsFormValues | null>(null);
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !project) return;
    setForm(defaultsOfProject(project));
    setError("");
  }, [open, project]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setLoadingStyles(true);
      try {
        const response = await fetch(`${getBusinessAPIBaseURL()}/api/v1/styles?is_active=true`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = (await response.json()) as { styles?: StyleOption[] };
        if (!cancelled) {
          setStyles(Array.isArray(data.styles) ? data.styles : []);
        }
      } catch {
        if (!cancelled) {
          setStyles([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingStyles(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const statusOptions = useMemo(
    () =>
      PROJECT_STATUS_OPTIONS.map((option) => ({
        value: option.value,
        label: isZh ? option.labelZh : option.labelEn,
      })),
    [isZh],
  );

  if (!open || !project || !form || typeof window === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-[720px] max-w-[96vw] flex-col overflow-hidden rounded-3xl border border-neutral-800 bg-[#111] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-6 py-4">
          <div className="flex items-center gap-2 font-bold text-white">
            <Settings2 size={18} className="text-neutral-400" />
            {isZh ? "编辑项目属性" : "Edit Project Settings"}
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={16} />
          </button>
        </div>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const name = form.name.trim();
            if (!name) {
              setError(isZh ? "请输入项目名称" : "Project name is required");
              return;
            }
            setSubmitting(true);
            setError("");
            try {
              const updated = await updateProjectByCode(project.code, {
                name,
                description: form.description.trim() || undefined,
                status: form.status || undefined,
                project_type: form.projectType || undefined,
                aspect_ratio: form.aspectRatio || undefined,
                style: form.style || undefined,
                style_template: form.style || undefined,
              });
              onSaved(updated);
              onClose();
            } catch (submitError) {
              setError(
                submitError instanceof Error
                  ? submitError.message
                  : isZh
                    ? "保存失败，请稍后重试"
                    : "Failed to save project settings",
              );
            } finally {
              setSubmitting(false);
            }
          }}
          className="min-h-0 flex-1 overflow-y-auto p-6"
        >
          <div className="space-y-4">
            <label className="block">
              <div className="text-sm font-bold uppercase tracking-widest text-neutral-600">
                {isZh ? "项目名称" : "Project Name"}
              </div>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                spellCheck={false}
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-white placeholder-neutral-600 focus:border-neutral-700 focus:outline-none focus:ring-0"
              />
            </label>

            <label className="block">
              <div className="text-sm font-bold uppercase tracking-widest text-neutral-600">
                {isZh ? "项目简介" : "Description"}
              </div>
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                }
                spellCheck={false}
                className="mt-1 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-white placeholder-neutral-600 focus:border-neutral-700 focus:outline-none focus:ring-0"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <div className="text-sm font-bold uppercase tracking-widest text-neutral-600">
                  {isZh ? "项目状态" : "Status"}
                </div>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, status: event.target.value } : prev))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-white focus:border-neutral-700 focus:outline-none focus:ring-0"
                >
                  {statusOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="text-sm font-bold uppercase tracking-widest text-neutral-600">
                  {isZh ? "项目类型" : "Project Type"}
                </div>
                <select
                  value={form.projectType}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, projectType: event.target.value } : prev))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-white focus:border-neutral-700 focus:outline-none focus:ring-0"
                >
                  <option value="">{isZh ? "未设置" : "Not set"}</option>
                  {PROJECT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="text-sm font-bold uppercase tracking-widest text-neutral-600">
                  {isZh ? "视频比例" : "Aspect Ratio"}
                </div>
                <select
                  value={form.aspectRatio}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, aspectRatio: event.target.value } : prev))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-white focus:border-neutral-700 focus:outline-none focus:ring-0"
                >
                  {ASPECT_RATIO_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="text-sm font-bold uppercase tracking-widest text-neutral-600">
                  {isZh ? "美术风格" : "Style"}
                </div>
                <select
                  value={form.style}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, style: event.target.value } : prev))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-white focus:border-neutral-700 focus:outline-none focus:ring-0"
                  disabled={loadingStyles}
                >
                  <option value="">
                    {loadingStyles ? (isZh ? "加载风格中..." : "Loading styles...") : isZh ? "未设置" : "Not set"}
                  </option>
                  {styles.map((style) => (
                    <option key={style.id} value={style.name_en}>
                      {style.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-800 pt-4">
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
              {submitting ? <LoaderCircle size={14} className="animate-spin" /> : null}
              {isZh ? "保存属性" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
