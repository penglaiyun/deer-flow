"use client";

import {
  ArrowLeft,
  Bot,
  FileText,
  FolderKanban,
  ImageIcon,
  LayoutDashboard,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Sparkles,
  Video,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { STUDIO_SIDEBAR_COLLAPSED_KEY } from "@/components/studio/constants";
import {
  StudioHeaderContext,
  type StudioHeaderConfig,
} from "@/components/studio/header-context";
import { useI18n } from "@/core/i18n/hooks";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  disabled?: boolean;
}

function titleOfPathname(pathname: string, locale: string, consoleLabel: string) {
  if (pathname.startsWith("/projects")) {
    return locale.startsWith("zh") ? "项目列表" : "Projects";
  }
  if (pathname.startsWith("/tools/video-generation")) {
    return locale.startsWith("zh") ? "视频生成" : "Video Generation";
  }
  if (pathname.startsWith("/tools/image-generation")) {
    return locale.startsWith("zh") ? "图片生成" : "Image Generation";
  }
  if (pathname.startsWith("/copywriting/subscriptions")) {
    return locale.startsWith("zh") ? "订阅管理" : "Subscription Management";
  }
  if (pathname.startsWith("/copywriting/categories")) {
    return locale.startsWith("zh") ? "文案归类" : "Copy Categories";
  }
  if (pathname.startsWith("/copywriting/todos")) {
    return locale.startsWith("zh") ? "二创任务" : "Secondary Creation Tasks";
  }
  if (pathname.startsWith("/video-list")) {
    return locale.startsWith("zh") ? "视频列表" : "Video List";
  }
  if (pathname.startsWith("/workspace/chats")) {
    return locale.startsWith("zh") ? "对话" : "Chats";
  }
  if (pathname.startsWith("/workspace/agents")) {
    return locale.startsWith("zh") ? "智能体" : "Agents";
  }
  return consoleLabel;
}

function headerMetaOfPathname(pathname: string, title: string) {
  const directorMatched = /^\/projects\/([^/]+)\/director\/([^/]+)/.exec(pathname);
  if (directorMatched?.[1]) {
    return {
      backHref: `/projects/${directorMatched[1]}`,
      title,
      subtitle: "",
    };
  }
  return {
    backHref: "",
    title,
    subtitle: "",
  };
}

