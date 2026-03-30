"use client";

import { Clapperboard, Play, Sparkles, Wand2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/core/i18n/hooks";

const recentVideos = [
  { id: "v-001", title: "暴雨夜追逐", duration: "00:12", status: "completed" },
  { id: "v-002", title: "审讯室光影", duration: "00:08", status: "queueing" },
  { id: "v-003", title: "天台长镜头", duration: "00:15", status: "draft" },
] as const;

export default function VideoGenerationPage() {
  const { locale, t } = useI18n();

  useEffect(() => {
    document.title = `${locale.startsWith("zh") ? "视频生成" : "Video Generation"} - ${t.pages.appName}`;
  }, [locale, t.pages.appName]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-white md:text-3xl">
          {locale.startsWith("zh") ? "视频生成" : "Video Generation"}
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          {locale.startsWith("zh")
            ? "先完成页面结构，后续再接入生成接口。"
            : "Page structure first. Generation APIs will be connected later."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="border-neutral-800 bg-[#0a0a0a] xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">
              {locale.startsWith("zh") ? "生成配置" : "Generation Config"}
            </CardTitle>
            <CardDescription>
              {locale.startsWith("zh")
                ? "表单已就绪，提交按钮暂时禁用。"
                : "Form is ready, submit action is disabled for now."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm text-neutral-400">
                {locale.startsWith("zh") ? "分镜标题" : "Shot Title"}
              </div>
              <Input
                placeholder={locale.startsWith("zh") ? "例如：暴雨夜追逐" : "e.g. Night Chase in Rain"}
                disabled
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-neutral-400">
                {locale.startsWith("zh") ? "运动提示词" : "Motion Prompt"}
              </div>
              <Textarea
                className="min-h-36"
                placeholder={
                  locale.startsWith("zh")
                    ? "输入动作、情绪、镜头运动等信息"
                    : "Describe action, emotion and camera movement"
                }
                disabled
              />
            </div>
            <div className="flex gap-3">
              <Button disabled>
                <Sparkles className="size-4" />
                {locale.startsWith("zh") ? "开始生成" : "Generate"}
              </Button>
              <Button variant="outline" disabled>
                <Wand2 className="size-4" />
                {locale.startsWith("zh") ? "AI润色提示词" : "Refine Prompt"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-800 bg-[#0a0a0a]">
          <CardHeader>
            <CardTitle className="text-white">
              {locale.startsWith("zh") ? "最近任务" : "Recent Jobs"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentVideos.map((video) => (
              <div
                key={video.id}
                className="space-y-2 rounded-lg border border-neutral-800 bg-[#0f0f0f] p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-white">{video.title}</div>
                  <Badge variant="outline">{video.duration}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">
                    {video.status === "completed"
                      ? locale.startsWith("zh")
                        ? "已完成"
                        : "Completed"
                      : video.status === "queueing"
                        ? locale.startsWith("zh")
                          ? "排队中"
                          : "Queueing"
                        : locale.startsWith("zh")
                          ? "草稿"
                          : "Draft"}
                  </span>
                  <Button size="sm" variant="outline" disabled>
                    <Play className="size-4" />
                    {locale.startsWith("zh") ? "预览" : "Preview"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-sm text-neutral-500">
        <div className="flex items-center gap-2">
          <Clapperboard className="size-4" />
          {locale.startsWith("zh")
            ? "后续将接入视频生成服务、任务轮询与结果回填。"
            : "Video provider integration, task polling and result binding will be added next."}
        </div>
      </div>
    </div>
  );
}
