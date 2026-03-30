"use client";

import {
  BarChart3,
  Clock3,
  FileText,
  Film,
  FolderKanban,
  PlayCircle,
} from "lucide-react";
import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useI18n } from "@/core/i18n/hooks";

type EpisodeStatus = "draft" | "in_progress" | "completed";

interface TodoEpisode {
  id: string;
  name: string;
  projectName: string;
  episodeNumber: number;
  updatedAt: string;
  status: EpisodeStatus;
}

interface DraftItem {
  id: string;
  title: string;
  preview: string;
  projectName: string;
  updatedAt: string;
}

const dashboardStats = [
  {
    key: "projects",
    titleZh: "总项目数",
    titleEn: "Total Projects",
    value: 8,
    icon: FolderKanban,
    iconClassName: "text-orange-500",
  },
  {
    key: "episodes",
    titleZh: "总剧集数",
    titleEn: "Total Episodes",
    value: 36,
    icon: BarChart3,
    iconClassName: "text-blue-500",
  },
  {
    key: "inProgress",
    titleZh: "进行中剧集",
    titleEn: "Active Episodes",
    value: 5,
    icon: Film,
    iconClassName: "text-emerald-500",
  },
  {
    key: "duration",
    titleZh: "总时长(分)",
    titleEn: "Total Duration (min)",
    value: 180,
    icon: Clock3,
    iconClassName: "text-purple-500",
  },
] as const;

const todoEpisodes: TodoEpisode[] = [
  {
    id: "ep-101",
    name: "暴雨夜的重逢",
    projectName: "雾城迷踪",
    episodeNumber: 1,
    updatedAt: "2026-03-20",
    status: "in_progress",
  },
  {
    id: "ep-102",
    name: "证据消失的三分钟",
    projectName: "雾城迷踪",
    episodeNumber: 2,
    updatedAt: "2026-03-19",
    status: "draft",
  },
  {
    id: "ep-203",
    name: "意外来电",
    projectName: "逆光证词",
    episodeNumber: 7,
    updatedAt: "2026-03-18",
    status: "completed",
  },
];

const drafts: DraftItem[] = [
  {
    id: "dr-001",
    title: "雨中天台对峙",
    preview: "女主在天台与反派对峙，镜头从远景推近，情绪逐渐拉满。",
    projectName: "雾城迷踪",
    updatedAt: "2026-03-20",
  },
  {
    id: "dr-002",
    title: "审讯室反转",
    preview: "审讯中证词反复，灯光压暗，人物微表情成为关键叙事点。",
    projectName: "逆光证词",
    updatedAt: "2026-03-19",
  },
];

function getStatusBadge(status: EpisodeStatus, locale: string) {
  if (status === "completed") {
    return (
      <Badge variant="secondary">
        {locale.startsWith("zh") ? "已完成" : "Completed"}
      </Badge>
    );
  }
  if (status === "in_progress") {
    return (
      <Badge>
        {locale.startsWith("zh") ? "制作中" : "In Progress"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline">{locale.startsWith("zh") ? "草稿" : "Draft"}</Badge>
  );
}

export default function ConsolePage() {
  const { locale, t } = useI18n();

  useEffect(() => {
    document.title = `${t.pages.console} - ${t.pages.appName}`;
  }, [t.pages.console, t.pages.appName]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-white md:text-3xl">
            {locale.startsWith("zh") ? "控制台" : "Console"}
          </h1>
          <p className="text-sm text-neutral-400 md:text-base">
            {locale.startsWith("zh")
              ? "欢迎使用布丁创作工作台，当前为静态演示数据。"
              : "Welcome to Pudding Studio workspace. Data is currently mocked."}
          </p>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.key} className="border-neutral-800 bg-[#0a0a0a]">
              <CardHeader className="pb-0">
                <CardDescription>
                  {locale.startsWith("zh") ? item.titleZh : item.titleEn}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-2xl font-semibold text-white">{item.value}</div>
                <Icon className={`size-5 ${item.iconClassName}`} />
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section>
        <Card className="border-neutral-800 bg-[#0a0a0a]">
          <CardHeader className="pb-0">
            <CardTitle className="text-white">
              {locale.startsWith("zh") ? "待制作剧集" : "Todo Episodes"}
            </CardTitle>
            <CardDescription>
              {locale.startsWith("zh")
                ? "优先处理的剧集列表（示例数据）"
                : "Prioritized episodes to produce (mock data)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {todoEpisodes.map((episode) => (
              <div
                key={episode.id}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-[#0f0f0f] p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-white md:text-base">
                    <span>{episode.name}</span>
                    <Badge variant="outline">{episode.projectName}</Badge>
                  </div>
                  <div className="text-xs text-neutral-400 md:text-sm">
                    {locale.startsWith("zh")
                      ? `第 ${episode.episodeNumber} 集 · 更新于 ${episode.updatedAt}`
                      : `Episode ${episode.episodeNumber} · Updated ${episode.updatedAt}`}
                  </div>
                </div>
                {getStatusBadge(episode.status, locale)}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-neutral-800 bg-[#0a0a0a]">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-white">
                  {locale.startsWith("zh") ? "草稿箱" : "Draft Box"}
                </CardTitle>
                <CardDescription>
                  {locale.startsWith("zh")
                    ? "先完成页面形态，后续再接入草稿接口。"
                    : "UI first, draft APIs will be integrated later."}
                </CardDescription>
              </div>
              <Button size="sm" disabled>
                <FileText className="size-4" />
                {locale.startsWith("zh") ? "新建草稿" : "New Draft"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="space-y-2 rounded-lg border border-neutral-800 bg-[#0f0f0f] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white md:text-base">
                    {draft.title}
                  </div>
                  <Badge variant="outline">{draft.projectName}</Badge>
                </div>
                <p className="line-clamp-2 text-xs text-neutral-400 md:text-sm">
                  {draft.preview}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">
                    {locale.startsWith("zh")
                      ? `更新于 ${draft.updatedAt}`
                      : `Updated ${draft.updatedAt}`}
                  </span>
                  <Button variant="outline" size="sm" disabled>
                    <PlayCircle className="size-4" />
                    {locale.startsWith("zh") ? "继续编辑" : "Continue"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
