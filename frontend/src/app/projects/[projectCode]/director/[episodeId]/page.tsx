"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Clock,
  FileText,
  Lightbulb,
  LayoutGrid,
  Users,
} from "lucide-react";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useStudioHeader } from "@/components/studio/header-context";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownContent } from "@/components/workspace/messages/markdown-content";
import { useI18n } from "@/core/i18n/hooks";
import {
  loadEpisodeById,
  loadEpisodeScript,
  loadProjectByCode,
  updateEpisode,
  type EpisodeListItem,
  type ProjectDetailItem,
} from "@/core/projects";

import { DirectorAssistantPanel } from "./_components/director-assistant-panel";
import { DirectorCharacterPanel } from "./_components/director-character-panel";
import { DirectorEventBusProvider } from "./_components/director-event-bus";
import { DirectorStoryboardPanel } from "./_components/director-storyboard-panel";

type DirectorTab =
  | "script"
  | "director_analysis"
  | "characters"
  | "storyboard"
  | "timeline";

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

function isDirectorTab(value: string): value is DirectorTab {
  return (
    value === "script" ||
    value === "director_analysis" ||
    value === "characters" ||
    value === "storyboard" ||
    value === "timeline"
  );
}

function getDirectorTabStorageKey(projectCode: string, episodeId: number) {
  if (!projectCode || !Number.isFinite(episodeId) || episodeId <= 0) {
    return "";
  }
  return `director-active-tab:${projectCode}:${episodeId}`;
}

function readStoredDirectorTab(projectCode: string, episodeId: number): DirectorTab {
  if (typeof window === "undefined") {
    return "script";
  }
  const key = getDirectorTabStorageKey(projectCode, episodeId);
  if (!key) {
    return "script";
  }
  const saved = window.localStorage.getItem(key);
  return saved && isDirectorTab(saved) ? saved : "script";
}

