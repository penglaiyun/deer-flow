"use client";

import {
  Edit2,
  Image as ImageIcon,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { useStudioHeader } from "@/components/studio/header-context";
import { getBusinessAPIBaseURL } from "@/core/config";
import { useI18n } from "@/core/i18n/hooks";
import { loadProjectByCode, type ProjectDetailItem } from "@/core/projects";

import { AssetEditorModal } from "./_components/asset-editor-modal";
import {
  SubjectCreationModal,
  type SubjectCreationTarget,
} from "./_components/subject-creation-modal";

type SubjectCategory = "character" | "scene" | "prop";

type SubjectItem = {
  id: number;
  name: string;
  category: SubjectCategory;
  alias?: string | null;
  description?: string | null;
  prompt?: string | null;
  remarks?: string | null;
  image_url?: string | null;
  project_id: number;
  created_at: string;
  updated_at: string;
};

type SubjectVariantItem = {
  id: number;
  subject_id: number;
  name: string;
  description?: string | null;
  image_url?: string | null;
  variant_type?: string | null;
  extra_metadata?: Record<string, unknown> | null;
};

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

type ModalState =
  | { open: false }
  | { open: true; mode: "create-subject" }
  | { open: true; mode: "edit-subject"; subject: SubjectItem }
  | { open: true; mode: "create-variant"; subject: SubjectItem }
  | {
      open: true;
      mode: "edit-variant";
      subject: SubjectItem;
      variant: SubjectVariantItem;
    };

type SubjectCreationState =
  | { open: false }
  | { open: true; target: SubjectCreationTarget };

const EMPTY_FORM: SubjectFormValue = {
  name: "",
  category: "character",
  alias: "",
  description: "",
  prompt: "",
  remarks: "",
};

const EMPTY_VARIANT_FORM: VariantFormValue = {
  name: "",
  description: "",
  variant_type: "default",
};

function resolveAssetUrl(path: string | null | undefined) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${getBusinessAPIBaseURL()}${path}`;
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

async function loadSubjects(projectCode: string): Promise<SubjectItem[]> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/projects/${projectCode}/subjects`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );
  const data = await readJSONOrThrow<{ data?: SubjectItem[] }>(response);
  return Array.isArray(data.data) ? data.data : [];
}

async function loadSubjectVariants(subjectId: number): Promise<SubjectVariantItem[]> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/subjects/${subjectId}/variants`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );
  const data = await readJSONOrThrow<{ data?: SubjectVariantItem[] }>(response);
  return Array.isArray(data.data) ? data.data : [];
}

async function createSubject(
  payload: SubjectFormValue & { project_id: number; image_url?: string | null },
): Promise<SubjectItem> {
  const response = await fetch(`${getBusinessAPIBaseURL()}/api/v1/subjects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJSONOrThrow<SubjectItem>(response);
}

async function updateSubject(
  subjectId: number,
  payload: Partial<SubjectFormValue> & { image_url?: string | null },
): Promise<SubjectItem> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/subjects/${subjectId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return readJSONOrThrow<SubjectItem>(response);
}