export function StudioLayout({
  children,
  initialSidebarCollapsed,
}: Readonly<{
  children: React.ReactNode;
  initialSidebarCollapsed?: boolean;
}>) {
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const headerTitle = titleOfPathname(pathname, locale, t.pages.console);
  const defaultHeaderMeta = headerMetaOfPathname(pathname, headerTitle);
  const [headerOverride, setHeaderOverride] = useState<StudioHeaderConfig | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    initialSidebarCollapsed ?? false,
  );

  useEffect(() => {
    setHeaderOverride(null);
  }, [pathname]);

  useEffect(() => {
    localStorage.setItem(
      STUDIO_SIDEBAR_COLLAPSED_KEY,
      String(isSidebarCollapsed),
    );
    document.cookie = `${STUDIO_SIDEBAR_COLLAPSED_KEY}=${isSidebarCollapsed}; path=/; max-age=31536000; SameSite=Lax`;
  }, [isSidebarCollapsed]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STUDIO_SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const headerMeta = {
    ...defaultHeaderMeta,
    ...(headerOverride ?? {}),
  };
  const setHeader = useCallback((config: StudioHeaderConfig) => {
    setHeaderOverride(config);
  }, []);
  const resetHeader = useCallback(() => {
    setHeaderOverride(null);
  }, []);
  const headerController = useMemo(
    () => ({
      setHeader,
      resetHeader,
    }),
    [resetHeader, setHeader],
  );

  const mainNavItems: NavItem[] = [
    {
      href: "/console",
      label: t.pages.console,
      icon: <LayoutDashboard size={18} />,
      active: pathname === "/console",
    },
    {
      href: "/projects",
      label: locale.startsWith("zh") ? "项目列表" : "Projects",
      icon: <FolderKanban size={18} />,
      active: pathname.startsWith("/projects"),
    },
  ];

  const toolNavItems: NavItem[] = [
    {
      href: "/tools/video-generation",
      label: locale.startsWith("zh") ? "视频生成" : "Video Generation",
      icon: <Video size={18} />,
      active: pathname.startsWith("/tools/video-generation"),
    },
    {
      href: "/tools/image-generation",
      label: locale.startsWith("zh") ? "图片生成" : "Image Generation",
      icon: <ImageIcon size={18} />,
      active: pathname.startsWith("/tools/image-generation"),
    },
    {
      href: "/copywriting/subscriptions",
      label: locale.startsWith("zh") ? "订阅管理" : "Subscription Management",
      icon: <FileText size={18} />,
      active: pathname.startsWith("/copywriting/subscriptions"),
      disabled: true,
    },
    {
      href: "/copywriting/categories",
      label: locale.startsWith("zh") ? "文案归类" : "Copy Categories",
      icon: <FileText size={18} />,
      active: pathname.startsWith("/copywriting/categories"),
      disabled: true,
    },
    {
      href: "/copywriting/todos",
      label: locale.startsWith("zh") ? "二创任务" : "Secondary Creation Tasks",
      icon: <FileText size={18} />,
      active: pathname.startsWith("/copywriting/todos"),
      disabled: true,
    },
    {
      href: "/video-list",
      label: locale.startsWith("zh") ? "视频列表" : "Video List",
      icon: <Video size={18} />,
      active: pathname.startsWith("/video-list"),
      disabled: true,
    },
  ];

  const workspaceNavItems: NavItem[] = [
    {
      href: "/workspace/chats",
      label: locale.startsWith("zh") ? "对话" : "Chats",
      icon: <MessagesSquare size={18} />,
      active: pathname.startsWith("/workspace/chats"),
    },
    {
      href: "/workspace/agents",
      label: locale.startsWith("zh") ? "智能体" : "Agents",
      icon: <Bot size={18} />,
      active: pathname.startsWith("/workspace/agents"),
    },
  ];

  return (
    <StudioHeaderContext.Provider value={headerController}>
    <div className="flex h-screen overflow-hidden bg-black font-sans text-neutral-300">
      <aside
        className={`flex shrink-0 flex-col bg-[#0a0a0a] transition-all duration-300 ${
          isSidebarCollapsed ? "w-16" : "w-60"
        }`}
      >
        <div
          className={`mb-2 flex items-center p-4 ${
            isSidebarCollapsed ? "justify-center" : "justify-between gap-2"
          }`}
        >
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-orange-600">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-white">
                  {locale.startsWith("zh") ? "布丁创作" : "Pudding Studio"}
                </span>
                <span className="text-[10px] text-neutral-500">
                  {locale.startsWith("zh") ? "创作工作台" : "Creative Workspace"}
                </span>
              </div>
            </div>
          )}
          {isSidebarCollapsed && (
            <div className="flex h-8 w-8 items-center justify-center rounded bg-orange-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-white"
            title={isSidebarCollapsed ? "展开侧栏" : "收起侧栏"}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
        </div>
        <nav className="scrollbar-hide flex-1 space-y-2 overflow-y-auto px-2 py-4">
          {mainNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`mx-2 flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold tracking-wide transition-colors ${
                item.active
                  ? "border border-neutral-700/50 bg-neutral-800 text-white shadow-lg"
                  : "text-neutral-500 hover:bg-neutral-800/30 hover:text-neutral-200"
              } ${isSidebarCollapsed ? "justify-center px-0" : "gap-3"}`}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <span className={item.active ? "text-orange-500" : "text-inherit"}>
                {item.icon}
              </span>
              {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}

          <div className="mt-2">
            {!isSidebarCollapsed ? (
              <h3 className="mx-2 px-3 py-2 text-[10px] font-bold tracking-widest text-neutral-600 uppercase">
                {locale.startsWith("zh") ? "工具" : "Tools"}
              </h3>
            ) : (
              <div className="py-2" />
            )}
            {toolNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-xl py-2.5 text-sm font-semibold tracking-wide transition-colors ${
                  item.active
                    ? "border border-neutral-700/50 bg-neutral-800 text-white shadow-lg"
                    : "text-neutral-500 hover:bg-neutral-800/30 hover:text-neutral-200"
                } ${
                  isSidebarCollapsed
                    ? "mx-2 justify-center px-0"
                    : "mx-2 gap-3 px-3"
                } ${item.disabled ? "pointer-events-none opacity-60" : ""}`}
                title={isSidebarCollapsed ? item.label : undefined}
                aria-disabled={item.disabled}
              >
                <span className={item.active ? "text-orange-500" : "text-inherit"}>
                  {item.icon}
                </span>
                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            ))}
          </div>

          {workspaceNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`mx-2 flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold tracking-wide transition-colors ${
                item.active
                  ? "border border-neutral-700/50 bg-neutral-800 text-white shadow-lg"
                  : "text-neutral-500 hover:bg-neutral-800/30 hover:text-neutral-200"
              } ${isSidebarCollapsed ? "justify-center px-0" : "gap-3"}`}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <span className={item.active ? "text-orange-500" : "text-inherit"}>
                {item.icon}
              </span>
              {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden bg-[#0a0a0a]">
        <header className="relative z-20 flex h-14 shrink-0 items-center justify-between bg-[#0a0a0a] px-6 backdrop-blur-md">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {headerMeta.backHref ? (
              <Link
                href={headerMeta.backHref}
                className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
              >
                <ArrowLeft size={20} />
              </Link>
            ) : null}
            {headerMeta.title || headerMeta.subtitle ? (
              <div>
                {headerMeta.title ? (
                  <h1 className="text-sm font-medium text-white">{headerMeta.title}</h1>
                ) : null}
                {headerMeta.subtitle ? (
                  <p className="text-xs text-neutral-500">{headerMeta.subtitle}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2">{headerMeta.center ?? null}</div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <Link
              href="/console/styles"
              className={`rounded-lg p-2 transition-colors ${
                pathname === "/console/styles"
                  ? "text-orange-400"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
              }`}
              title={locale.startsWith("zh") ? "风格管理" : "Style Management"}
            >
              <Palette size={16} />
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto rounded-bl-2xl rounded-tl-2xl bg-[#000000]">
          {children}
        </main>
      </div>
    </div>
    </StudioHeaderContext.Provider>
  );
}
