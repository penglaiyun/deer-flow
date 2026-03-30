"use client";

import { Edit2, ImageIcon, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/core/i18n/hooks";
import {
  createStyle,
  deleteStyle,
  loadStyles,
  updateStyle,
  type Style,
  type StyleCategory,
  type StyleCreate,
} from "@/core/styles";

import { StyleEditorModal } from "./_components/style-editor-modal";

const CATEGORIES: { value: StyleCategory | "all"; labelZh: string; labelEn: string }[] = [
  { value: "all", labelZh: "全部", labelEn: "All" },
  { value: "anime", labelZh: "动漫", labelEn: "Anime" },
  { value: "realism", labelZh: "写实", labelEn: "Realism" },
  { value: "commercial", labelZh: "商业", labelEn: "Commercial" },
  { value: "artistic", labelZh: "艺术", labelEn: "Artistic" },
  { value: "general", labelZh: "通用", labelEn: "General" },
];

type ModalState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; style: Style };

function categoryLabel(category: string, isZh: boolean) {
  const found = CATEGORIES.find((c) => c.value === category);
  if (!found) return category;
  return isZh ? found.labelZh : found.labelEn;
}

export default function StyleManagementPage() {
  const { locale } = useI18n();
  const isZh = locale.startsWith("zh");

  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<StyleCategory | "all">("all");
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const reloadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const params =
        selectedCategory !== "all" ? { category: selectedCategory } : undefined;
      const data = await loadStyles(params);
      setStyles(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "加载风格数据失败"
            : "Failed to load styles",
      );
    } finally {
      setLoading(false);
    }
  }, [isZh, selectedCategory]);

  useEffect(() => {
    void reloadData();
  }, [reloadData]);

  useEffect(() => {
    document.title = `${isZh ? "风格管理" : "Style Management"} - Pudding Studio`;
  }, [isZh]);

  const handleCreate = async (formData: StyleCreate) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      await createStyle(formData);
      setModalState({ open: false });
      await reloadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "创建风格失败，请检查名称是否重复"
            : "Failed to create style",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (formData: StyleCreate) => {
    if (modalState.open && modalState.mode !== "edit") return;
    const { style } = modalState as { open: true; mode: "edit"; style: Style };
    setSubmitting(true);
    setErrorMessage("");
    try {
      await updateStyle(style.id, formData);
      setModalState({ open: false });
      await reloadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "更新风格失败"
            : "Failed to update style",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (styleItem: Style) => {
    const confirmed = window.confirm(
      isZh ? `确定删除风格「${styleItem.name}」吗？` : `Delete style "${styleItem.name}"?`,
    );
    if (!confirmed) return;
    setDeletingId(styleItem.id);
    try {
      await deleteStyle(styleItem.id);
      await reloadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "删除失败，系统预置风格无法删除"
            : "Failed to delete style",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const editingStyle =
    modalState.open && modalState.mode === "edit" ? modalState.style : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-white md:text-3xl">
            {isZh ? "风格管理" : "Style Management"}
          </h1>
          <p className="text-sm text-neutral-400">
            {isZh
              ? "管理AI生成的风格预设和提示词模板"
              : "Manage AI style presets and prompt templates"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void reloadData()}
            className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-neutral-400 transition-colors hover:text-white"
          >
            <RefreshCw size={12} />
            {isZh ? "刷新" : "Refresh"}
          </button>
          <button
            onClick={() => setModalState({ open: true, mode: "create" })}
            className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-600/10 px-3 py-1.5 text-[11px] font-bold text-green-500 transition-all hover:bg-green-600 hover:text-white"
          >
            <Plus size={12} />
            {isZh ? "新建风格" : "New Style"}
          </button>
        </div>
      </div>

      {/* Error */}
      {errorMessage ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {errorMessage}
        </div>
      ) : null}

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              selectedCategory === cat.value
                ? "bg-white text-black"
                : "border border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:bg-neutral-800 hover:text-white"
            }`}
          >
            {isZh ? cat.labelZh : cat.labelEn}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center gap-2 text-sm text-neutral-500">
          <Loader2 size={16} className="animate-spin" />
          {isZh ? "加载中..." : "Loading..."}
        </div>
      ) : styles.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-neutral-500">
          <ImageIcon size={30} className="opacity-60" />
          <p className="text-sm">{isZh ? "暂无风格数据" : "No styles found"}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-800">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#0f0f0f]">
              <tr className="border-b border-neutral-800 text-left text-xs text-neutral-400">
                <th className="w-20 px-4 py-3">{isZh ? "预览" : "Preview"}</th>
                <th className="w-48 px-4 py-3">{isZh ? "名称" : "Name"}</th>
                <th className="w-24 px-4 py-3">{isZh ? "分类" : "Category"}</th>
                <th className="px-4 py-3">{isZh ? "描述 / 提示词" : "Description / Prompt"}</th>
                <th className="w-24 px-4 py-3">{isZh ? "状态" : "Status"}</th>
                <th className="w-24 px-4 py-3 text-right">{isZh ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {styles.map((styleItem) => (
                <tr
                  key={styleItem.id}
                  className="group border-b border-neutral-900 transition-colors hover:bg-neutral-800/50"
                >
                  {/* Preview */}
                  <td className="px-4 py-3">
                    <div className="h-12 w-12 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800">
                      {styleItem.preview_image_url ? (
                        <img
                          src={styleItem.preview_image_url}
                          alt={styleItem.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-neutral-600">
                          <span className="text-xs">{isZh ? "无图" : "N/A"}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{styleItem.name}</div>
                    <div className="font-mono text-xs text-neutral-500">
                      {styleItem.name_en}
                    </div>
                  </td>
                  {/* Category */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-300">
                      {categoryLabel(styleItem.category, isZh)}
                    </span>
                  </td>
                  {/* Description/Prompt */}
                  <td className="max-w-md px-4 py-3">
                    <div className="space-y-1">
                      {styleItem.description && (
                        <div className="line-clamp-1 text-sm text-neutral-300">
                          {styleItem.description}
                        </div>
                      )}
                      <div className="line-clamp-1 font-mono text-xs text-neutral-500">
                        {styleItem.prompt}
                      </div>
                    </div>
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {styleItem.is_preset && (
                        <span className="w-fit rounded border border-blue-900/50 bg-blue-900/30 px-2 py-0.5 text-[10px] text-blue-400">
                          {isZh ? "系统预设" : "Preset"}
                        </span>
                      )}
                      {!styleItem.is_active && (
                        <span className="w-fit rounded border border-red-900/50 bg-red-900/30 px-2 py-0.5 text-[10px] text-red-400">
                          {isZh ? "已禁用" : "Disabled"}
                        </span>
                      )}
                      {!styleItem.is_preset && styleItem.is_active && (
                        <span className="w-fit rounded border border-green-900/50 bg-green-900/30 px-2 py-0.5 text-[10px] text-green-400">
                          {isZh ? "启用中" : "Active"}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() =>
                          setModalState({ open: true, mode: "edit", style: styleItem })
                        }
                        className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
                        title={isZh ? "编辑" : "Edit"}
                      >
                        <Edit2 size={16} />
                      </button>
                      {!styleItem.is_preset && (
                        <button
                          onClick={() => void handleDelete(styleItem)}
                          disabled={deletingId === styleItem.id}
                          className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-900/30 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                          title={isZh ? "删除" : "Delete"}
                        >
                          {deletingId === styleItem.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalState.open ? (
        <StyleEditorModal
          style={editingStyle}
          loading={submitting}
          isZh={isZh}
          onClose={() => setModalState({ open: false })}
          onConfirm={(formData) => {
            if (modalState.mode === "edit") {
              void handleUpdate(formData);
            } else {
              void handleCreate(formData);
            }
          }}
        />
      ) : null}
    </div>
  );
}