async function createSubjectVariant(
  subjectId: number,
  payload: VariantFormValue & { image_url?: string | null },
): Promise<SubjectVariantItem> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/subjects/${subjectId}/variants`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return readJSONOrThrow<SubjectVariantItem>(response);
}

async function updateSubjectVariant(
  variantId: number,
  payload: Partial<VariantFormValue> & { image_url?: string | null },
): Promise<SubjectVariantItem> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/subject-variants/${variantId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return readJSONOrThrow<SubjectVariantItem>(response);
}

async function deleteSubjectVariant(variantId: number): Promise<void> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/subject-variants/${variantId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!response.ok) {
    await readJSONOrThrow<{ message: string }>(response);
  }
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

function categoryLabel(category: SubjectCategory, isZh: boolean) {
  if (category === "character") return isZh ? "角色" : "Character";
  if (category === "scene") return isZh ? "场景" : "Scene";
  return isZh ? "道具" : "Prop";
}

export default function ProjectSubjectsPage() {
  const params = useParams<{ projectCode: string }>();
  const projectCode = params?.projectCode ?? "";
  const { locale } = useI18n();
  const isZh = locale.startsWith("zh");
  const { setHeader, resetHeader } = useStudioHeader();

  const [project, setProject] = useState<ProjectDetailItem | null>(null);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [subjectVariantMap, setSubjectVariantMap] = useState<
    Record<number, SubjectVariantItem[]>
  >({});
  const [selectedTabBySubject, setSelectedTabBySubject] = useState<
    Record<number, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"" | SubjectCategory>("");
  const [subjectForm, setSubjectForm] = useState<SubjectFormValue>(EMPTY_FORM);
  const [variantForm, setVariantForm] = useState<VariantFormValue>(EMPTY_VARIANT_FORM);
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [creationState, setCreationState] = useState<SubjectCreationState>({
    open: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const reloadData = useCallback(async () => {
    if (!projectCode) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const [projectData, subjectData] = await Promise.all([
        loadProjectByCode(projectCode),
        loadSubjects(projectCode),
      ]);
      const variantPairs = await Promise.allSettled(
        subjectData.map(async (subject) => ({
          subjectId: subject.id,
          variants: await loadSubjectVariants(subject.id),
        })),
      );
      const nextVariantMap: Record<number, SubjectVariantItem[]> = {};
      variantPairs.forEach((result) => {
        if (result.status === "fulfilled") {
          nextVariantMap[result.value.subjectId] = result.value.variants;
        }
      });
      setProject(projectData);
      setSubjects(subjectData);
      setSubjectVariantMap(nextVariantMap);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "加载主体管理失败"
            : "Failed to load subjects",
      );
    } finally {
      setLoading(false);
    }
  }, [isZh, projectCode]);

  useEffect(() => {
    void reloadData();
  }, [reloadData]);

  const filteredSubjects = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return subjects.filter((item) => {
      const categoryMatched = categoryFilter ? item.category === categoryFilter : true;
      if (!categoryMatched) return false;
      if (!normalizedKeyword) return true;
      return (
        item.name.toLowerCase().includes(normalizedKeyword) ||
        (item.alias ?? "").toLowerCase().includes(normalizedKeyword) ||
        (item.description ?? "").toLowerCase().includes(normalizedKeyword) ||
        (item.prompt ?? "").toLowerCase().includes(normalizedKeyword)
      );
    });
  }, [categoryFilter, keyword, subjects]);

  useEffect(() => {
    setHeader({
      backHref: `/projects/${projectCode}`,
      title: project?.name ?? "",
      subtitle: isZh ? "主体管理" : "Subjects",
    });
    return () => resetHeader();
  }, [isZh, project?.name, projectCode, resetHeader, setHeader]);

  const handleCreate = useCallback(async (generatedImageUrl?: string | null) => {
    if (!project) return;
    if (!subjectForm.name.trim()) return;
    setSubmitting(true);
    try {
      await createSubject({
        ...subjectForm,
        name: subjectForm.name.trim(),
        alias: subjectForm.alias.trim(),
        description: subjectForm.description.trim(),
        prompt: subjectForm.prompt.trim(),
        remarks: subjectForm.remarks.trim(),
        image_url: generatedImageUrl ?? undefined,
        project_id: project.id,
      });
      setModalState({ open: false });
      setSubjectForm(EMPTY_FORM);
      await reloadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "创建主体失败"
            : "Failed to create subject",
      );
    } finally {
      setSubmitting(false);
    }
  }, [isZh, project, reloadData, subjectForm]);

  const handleCreateVariant = useCallback(async () => {
    if (!modalState.open || modalState.mode !== "create-variant") {
      return;
    }
    if (!variantForm.name.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      await createSubjectVariant(modalState.subject.id, {
        name: variantForm.name.trim(),
        description: variantForm.description.trim(),
        variant_type: variantForm.variant_type.trim() || "default",
      });
      setModalState({ open: false });
      setVariantForm(EMPTY_VARIANT_FORM);
      await reloadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "更新主体失败"
            : "Failed to update subject",
      );
    } finally {
      setSubmitting(false);
    }
  }, [isZh, modalState, reloadData, variantForm]);

  const handleUpdateSubject = useCallback(async (generatedImageUrl?: string | null) => {
    if (!modalState.open || modalState.mode !== "edit-subject") {
      return;
    }
    if (!subjectForm.name.trim()) return;
    setSubmitting(true);
    try {
      await updateSubject(modalState.subject.id, {
        ...subjectForm,
        name: subjectForm.name.trim(),
        alias: subjectForm.alias.trim(),
        description: subjectForm.description.trim(),
        prompt: subjectForm.prompt.trim(),
        remarks: subjectForm.remarks.trim(),
        image_url: generatedImageUrl ?? undefined,
      });
      setModalState({ open: false });
      setSubjectForm(EMPTY_FORM);
      await reloadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "更新主体失败"
            : "Failed to update subject",
      );
    } finally {
      setSubmitting(false);
    }
  }, [isZh, modalState, reloadData, subjectForm]);

  const handleUpdateVariant = useCallback(async () => {
    if (!modalState.open || modalState.mode !== "edit-variant") {
      return;
    }
    if (!variantForm.name.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      await updateSubjectVariant(modalState.variant.id, {
        name: variantForm.name.trim(),
        description: variantForm.description.trim(),
        variant_type: variantForm.variant_type.trim() || "default",
      });
      setModalState({ open: false });
      setVariantForm(EMPTY_VARIANT_FORM);
      await reloadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? "更新变体失败"
            : "Failed to update variant",
      );
    } finally {
      setSubmitting(false);
    }
  }, [isZh, modalState, reloadData, variantForm]);

  const handleDelete = useCallback(
    async (payload: { subject: SubjectItem; variant?: SubjectVariantItem | null }) => {
      const deletingVariant = payload.variant ?? null;
      const targetName = deletingVariant ? deletingVariant.name : payload.subject.name;
      const confirmed = window.confirm(
        isZh ? `确定删除「${targetName}」吗？` : `Delete "${targetName}"?`,
      );
      if (!confirmed) return;
      const key = deletingVariant
        ? `variant-${deletingVariant.id}`
        : `subject-${payload.subject.id}`;
      setDeletingKey(key);
      try {
        if (deletingVariant) {
          await deleteSubjectVariant(deletingVariant.id);
        } else {
          await deleteSubject(payload.subject.id);
        }
        await reloadData();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : isZh
              ? "删除主体失败"
              : "Failed to delete subject",
        );
      } finally {
        setDeletingKey(null);
      }
    },
    [isZh, reloadData],
  );

  const handleUpload = useCallback(
    async (subject: SubjectItem, file: File) => {
      setUploadingId(subject.id);
      try {
        await uploadSubjectImage(projectCode, subject.id, file);
        await reloadData();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : isZh
              ? "上传图片失败"
              : "Failed to upload image",
        );
      } finally {
        setUploadingId(null);
      }
    },
    [isZh, projectCode, reloadData],
  );

  const handleApplyCreationImage = useCallback(
    async (imageUrl: string, target: SubjectCreationTarget) => {
      if (target.variant) {
        await updateSubjectVariant(target.variant.id, { image_url: imageUrl });
      } else {
        await updateSubject(target.subject.id, { image_url: imageUrl });
      }
      await reloadData();
    },
    [reloadData],
  );

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-neutral-600" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={isZh ? "搜索名称/描述/提示词" : "Search"}
            className="w-full rounded border border-neutral-700 bg-neutral-900 py-2 pr-3 pl-9 text-sm text-neutral-200 outline-none focus:border-orange-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value as "" | SubjectCategory)}
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-orange-500"
        >
          <option value="">{isZh ? "全部类型" : "All Types"}</option>
          <option value="character">{isZh ? "角色" : "Character"}</option>
          <option value="scene">{isZh ? "场景" : "Scene"}</option>
          <option value="prop">{isZh ? "道具" : "Prop"}</option>
        </select>
        <button
          onClick={() => {
            setSubjectForm(EMPTY_FORM);
            setModalState({ open: true, mode: "create-subject" });
          }}
          className="ml-auto inline-flex items-center gap-2 rounded bg-orange-600 px-3 py-2 text-sm text-white hover:bg-orange-700"
        >
          <Plus size={14} />
          {isZh ? "添加主体" : "Add Subject"}
        </button>
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
      ) : filteredSubjects.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-neutral-500">
          <ImageIcon size={30} className="opacity-60" />
          <p className="text-sm">{isZh ? "暂无主体数据" : "No subjects"}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#0f0f0f]">
              <tr className="border-b border-neutral-800 text-left text-xs text-neutral-400">
                <th className="px-3 py-2">{isZh ? "图片 / 变体" : "Image / Variants"}</th>
                <th className="px-3 py-2">{isZh ? "类型" : "Type"}</th>
                <th className="px-3 py-2">{isZh ? "名称" : "Name"}</th>
                <th className="px-3 py-2">{isZh ? "别名" : "Alias"}</th>
                <th className="px-3 py-2">{isZh ? "描述/提示词" : "Description/Prompt"}</th>
                <th className="px-3 py-2">{isZh ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubjects.map((item) => {
                const variants = subjectVariantMap[item.id] ?? [];
                const selectedKey = selectedTabBySubject[item.id] ?? `subject-${item.id}`;
                const selectedVariant =
                  variants.find((variant) => `variant-${variant.id}` === selectedKey) ?? null;
                const selectedName = selectedVariant ? selectedVariant.name : item.name;
                const subjectImageUrl = resolveAssetUrl(item.image_url);
                const brief = selectedVariant?.description ?? item.prompt ?? item.description ?? "-";
                const deletingThisKey = selectedVariant
                  ? `variant-${selectedVariant.id}`
                  : `subject-${item.id}`;
                const creatingThisKey = selectedVariant
                  ? `variant-${selectedVariant.id}`
                  : `subject-${item.id}`;
                return (
                  <tr key={item.id} className="border-b border-neutral-900 align-top">
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() =>
                            setSelectedTabBySubject((prev) => ({
                              ...prev,
                              [item.id]: `subject-${item.id}`,
                            }))
                          }
                          className={`relative h-16 w-16 overflow-hidden rounded border bg-neutral-900 ${
                            selectedVariant
                              ? "border-neutral-800 hover:border-neutral-600"
                              : "border-orange-500/70"
                          }`}
                          title={isZh ? "本体" : "Base"}
                        >
                          {subjectImageUrl ? (
                            <img src={subjectImageUrl} alt={item.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-neutral-700">
                              <ImageIcon size={16} />
                            </div>
                          )}
                        </button>
                        <div className="grid min-w-[72px] grid-cols-2 gap-1">
                          {variants.map((variant) => {
                            const active = selectedVariant?.id === variant.id;
                            const variantImageUrl = resolveAssetUrl(variant.image_url);
                            return (
                              <button
                                key={variant.id}
                                onClick={() =>
                                  setSelectedTabBySubject((prev) => ({
                                    ...prev,
                                    [item.id]: `variant-${variant.id}`,
                                  }))
                                }
                                className={`relative h-8 w-8 overflow-hidden rounded border bg-neutral-900 ${
                                  active
                                    ? "border-orange-500/70"
                                    : "border-neutral-700 hover:border-neutral-500"
                                }`}
                                title={variant.name}
                              >
                                {variantImageUrl ? (
                                  <img
                                    src={variantImageUrl}
                                    alt={variant.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-neutral-600">
                                    <ImageIcon size={12} />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => {
                              setVariantForm({
                                ...EMPTY_VARIANT_FORM,
                                name: `${item.name} ${isZh ? "变体" : "Variant"}`,
                              });
                              setModalState({
                                open: true,
                                mode: "create-variant",
                                subject: item,
                              });
                            }}
                            className="h-8 w-8 rounded border border-dashed border-neutral-700 bg-neutral-900 text-[12px] text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
                            title={isZh ? "新增变体" : "Add Variant"}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-neutral-300">{categoryLabel(item.category, isZh)}</td>
                    <td className="px-3 py-2 text-neutral-200">{selectedName}</td>
                    <td className="px-3 py-2 text-neutral-500">{selectedVariant ? "-" : (item.alias ?? "-")}</td>
                    <td className="max-w-lg px-3 py-2 text-neutral-400">
                      <p className="line-clamp-3" title={brief}>
                        {brief}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setCreationState({
                              open: true,
                              target: {
                                subject: item,
                                variant: selectedVariant,
                              },
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {creationState.open &&
                          creatingThisKey ===
                            (creationState.target.variant
                              ? `variant-${creationState.target.variant.id}`
                              : `subject-${creationState.target.subject.id}`) ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Wand2 size={12} />
                          )}
                          {isZh ? "创作" : "Create"}
                        </button>
                        <button
                          onClick={() => fileInputRefs.current[item.id]?.click()}
                          disabled={Boolean(selectedVariant)}
                          className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {uploadingId === item.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Upload size={12} />
                          )}
                          {isZh ? "上传" : "Upload"}
                        </button>
                        <button
                          onClick={() => {
                            if (selectedVariant) {
                              setVariantForm({
                                name: selectedVariant.name,
                                description: selectedVariant.description ?? "",
                                variant_type: selectedVariant.variant_type ?? "default",
                              });
                              setModalState({
                                open: true,
                                mode: "edit-variant",
                                subject: item,
                                variant: selectedVariant,
                              });
                            } else {
                              setSubjectForm({
                                name: item.name ?? "",
                                category: item.category,
                                alias: item.alias ?? "",
                                description: item.description ?? "",
                                prompt: item.prompt ?? "",
                                remarks: item.remarks ?? "",
                              });
                              setModalState({
                                open: true,
                                mode: "edit-subject",
                                subject: item,
                              });
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-2 py-1 text-xs text-blue-300 hover:bg-blue-500/30"
                        >
                          <Edit2 size={12} />
                          {isZh ? "编辑" : "Edit"}
                        </button>
                        <button
                          onClick={() => {
                            void handleDelete({
                              subject: item,
                              variant: selectedVariant,
                            });
                          }}
                          disabled={deletingKey === deletingThisKey}
                          className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingKey === deletingThisKey ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                          {isZh ? "删除" : "Delete"}
                        </button>
                      </div>
                      <input
                        ref={(element) => {
                          fileInputRefs.current[item.id] = element;
                        }}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void handleUpload(item, file);
                          }
                          event.target.value = "";
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {creationState.open ? (
        <SubjectCreationModal
          isZh={isZh}
          projectCode={projectCode}
          target={creationState.target}
          projectStyleTemplate={project?.style_template ?? project?.style ?? null}
          onClose={() => {
            setCreationState({ open: false });
          }}
          onApply={handleApplyCreationImage}
        />
      ) : null}
      {modalState.open ? (
        <AssetEditorModal
          title={
            modalState.mode === "create-subject"
              ? isZh
                ? "新建主体"
                : "Create Subject"
              : modalState.mode === "edit-subject"
                ? isZh
                  ? "编辑主体"
                  : "Edit Subject"
                : modalState.mode === "create-variant"
                  ? isZh
                    ? "新建变体"
                    : "Create Variant"
                  : isZh
                    ? "编辑变体"
                    : "Edit Variant"
          }
          confirmLabel={
            modalState.mode === "create-subject" || modalState.mode === "create-variant"
              ? isZh
                ? "创建"
                : "Create"
              : isZh
                ? "保存"
                : "Save"
          }
          isZh={isZh}
          projectCode={projectCode}
          subjectId={
            modalState.open && modalState.mode === "edit-subject"
              ? modalState.subject.id
              : null
          }
          previewImageUrl={
            modalState.open && modalState.mode === "edit-subject"
              ? modalState.subject.image_url ?? null
              : modalState.open && modalState.mode === "edit-variant"
                ? modalState.variant.image_url ?? null
                : null
          }
          imageUploadEnabled={modalState.open && modalState.mode === "edit-subject"}
          onUploadImage={async (file) => {
            if (!modalState.open || modalState.mode !== "edit-subject") {
              return;
            }
            await handleUpload(modalState.subject, file);
          }}
          loading={submitting}
          subjectMode={
            modalState.mode === "create-subject" || modalState.mode === "edit-subject"
          }
          subjectForm={subjectForm}
          variantForm={variantForm}
          onChangeSubjectForm={setSubjectForm}
          onChangeVariantForm={setVariantForm}
          onClose={() => {
            setModalState({ open: false });
            setSubjectForm(EMPTY_FORM);
            setVariantForm(EMPTY_VARIANT_FORM);
          }}
          onConfirm={(generatedImageUrl) => {
            if (modalState.mode === "create-subject") {
              void handleCreate(generatedImageUrl);
              return;
            }
            if (modalState.mode === "edit-subject") {
              void handleUpdateSubject(generatedImageUrl);
              return;
            }
            if (modalState.mode === "create-variant") {
              void handleCreateVariant();
              return;
            }
            void handleUpdateVariant();
          }}
        />
      ) : null}
    </div>
  );
}
