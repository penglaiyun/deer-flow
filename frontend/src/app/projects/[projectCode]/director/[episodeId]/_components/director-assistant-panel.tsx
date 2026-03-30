"use client";

import type { Message } from "@langchain/langgraph-sdk";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { type PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { PromptInputProvider } from "@/components/ai-elements/prompt-input";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  ArtifactFileDetail,
  ArtifactsProvider,
  useArtifacts,
} from "@/components/workspace/artifacts";
import { InputBox } from "@/components/workspace/input-box";
import { MessageList } from "@/components/workspace/messages";
import { ThreadContext } from "@/components/workspace/messages/context";
import {
  listChatThreadBindings,
  upsertChatThreadBinding,
} from "@/core/chat-thread-bindings";
import { getBusinessAPIBaseURL } from "@/core/config";
import type { EpisodeListItem, ProjectDetailItem } from "@/core/projects";
import { useLocalSettings } from "@/core/settings";
import { SubtasksProvider } from "@/core/tasks/context";
import {
  type ToolEndEvent,
  type StreamDebugEvent,
  useThreadStream,
} from "@/core/threads/hooks";

import { useDirectorEventBus } from "./director-event-bus";

type ThreadBinding = {
  threadId: string;
  lastActiveAt: string;
};

type AssistantViewMode = "original" | "sequential" | "checkpoint";

type DirectorSubjectCategory = "character" | "scene" | "prop";

type DirectorContextSubject = {
  id: number;
  name: string;
  category: string;
  alias?: string | null;
  description?: string | null;
};

type DirectorQueuedAssistantAction =
  | {
      id: number;
      actionType: "generate_subject_design_image";
      payload: {
        projectCode: string;
        subjectId: number;
        category: "character" | "scene" | "prop";
        name: string;
        description: string;
        aspectRatio: string;
      };
    }
  | {
      id: number;
      actionType: "generate_storyboard_image";
      payload: {
        projectCode: string;
        storyboardId: number;
        narrative: string;
        aspectRatio: string;
      };
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

async function loadProjectSubjects(
  projectCode: string,
  category: DirectorSubjectCategory,
): Promise<DirectorContextSubject[]> {
  const response = await fetch(
    `${getBusinessAPIBaseURL()}/api/v1/projects/${projectCode}/subjects?category=${category}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );
  const data = await readJSONOrThrow<{ data?: DirectorContextSubject[] }>(response);
  return Array.isArray(data.data) ? data.data : [];
}

function truncateText(value: string | null | undefined, maxLength: number) {
  const text = (value ?? "").trim();
  if (!text) {
    return undefined;
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function selectRelevantSubjects(
  subjects: DirectorContextSubject[],
  targetIds?: number[] | null,
) {
  const matched = Array.isArray(targetIds) && targetIds.length > 0
    ? subjects.filter((item) => targetIds.includes(item.id))
    : subjects;
  return matched.slice(0, 6).map((item) => ({
    id: item.id,
    name: item.name,
    alias: item.alias ?? undefined,
    category: item.category,
    description: truncateText(item.description, 60),
  }));
}

function serializeQueuedAssistantAction(
  action: DirectorQueuedAssistantAction,
  isZh: boolean,
  activeTab: string,
): string {
  const payload =
    action.actionType === "generate_subject_design_image"
      ? {
          action_type: action.actionType,
          title: isZh ? "生成主体设定图" : "Generate subject design image",
          workflow: {
            source_tab: activeTab,
            target_stage_id: "design_images",
            expected_artifact_type: "file",
            expected_review: false,
          },
          tool_hints: ["generate_subject_image"],
          references: [
            {
              id: `subject-${action.payload.subjectId}`,
              type: "subject",
              target_id: String(action.payload.subjectId),
              title: action.payload.name,
              excerpt: action.payload.description,
              meta: {
                category: action.payload.category,
                project_code: action.payload.projectCode,
              },
            },
          ],
          payload: {
            project_code: action.payload.projectCode,
            subject_id: action.payload.subjectId,
            category: action.payload.category,
            description: action.payload.description,
            aspect_ratio: action.payload.aspectRatio,
          },
        }
      : {
          action_type: action.actionType,
          title: isZh ? "生成分镜图" : "Generate storyboard image",
          workflow: {
            source_tab: activeTab,
            target_stage_id: "storyboard_images",
            expected_artifact_type: "file",
            expected_review: false,
          },
          tool_hints: ["generate_storyboard_image"],
          references: [
            {
              id: `storyboard-${action.payload.storyboardId}`,
              type: "storyboard",
              target_id: String(action.payload.storyboardId),
              title: `${isZh ? "分镜" : "Storyboard"} #${action.payload.storyboardId}`,
              excerpt: action.payload.narrative,
              meta: {
                project_code: action.payload.projectCode,
              },
            },
          ],
          payload: {
            project_code: action.payload.projectCode,
            storyboard_id: action.payload.storyboardId,
            content: action.payload.narrative,
            aspect_ratio: action.payload.aspectRatio,
          },
        };

  return [
    isZh
      ? "请执行以下结构化阶段动作，优先使用对应工具，并把结果写回 workflow 记录。"
      : "Execute the following structured stage action, use the matching tools first, and write results back to workflow records.",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
  ].join("\n");
}

