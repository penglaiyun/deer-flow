"use client";

import { ImageIcon, Palette, Sparkles, WandSparkles } from "lucide-react";
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

const recentImages = [
  { id: "i-001", title: "角色立绘A", style: "Cinematic", status: "completed" },
  { id: "i-002", title: "办公室夜景", style: "Noir", status: "queueing" },
  { id: "i-003", title: "天台道具草图", style: "Sketch", status: "draft" },
] as const;

export default function ImageGenerationPage() {
  const { locale, t } = useI18n();

  useEffect(() => {
    document.title = `${locale.startsWith("zh") ? "图片生成" : "Image Generation"} - ${t.pages.appName}`;
  }, [locale, t.pages.appName]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-white md:text-3xl">
          {locale.startsWith("zh") ? "图片生成" : "Image Generation"}
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          {locale.startsWith("zh")
            ? "表单与结果区已搭好，当前使用静态占位数据。"
            : "Form and result section are ready with static placeholder data."}
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
                ? "接口未接入，先确定字段与布局。"
                : "API is not connected yet. Field design is finalized first."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm text-neutral-400">
                {locale.startsWith("zh") ? "素材名称" : "Asset Name"}
              </div>
              <Input
                placeholder={locale.startsWith("zh") ? "例如：女主角色立绘" : "e.g. Hero Character Portrait"}
                disabled
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-neutral-400">
                {locale.startsWith("zh") ? "静态提示词" : "Static Prompt"}
              </div>
              <Textarea
                className="min-h-36"
                placeholder={
                  locale.startsWith("zh")
                    ? "输入场景、主体、光线、风格等"
                    : "Describe scene, subject, lighting and style"
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
                <WandSparkles className="size-4" />
                {locale.startsWith("zh") ? "优化提示词" : "Optimize Prompt"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-800 bg-[#0a0a0a]">
          <CardHeader>
            <CardTitle className="text-white">
              {locale.startsWith("zh") ? "最近图片" : "Recent Images"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentImages.map((image) => (
              <div
                key={image.id}
                className="space-y-2 rounded-lg border border-neutral-800 bg-[#0f0f0f] p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-white">{image.title}</div>
                  <Badge variant="outline">{image.style}</Badge>
                </div>
                <div className="text-xs text-neutral-400">
                  {image.status === "completed"
                    ? locale.startsWith("zh")
                      ? "已完成"
                      : "Completed"
                    : image.status === "queueing"
                      ? locale.startsWith("zh")
                        ? "排队中"
                        : "Queueing"
                      : locale.startsWith("zh")
                        ? "草稿"
                        : "Draft"}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-sm text-neutral-500">
        <div className="flex items-center gap-2">
          <Palette className="size-4" />
          <ImageIcon className="size-4" />
          {locale.startsWith("zh")
            ? "后续将接入图片生成服务与素材入库逻辑。"
            : "Next step: image generation provider and asset-library persistence."}
        </div>
      </div>
    </div>
  );
}