export default function DirectorPage() {
  const params = useParams<{ projectCode: string; episodeId: string }>();
  const projectCode = params?.projectCode ?? "";
  const episodeId = Number(params?.episodeId ?? "");
  const { locale } = useI18n();
  const isZh = locale.startsWith("zh");

  const [project, setProject] = useState<ProjectDetailItem | null>(null);
  const [episode, setEpisode] = useState<EpisodeListItem | null>(null);
  const [scriptMarkdown, setScriptMarkdown] = useState("");
  const [directorAnalysisMarkdown, setDirectorAnalysisMarkdown] = useState("");
  const [scriptDraft, setScriptDraft] = useState("");
  const [directorAnalysisDraft, setDirectorAnalysisDraft] = useState("");
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [isEditingDirectorAnalysis, setIsEditingDirectorAnalysis] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [activeTab, setActiveTab] = useState<DirectorTab>(() =>
    readStoredDirectorTab(projectCode, episodeId),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [queuedAssistantAction, setQueuedAssistantAction] =
    useState<DirectorQueuedAssistantAction | null>(null);
  const [queryClient] = useState(() => new QueryClient());
  const { setHeader, resetHeader } = useStudioHeader();
  const directorTabStorageKey = useMemo(
    () => getDirectorTabStorageKey(projectCode, episodeId),
    [episodeId, projectCode],
  );
  const scriptDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scriptSaveSeqRef = useRef(0);
  const analysisSaveSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!projectCode || !Number.isFinite(episodeId) || episodeId <= 0) {
        setIsLoading(false);
        setErrorMessage(isZh ? "参数错误" : "Invalid params");
        return;
      }
      setIsLoading(true);
      setErrorMessage("");
      try {
        const [projectData, episodeData] = await Promise.all([
          loadProjectByCode(projectCode),
          loadEpisodeById(episodeId),
        ]);
        const scriptData = await loadEpisodeScript(episodeId).catch(() => null);
        const analysisContent =
          (
            episodeData as EpisodeListItem & {
              script_analysis?: string | null;
            }
          ).script_analysis ?? "";
        if (!cancelled) {
          setProject(projectData);
          setEpisode(episodeData);
          const scriptContent = scriptData?.content ?? "";
          setScriptMarkdown(scriptContent);
          setDirectorAnalysisMarkdown(analysisContent);
          setScriptDraft(scriptContent);
          setDirectorAnalysisDraft(analysisContent);
          setIsEditingScript(false);
          setIsEditingDirectorAnalysis(false);
          setSaveError("");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : isZh
                ? "加载制片页面失败"
                : "Failed to load director page",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [episodeId, isZh, projectCode]);

  useEffect(() => {
    setActiveTab(readStoredDirectorTab(projectCode, episodeId));
  }, [episodeId, projectCode]);

  useEffect(() => {
    if (!directorTabStorageKey || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(directorTabStorageKey, activeTab);
  }, [activeTab, directorTabStorageKey]);

  useEffect(() => {
    const handleReferenceNavigation = (
      event: Event,
    ) => {
      const detail = (event as CustomEvent<{
        referenceType?: string;
        sourceTab?: string;
      }>).detail;
      const sourceTab = detail?.sourceTab;
      if (sourceTab && isDirectorTab(sourceTab)) {
        setActiveTab(sourceTab);
        return;
      }
      const referenceType = detail?.referenceType;
      if (referenceType === "subject") {
        setActiveTab("characters");
        return;
      }
      if (referenceType === "storyboard" || referenceType === "shot") {
        setActiveTab("storyboard");
      }
    };
    window.addEventListener(
      "director:navigate-reference",
      handleReferenceNavigation as EventListener,
    );
    return () => {
      window.removeEventListener(
        "director:navigate-reference",
        handleReferenceNavigation as EventListener,
      );
    };
  }, []);

  const tabs = useMemo(
    () => [
      {
        key: "script" as const,
        label: isZh ? "剧本" : "Script",
        icon: FileText,
      },
      {
        key: "director_analysis" as const,
        label: isZh ? "导演分析" : "Director Analysis",
        icon: Lightbulb,
      },
      {
        key: "characters" as const,
        label: isZh ? "角色" : "Characters",
        icon: Users,
      },
      {
        key: "storyboard" as const,
        label: isZh ? "分镜板" : "Storyboard",
        icon: LayoutGrid,
      },
      {
        key: "timeline" as const,
        label: isZh ? "时间轴" : "Timeline",
        icon: Clock,
      },
    ],
    [isZh],
  );

  const persistScriptValue = useCallback(async (value: string) => {
    if (!episode) {
      return;
    }
    if (value === scriptMarkdown) {
      return;
    }
    const seq = ++scriptSaveSeqRef.current;
    setSaveError("");
    try {
      const updated = await updateEpisode(episode.id, {
        script: value,
      });
      if (seq !== scriptSaveSeqRef.current) {
        return;
      }
      setEpisode(updated);
      setScriptMarkdown(value);
    } catch (error) {
      if (seq !== scriptSaveSeqRef.current) {
        return;
      }
      setSaveError(
        error instanceof Error
          ? error.message
          : isZh
            ? "保存剧本失败"
            : "Failed to save script",
      );
    }
  }, [episode, isZh, scriptMarkdown]);

  const persistDirectorAnalysisValue = useCallback(
    async (value: string) => {
      if (!episode) {
        return;
      }
      if (value === directorAnalysisMarkdown) {
        return;
      }
      const seq = ++analysisSaveSeqRef.current;
      setSaveError("");
      try {
        const updated = await updateEpisode(episode.id, {
          script_analysis: value,
        });
        if (seq !== analysisSaveSeqRef.current) {
          return;
        }
        setEpisode(updated);
        setDirectorAnalysisMarkdown(value);
      } catch (error) {
        if (seq !== analysisSaveSeqRef.current) {
          return;
        }
        setSaveError(
          error instanceof Error
            ? error.message
            : isZh
              ? "保存导演分析失败"
              : "Failed to save director analysis",
        );
      }
    },
    [directorAnalysisMarkdown, episode, isZh],
  );

  const scheduleScriptSave = useCallback(
    (value: string) => {
      if (scriptDebounceTimerRef.current) {
        clearTimeout(scriptDebounceTimerRef.current);
      }
      scriptDebounceTimerRef.current = setTimeout(() => {
        scriptDebounceTimerRef.current = null;
        void persistScriptValue(value);
      }, 800);
    },
    [persistScriptValue],
  );

  const scheduleDirectorAnalysisSave = useCallback(
    (value: string) => {
      if (analysisDebounceTimerRef.current) {
        clearTimeout(analysisDebounceTimerRef.current);
      }
      analysisDebounceTimerRef.current = setTimeout(() => {
        analysisDebounceTimerRef.current = null;
        void persistDirectorAnalysisValue(value);
      }, 800);
    },
    [persistDirectorAnalysisValue],
  );

  const handleScriptBlur = useCallback(async () => {
    if (scriptDebounceTimerRef.current) {
      clearTimeout(scriptDebounceTimerRef.current);
      scriptDebounceTimerRef.current = null;
    }
    await persistScriptValue(scriptDraft);
    setIsEditingScript(false);
  }, [persistScriptValue, scriptDraft]);

  const handleDirectorAnalysisBlur = useCallback(async () => {
    if (analysisDebounceTimerRef.current) {
      clearTimeout(analysisDebounceTimerRef.current);
      analysisDebounceTimerRef.current = null;
    }
    await persistDirectorAnalysisValue(directorAnalysisDraft);
    setIsEditingDirectorAnalysis(false);
  }, [directorAnalysisDraft, persistDirectorAnalysisValue]);

  useEffect(() => {
    return () => {
      if (scriptDebounceTimerRef.current) {
        clearTimeout(scriptDebounceTimerRef.current);
      }
      if (analysisDebounceTimerRef.current) {
        clearTimeout(analysisDebounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isLoading || !project || !episode) {
      resetHeader();
      return;
    }
    setHeader({
      backHref: `/projects/${projectCode}`,
      title: episode.name || "",
      subtitle: project.name || "",
      center: (
        <div className="inline-flex items-center rounded-lg border border-neutral-800 bg-[#1a1a1a] p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      ),
    });
    return () => {
      resetHeader();
    };
  }, [activeTab, episode, isLoading, project, projectCode, resetHeader, setHeader, tabs]);

  if (isLoading) {
    return (
      <div className="m-4 flex items-center justify-center py-12 text-neutral-500">
        {isZh ? "加载中..." : "Loading..."}
      </div>
    );
  }

  if (!project || !episode) {
    return (
      <div className="m-4 flex flex-col items-center justify-center py-12 text-center">
        <div className="text-sm text-neutral-500">
          {errorMessage || (isZh ? "未找到相关数据" : "Data not found")}
        </div>
      </div>
    );
  }

  return (
    <DirectorEventBusProvider>
      <div className="flex h-full overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto">
        {saveError ? (
          <div className="px-4 py-2 text-xs text-red-400">{saveError}</div>
        ) : null}
        {activeTab === "script" ? (
          <div className="dark p-4">
            {isEditingScript ? (
              <Textarea
                value={scriptDraft}
                onChange={(event) => {
                  const value = event.target.value;
                  setScriptDraft(value);
                  scheduleScriptSave(value);
                }}
                onBlur={() => {
                  void handleScriptBlur();
                }}
                autoFocus
                placeholder={isZh ? "在此编辑剧本内容..." : "Edit script here..."}
                className="min-h-[55vh] resize-y border-neutral-700 bg-neutral-900/60 text-sm leading-7 text-neutral-100"
              />
            ) : (
              <div
                onDoubleClick={() => {
                  setSaveError("");
                  setScriptDraft(scriptMarkdown);
                  setIsEditingScript(true);
                }}
                className="cursor-text"
              >
                <MarkdownContent
                  content={scriptMarkdown}
                  isLoading={false}
                  rehypePlugins={[]}
                  className="prose prose-invert max-w-none text-sm leading-7"
                />
              </div>
            )}
          </div>
        ) : activeTab === "director_analysis" ? (
          <div className="dark p-4">
            {isEditingDirectorAnalysis ? (
              <Textarea
                value={directorAnalysisDraft}
                onChange={(event) => {
                  const value = event.target.value;
                  setDirectorAnalysisDraft(value);
                  scheduleDirectorAnalysisSave(value);
                }}
                onBlur={() => {
                  void handleDirectorAnalysisBlur();
                }}
                autoFocus
                placeholder={isZh ? "在此编辑导演讲戏内容..." : "Edit director analysis here..."}
                className="min-h-[55vh] resize-y border-neutral-700 bg-neutral-900/60 text-sm leading-7 text-neutral-100"
              />
            ) : (
              <div
                onDoubleClick={() => {
                  setSaveError("");
                  setDirectorAnalysisDraft(directorAnalysisMarkdown);
                  setIsEditingDirectorAnalysis(true);
                }}
                className="cursor-text"
              >
                <MarkdownContent
                  content={
                    directorAnalysisMarkdown ||
                    (isZh
                      ? "暂无导演讲戏内容。"
                      : "No director analysis content yet.")
                  }
                  isLoading={false}
                  rehypePlugins={[]}
                  className="prose prose-invert max-w-none text-sm leading-7"
                />
              </div>
            )}
          </div>
        ) : activeTab === "characters" ? (
          <DirectorCharacterPanel
            projectCode={project.code}
            projectId={project.id}
            episode={episode}
            isZh={isZh}
            onEpisodeChange={setEpisode}
            onGenerateCharacterPrompt={({ subjectId, category, name, description }) => {
              setQueuedAssistantAction({
                id: Date.now(),
                actionType: "generate_subject_design_image",
                payload: {
                  projectCode: project.code,
                  subjectId,
                  category,
                  name,
                  description,
                  aspectRatio: "16:9",
                },
              });
            }}
          />
        ) : activeTab === "storyboard" ? (
          <DirectorStoryboardPanel
            episodeId={episode.id}
            projectCode={projectCode}
            isZh={isZh}
            onGenerateStoryboardPrompt={({ storyboardId, narrative }) => {
              setQueuedAssistantAction({
                id: Date.now(),
                actionType: "generate_storyboard_image",
                payload: {
                  projectCode: project.code,
                  storyboardId,
                  aspectRatio: "16:9",
                  narrative:
                    narrative ||
                    (isZh
                      ? "请根据分镜段落内容生成对应故事板"
                      : "Generate storyboard from this segment"),
                },
              });
            }}
          />
        ) : (
          <div className="p-4">
            <p className="text-sm text-neutral-500">
              {isZh ? "该模块内容正在迁移中。" : "This module content is being migrated."}
            </p>
          </div>
        )}
        </div>
        <QueryClientProvider client={queryClient}>
          <DirectorAssistantPanel
            projectCode={projectCode}
            episodeId={episodeId}
            activeTab={activeTab}
            isZh={isZh}
            queuedAction={queuedAssistantAction}
            project={project}
            episode={episode}
          />
        </QueryClientProvider>
      </div>
    </DirectorEventBusProvider>
  );
}