function DirectorArtifactOverlay({
  chatThreadId,
  isZh,
}: {
  chatThreadId: string;
  isZh: boolean;
}) {
  const {
    open: artifactsOpen,
    selectedArtifact,
    setOpen: setArtifactsOpen,
    deselect: deselectArtifact,
  } = useArtifacts();

  if (!artifactsOpen || !selectedArtifact || !chatThreadId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6 backdrop-blur-sm">
      <div className="relative h-[85vh] w-[min(1200px,95vw)] overflow-hidden rounded-xl border border-neutral-700 bg-[#111]">
        <button
          onClick={() => {
            setArtifactsOpen(false);
            deselectArtifact();
          }}
          className="absolute top-3 right-3 z-10 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
        >
          {isZh ? "关闭" : "Close"}
        </button>
        <ArtifactFileDetail
          className="size-full"
          filepath={selectedArtifact}
          threadId={chatThreadId}
        />
      </div>
    </div>
  );
}

function randomThreadId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseJSONValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function pickString(output: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = output[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function normalizeToolOutput(data: unknown): Record<string, unknown> | null {
  const obj = toObject(data);
  if (!obj) {
    if (typeof data === "string") {
      return toObject(parseJSONValue(data));
    }
    return null;
  }
  const parsedOutput =
    typeof obj.output === "string"
      ? toObject(parseJSONValue(obj.output))
      : toObject(obj.output);

  const contentText = extractToolContentText(
    obj.content ??
      parsedOutput?.content ??
      toObject(obj.data)?.content ??
      toObject(parsedOutput?.data)?.content,
  );
  const parsedContent = contentText ? parseToolContentObject(contentText) : null;

  if (parsedOutput || parsedContent) {
    return {
      ...obj,
      ...(parsedOutput ?? {}),
      ...(parsedContent ?? {}),
    };
  }

  if (contentText) {
    return {
      ...obj,
      content_text: contentText,
    };
  }
  return obj;
}

function parseToolContentObject(content: string): Record<string, unknown> | null {
  const raw = content.trim();
  if (!raw) {
    return null;
  }
  const tryParse = (text: string) => {
    try {
      const value = JSON.parse(text);
      return toObject(value);
    } catch {
      return null;
    }
  };
  const direct = tryParse(raw);
  if (direct) {
    return direct;
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(raw)?.[1]?.trim();
  if (fenced) {
    const fencedParsed = tryParse(fenced);
    if (fencedParsed) {
      return fencedParsed;
    }
  }
  const firstObjectCandidate = (() => {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return raw.slice(start, end + 1);
    }
    return "";
  })();
  if (firstObjectCandidate) {
    const objectParsed = tryParse(firstObjectCandidate);
    if (objectParsed) {
      return objectParsed;
    }
  }
  const loose = tryParse(
    (fenced ?? firstObjectCandidate ?? raw)
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/\bNone\b/g, "null")
      .replace(/'/g, "\""),
  );
  if (loose) {
    return loose;
  }
  const extracted: Record<string, unknown> = {};
  const findString = (key: string) => {
    const matched = new RegExp(`["']?${key}["']?\\s*[:=]\\s*['"]([^'"]+)['"]`, "i").exec(raw);
    return matched?.[1];
  };
  const findNumber = (key: string) => {
    const matched = new RegExp(`["']?${key}["']?\\s*[:=]\\s*['"]?(\\d+)['"]?`, "i").exec(raw);
    if (!matched?.[1]) {
      return undefined;
    }
    const parsed = Number(matched[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const stringKeys = ["task_id", "status", "image_url", "result_url", "source_type", "error", "error_message"];
  for (const key of stringKeys) {
    const value = findString(key);
    if (value) {
      extracted[key] = value;
    }
  }
  const numberKeys = ["subject_id", "variant_id", "source_id"];
  for (const key of numberKeys) {
    const value = findNumber(key);
    if (value !== undefined) {
      extracted[key] = value;
    }
  }
  return Object.keys(extracted).length > 0 ? extracted : null;
}

function extractToolContentText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (typeof item !== "object" || item === null) {
          return "";
        }
        const text = Reflect.get(item, "text");
        if (typeof text === "string") {
          return text;
        }
        const innerContent = Reflect.get(item, "content");
        if (typeof innerContent === "string") {
          return innerContent;
        }
        if (Array.isArray(innerContent)) {
          return extractToolContentText(innerContent);
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  if (typeof content === "object" && content !== null) {
    const text = Reflect.get(content, "text");
    if (typeof text === "string") {
      return text;
    }
    const innerContent = Reflect.get(content, "content");
    if (typeof innerContent === "string") {
      return innerContent;
    }
    if (Array.isArray(innerContent)) {
      return extractToolContentText(innerContent);
    }
  }
  return "";
}

function resolveToolName(name: string): string {
  return (name || "").trim();
}

function isAssetImageTool(name: string): boolean {
  const tool = resolveToolName(name);
  return (
    tool.includes("generate_subject_image") ||
    tool.includes("generate_storyboard_image") ||
    tool.includes("generate_image_by_name")
  );
}

export function DirectorAssistantPanel({
  projectCode,
  episodeId,
  activeTab,
  isZh,
  queuedAction,
  project,
  episode,
}: {
  projectCode: string;
  episodeId: number;
  activeTab: string;
  isZh: boolean;
  queuedAction: DirectorQueuedAssistantAction | null;
  project: ProjectDetailItem | null;
  episode: EpisodeListItem | null;
}) {
  const { publish } = useDirectorEventBus();
  const [settings] = useLocalSettings();
  const [chatThreadId, setChatThreadId] = useState("");
  const [isNewThread, setIsNewThread] = useState(true);
  const [threadBindings, setThreadBindings] = useState<ThreadBinding[]>([]);
  const [checkpointMessages, setCheckpointMessages] = useState<Message[]>([]);
  const [viewMode, setViewMode] = useState<AssistantViewMode>("original");
  const [projectSubjects, setProjectSubjects] = useState<{
    characters: DirectorContextSubject[];
    scenes: DirectorContextSubject[];
    props: DirectorContextSubject[];
  }>({
    characters: [],
    scenes: [],
    props: [],
  });
  const lastQueuedPromptIdRef = useRef<number | null>(null);
  const pendingAssetContextRef = useRef<Array<{
    subjectId?: number;
    variantId?: number;
    storyboardId?: number;
    toolName: string;
    runId?: string;
    ts: number;
  }>>([]);
  const [directorInputContext, setDirectorInputContext] =
    useState<typeof settings.context>(() => ({
      ...settings.context,
      mode: settings.context.mode ?? "ultra",
      reasoning_effort: settings.context.reasoning_effort ?? "high",
    }));

  useEffect(() => {
    if (!projectCode) {
      setProjectSubjects({ characters: [], scenes: [], props: [] });
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const [characters, scenes, props] = await Promise.all([
          loadProjectSubjects(projectCode, "character").catch(() => []),
          loadProjectSubjects(projectCode, "scene").catch(() => []),
          loadProjectSubjects(projectCode, "prop").catch(() => []),
        ]);
        if (!cancelled) {
          setProjectSubjects({ characters, scenes, props });
        }
      } catch {
        if (!cancelled) {
          setProjectSubjects({ characters: [], scenes: [], props: [] });
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [projectCode]);

  const projectSettingsContext = useMemo(
    () => ({
      project_code: project?.code ?? projectCode,
      project_name: project?.name ?? undefined,
      style: project?.style ?? undefined,
      project_type: project?.project_type ?? undefined,
      video_resolution: project?.video_resolution ?? undefined,
      aspect_ratio: project?.aspect_ratio ?? undefined,
    }),
    [project, projectCode],
  );

  const projectSubjectsContext = useMemo(
    () => ({
      characters: selectRelevantSubjects(projectSubjects.characters, episode?.character_ids),
      scenes: selectRelevantSubjects(projectSubjects.scenes, episode?.scene_ids),
      props: selectRelevantSubjects(projectSubjects.props, episode?.prop_ids),
    }),
    [episode?.character_ids, episode?.prop_ids, episode?.scene_ids, projectSubjects],
  );

  const directorContext = useMemo(
    () => ({
      ...directorInputContext,
      project_code: projectCode,
      episode_id: episodeId,
      scene: "director",
      active_tab: activeTab,
      project_settings: projectSettingsContext,
      project_subjects: projectSubjectsContext,
    }),
    [
      activeTab,
      directorInputContext,
      episodeId,
      projectCode,
      projectSettingsContext,
      projectSubjectsContext,
    ],
  );
  const scopeKey = useMemo(() => {
    if (!projectCode || !episodeId || !Number.isFinite(episodeId)) {
      return "";
    }
    return `project:${projectCode}:episode:${episodeId}:block:director`;
  }, [episodeId, projectCode]);

  useEffect(() => {
    if (!scopeKey) {
      return;
    }
    let cancelled = false;

    const run = async () => {
      try {
        const rows = await listChatThreadBindings(scopeKey);
        if (cancelled) return;
        if (rows.length > 0) {
          const mapped = rows.map((item) => ({
            threadId: item.thread_id,
            lastActiveAt: item.last_active_at ?? item.updated_at ?? "",
          }));
          setThreadBindings(mapped);
          setChatThreadId(mapped[0]?.threadId ?? "");
          setIsNewThread(false);
          return;
        }
      } catch {
      }

      if (!cancelled) {
        const initialId = randomThreadId();
        setChatThreadId(initialId);
        setIsNewThread(true);
        setThreadBindings([]);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [scopeKey]);

  const upsertBinding = useCallback(
    async (id: string) => {
      if (!scopeKey) {
        return;
      }
      const now = new Date().toISOString();
      const next = (() => {
        const existing = threadBindings.filter((item) => item.threadId !== id);
        return [{ threadId: id, lastActiveAt: now }, ...existing].slice(0, 50);
      })();
      setThreadBindings(next);
      try {
        await upsertChatThreadBinding({
          scope_key: scopeKey,
          thread_id: id,
          set_default: true,
        });
      } catch {
      }
    },
    [scopeKey, threadBindings],
  );

  const handleStreamEvent = useCallback((event: StreamDebugEvent) => {
    if (event.source === "langchain") {
      const data = toObject(event.data);
      const eventName = typeof data?.event === "string" ? data.event : "";
      const toolName = typeof data?.name === "string" ? data.name : "";
      if (eventName === "on_tool_start" && isAssetImageTool(toolName)) {
        const input = toObject(data?.data) ?? toObject(data?.input);
        const runId =
          pickString(data ?? {}, ["run_id", "id"]) ??
          pickString(input ?? {}, ["run_id", "id"]);
        const subjectId = toNumber(input?.subject_id);
        const variantId = toNumber(input?.variant_id);
        const storyboardId = toNumber(input?.storyboard_id);
        pendingAssetContextRef.current.push({
          subjectId,
          variantId,
          storyboardId,
          toolName,
          runId,
          ts: Date.now(),
        });
        if (pendingAssetContextRef.current.length > 20) {
          pendingAssetContextRef.current = pendingAssetContextRef.current.slice(-20);
        }
        publish({
          name: "asset.image.generate",
          method: "started",
          source: "assistant_stream",
          projectCode,
          episodeId,
          payload: {
            taskId: "",
            assetType: storyboardId ? "shot" : (variantId ? "variant" : "subject"),
            subjectId,
            variantId,
            storyboardId,
            status: "pending",
            metadata: data ?? undefined,
          },
        });
      }
    }

    const serialized = JSON.stringify(event.data);
    if (!serialized) {
      return;
    }
    if (!serialized.toLowerCase().includes("checkpoint")) {
      return;
    }
    setCheckpointMessages((prev) => {
      const nextMessage: Message = {
        type: "ai",
        id: `checkpoint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        content: `checkpoint/${event.source}\n\n\`\`\`json\n${JSON.stringify(event.data, null, 2)}\n\`\`\``,
      };
      return [...prev, nextMessage].slice(-200);
    });
  }, [episodeId, projectCode, publish]);

  const handleToolEnd = useCallback(
    (event: ToolEndEvent) => {
      const toolName = event.name || "";
      if (!isAssetImageTool(toolName)) {
        console.log("[DirectorAssistant] skip tool end", toolName);
        return;
      }
      const output = normalizeToolOutput(event.data);
      if (!output) {
        console.log("[DirectorAssistant] tool end output parse failed", toolName, event.data);
        return;
      }
      const task = toObject(output.task);
      const result = toObject(output.result);
      const taskId =
        pickString(output, ["task_id", "taskId"]) ??
        pickString(task ?? {}, ["task_id", "taskId", "id"]) ??
        pickString(result ?? {}, ["task_id", "taskId"]) ??
        "";
      const statusRaw =
        (typeof output.status === "string" ? output.status : undefined) ??
        (typeof task?.status === "string" ? String(task.status) : undefined) ??
        (typeof result?.status === "string" ? String(result.status) : undefined) ??
        (typeof output.task_status === "string" ? output.task_status : undefined) ??
        "completed";
      const status = statusRaw.toLowerCase();
      const sourceType = typeof output.source_type === "string" ? output.source_type : "";
      const sourceId = toNumber(output.source_id);
      const outputRunId =
        pickString(output, ["run_id", "id"]) ??
        pickString(task ?? {}, ["run_id", "id"]);
      const queue = pendingAssetContextRef.current;
      let pendingIndex = -1;
      if (outputRunId) {
        pendingIndex = queue.findIndex((item) => item.runId === outputRunId);
      }
      if (pendingIndex < 0) {
        pendingIndex = queue.findIndex((item) => resolveToolName(item.toolName) === resolveToolName(toolName));
      }
      const pendingCtx = pendingIndex >= 0 ? queue[pendingIndex] : undefined;
      const subjectId =
        toNumber(output.subject_id) ??
        toNumber(toObject(output.task)?.subject_id) ??
        toNumber(toObject(output.result)?.subject_id) ??
        (sourceType === "subject" ? sourceId : undefined);
      const variantId =
        toNumber(output.variant_id) ??
        toNumber(toObject(output.task)?.variant_id) ??
        toNumber(toObject(output.result)?.variant_id) ??
        (sourceType === "variant" || sourceType === "subject_variant" ? sourceId : undefined);
      const finalSubjectId = subjectId ?? pendingCtx?.subjectId;
      const finalVariantId = variantId ?? pendingCtx?.variantId;
      const storyboardId =
        toNumber(output.storyboard_id) ??
        toNumber(task?.storyboard_id) ??
        toNumber(result?.storyboard_id) ??
        toNumber(toObject(output.metadata)?.storyboard_id) ??
        pendingCtx?.storyboardId;
      const imageUrl =
        (typeof output.image_url === "string" && output.image_url) ||
        (typeof output.result_url === "string" && output.result_url) ||
        (typeof output.local_path === "string" && output.local_path) ||
        (typeof toObject(output.task)?.result_url === "string" &&
          String(toObject(output.task)?.result_url)) ||
        (typeof toObject(output.task)?.local_path === "string" &&
          String(toObject(output.task)?.local_path)) ||
        (typeof toObject(toObject(output.task)?.result)?.image_url === "string" &&
          String(toObject(toObject(output.task)?.result)?.image_url)) ||
        (typeof toObject(toObject(output.task)?.result)?.url === "string" &&
          String(toObject(toObject(output.task)?.result)?.url)) ||
        undefined;
      const error =
        (typeof output.error === "string" && output.error) ||
        (typeof output.error_message === "string" && output.error_message) ||
        undefined;
      const normalizedStatus = (
        ["pending", "processing", "completed", "failed", "cancelled", "timeout"].includes(status)
          ? status
          : "completed"
      ) as "pending" | "processing" | "completed" | "failed" | "cancelled" | "timeout";
      const safeTaskId =
        taskId ||
        `synthetic-${projectCode}-${episodeId}-${Date.now()}`;
      const method =
        normalizedStatus === "completed"
          ? "completed"
          : normalizedStatus === "pending" || normalizedStatus === "processing"
            ? "progress"
            : "failed";
      publish({
        name: "asset.image.generate",
        method,
        source: "assistant_stream",
        projectCode,
        episodeId,
        payload: {
          taskId: safeTaskId,
          assetType: storyboardId ? "shot" : (finalVariantId ? "variant" : "subject"),
          subjectId: finalSubjectId,
          variantId: finalVariantId,
          storyboardId,
          imageUrl,
          status: normalizedStatus,
          error,
          metadata: output,
        },
      });
      if (pendingIndex >= 0) {
        pendingAssetContextRef.current.splice(pendingIndex, 1);
      }
      if (!taskId) {
        console.log("[DirectorAssistant] tool end task_id missing, use synthetic id", { toolName, output });
      }
      console.log("[DirectorAssistant] publish", method, {
        toolName,
        taskId: safeTaskId,
        status,
        subjectId: finalSubjectId,
        variantId: finalVariantId,
        imageUrl,
        parsedKeys: Object.keys(output),
        pendingQueueSize: pendingAssetContextRef.current.length,
      });
    },
    [episodeId, projectCode, publish],
  );

  const [thread, sendMessage, isUploading] = useThreadStream({
    assistantId: "producer_lead_agent",
    threadId: isNewThread ? undefined : chatThreadId,
    context: directorContext,
    onStart: (startedThreadId) => {
      setCheckpointMessages([]);
      setChatThreadId(startedThreadId);
      setIsNewThread(false);
      void upsertBinding(startedThreadId);
    },
    onStreamEvent: handleStreamEvent,
    onToolEnd: handleToolEnd,
  });

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (!chatThreadId) {
        return;
      }
      try {
        void upsertBinding(chatThreadId);
        await sendMessage(chatThreadId, message, {
          project_code: projectCode,
          episode_id: episodeId,
          scene: "director",
          active_tab: activeTab,
        });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "";
        const threadNotFound =
          messageText.includes("Thread with ID") &&
          messageText.includes("not found");
        if (!threadNotFound) {
          throw error;
        }
        setThreadBindings((prev) =>
          prev.filter((item) => item.threadId !== chatThreadId),
        );
        const nextId = randomThreadId();
        setIsNewThread(true);
        setChatThreadId(nextId);
        await sendMessage(nextId, message, {
          project_code: projectCode,
          episode_id: episodeId,
          scene: "director",
          active_tab: activeTab,
        });
      }
    },
    [activeTab, chatThreadId, episodeId, projectCode, sendMessage, upsertBinding],
  );

  const handleStop = useCallback(async () => {
    await thread.stop();
  }, [thread]);

  const handleSwitchThread = useCallback(
    (id: string) => {
      if (!id) return;
      setChatThreadId(id);
      setIsNewThread(false);
      void upsertBinding(id);
    },
    [upsertBinding],
  );

  const handleNewThread = useCallback(() => {
    const nextId = randomThreadId();
    setChatThreadId(nextId);
    setIsNewThread(true);
  }, []);

  useEffect(() => {
    if (!queuedAction || !chatThreadId || thread.isLoading) {
      return;
    }
    if (lastQueuedPromptIdRef.current === queuedAction.id) {
      return;
    }
    lastQueuedPromptIdRef.current = queuedAction.id;
    void handleSubmit({
      text: serializeQueuedAssistantAction(queuedAction, isZh, activeTab),
      files: [],
    });
  }, [activeTab, chatThreadId, handleSubmit, isZh, queuedAction, thread.isLoading]);

  return (
    <SidebarProvider defaultOpen={false} className="contents">
      <SubtasksProvider>
        <ArtifactsProvider>
          <PromptInputProvider>
            <ThreadContext.Provider value={{ thread, isMock: false }}>
              <div className="dark flex w-[600px] shrink-0 flex-col border-l border-neutral-800 bg-[#111]">
                <div className="border-b border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-300">
                  <div className="flex items-center gap-2">
                    <span className="flex-1">{isZh ? "对话助手" : "Assistant"}</span>
                    <div className="flex items-center overflow-hidden rounded border border-neutral-700 bg-neutral-900">
                      <button
                        onClick={() => setViewMode("original")}
                        className={`h-8 px-2 text-xs ${viewMode === "original" ? "bg-neutral-700 text-white" : "text-neutral-300 hover:bg-neutral-800"}`}
                      >
                        {isZh ? "原样式" : "Original"}
                      </button>
                      <button
                        onClick={() => setViewMode("sequential")}
                        className={`h-8 border-l border-neutral-700 px-2 text-xs ${viewMode === "sequential" ? "bg-neutral-700 text-white" : "text-neutral-300 hover:bg-neutral-800"}`}
                      >
                        {isZh ? "顺序流" : "Sequential"}
                      </button>
                      <button
                        onClick={() => setViewMode("checkpoint")}
                        className={`h-8 border-l border-neutral-700 px-2 text-xs ${viewMode === "checkpoint" ? "bg-neutral-700 text-white" : "text-neutral-300 hover:bg-neutral-800"}`}
                      >
                        Checkpoint
                      </button>
                    </div>
                    <select
                      value={chatThreadId}
                      onChange={(event) => handleSwitchThread(event.target.value)}
                      className="h-8 max-w-52 rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-200 outline-none"
                    >
                      {threadBindings.map((item, index) => (
                        <option key={item.threadId} value={item.threadId}>
                          {(isZh ? "对话" : "Thread") +
                            ` ${index + 1} · ` +
                            item.threadId.slice(-8)}
                        </option>
                      ))}
                      {chatThreadId &&
                        !threadBindings.some((item) => item.threadId === chatThreadId) && (
                          <option value={chatThreadId}>
                            {(isZh ? "新对话" : "New Thread") +
                              " · " +
                              chatThreadId.slice(-8)}
                          </option>
                        )}
                    </select>
                    <button
                      onClick={handleNewThread}
                      className="h-8 rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-200 hover:bg-neutral-800"
                    >
                      {isZh ? "新建" : "New"}
                    </button>
                  </div>
                </div>
                {chatThreadId ? (
                  <>
                    <div className="min-h-0 flex-1">
                      <MessageList
                        className="size-full"
                        threadId={chatThreadId}
                        thread={thread}
                        streamAsReceived={viewMode !== "original"}
                        sequentialMessageKinds={
                          viewMode === "sequential" ? "human_ai" : "all"
                        }
                        appendedMessages={
                          viewMode === "checkpoint" ? checkpointMessages : []
                        }
                        showOnlyAppendedMessages={viewMode === "checkpoint"}
                      />
                    </div>
                    <div className="p-4">
                      <InputBox
                        className="bg-background/5 w-full"
                        isNewThread={isNewThread}
                        hideThreadBottomExtras
                        threadId={chatThreadId}
                        status={
                          thread.error
                            ? "error"
                            : thread.isLoading
                              ? "streaming"
                              : "ready"
                        }
                        context={directorContext}
                        disabled={isUploading}
                        onContextChange={setDirectorInputContext}
                        onSubmit={handleSubmit}
                        onStop={handleStop}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
                    {isZh ? "初始化对话中..." : "Initializing chat..."}
                  </div>
                )}
              </div>
              <DirectorArtifactOverlay chatThreadId={chatThreadId} isZh={isZh} />
            </ThreadContext.Provider>
          </PromptInputProvider>
        </ArtifactsProvider>
      </SubtasksProvider>
    </SidebarProvider>
  );
}
