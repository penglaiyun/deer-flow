"use client";

import { Download, Maximize2, X } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

type ImagePreviewProps = {
  src?: string | null;
  alt?: string;
  triggerClassName?: string;
  buttonSize?: number;
  clickToOpen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type DownloadImageOptions = {
  url: string;
  filenameBase?: string;
};

export async function downloadImageFromUrl({
  url,
  filenameBase,
}: DownloadImageOptions): Promise<void> {
  const normalizedName = filenameBase?.trim();
  const baseName =
    (normalizedName && normalizedName.length > 0 ? normalizedName : "image").replace(/[\\/:*?"<>|]+/g, "_");
  let extension = "png";
  try {
    const parsedUrl = new URL(url, window.location.origin);
    const lastSegment = parsedUrl.pathname.split("/").pop() ?? "";
    const parsed = lastSegment.includes(".")
      ? lastSegment.split(".").pop()
      : "";
    if (parsed) {
      extension = parsed;
    }
  } catch {
    const parsed = url.split(".").pop()?.split("?")[0];
    if (parsed) {
      extension = parsed;
    }
  }

  const triggerDownload = (href: string) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = `${baseName}.${extension}`;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fileName = `${baseName}.${extension}`;
  const query = new URLSearchParams({
    url,
    filename: fileName,
  });
  triggerDownload(`/api/download-image?${query.toString()}`);
}

export function ImagePreview({
  src,
  alt,
  triggerClassName,
  buttonSize = 18,
  clickToOpen = false,
  isOpen: externalIsOpen,
  onOpenChange,
}: ImagePreviewProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalIsOpen !== undefined;
  const open = isControlled ? Boolean(externalIsOpen && src) : internalOpen;

  const handleOpen = (event: MouseEvent) => {
    event.stopPropagation();
    if (!src) {
      return;
    }
    if (isControlled) {
      onOpenChange?.(true);
      return;
    }
    setInternalOpen(true);
  };

  const handleClose = () => {
    if (isControlled) {
      onOpenChange?.(false);
      return;
    }
    setInternalOpen(false);
  };

  const handleDownload = async (event: MouseEvent) => {
    event.stopPropagation();
    if (!src) {
      return;
    }
    await downloadImageFromUrl({
      url: src,
      filenameBase: alt,
    });
  };

  const previewModal =
    open && src ? (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
        onClick={handleClose}
      >
        <div className="relative flex h-full w-full items-center justify-center">
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-xl border border-white/10 bg-black/70 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/90"
              aria-label="下载"
            >
              <Download size={20} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleClose();
              }}
              className="rounded-xl border border-white/10 bg-black/70 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/90"
              aria-label="关闭"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      {clickToOpen ? (
        <div
          onClick={handleOpen}
          className="absolute inset-0 z-10 cursor-zoom-in"
          aria-label="点击放大"
        />
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className={
            triggerClassName ??
            "absolute right-2 bottom-2 z-10 flex h-7 w-7 items-center justify-center rounded bg-black/50 p-1.5 text-neutral-200 opacity-0 transition-colors group-hover:opacity-100 hover:bg-black/70"
          }
          aria-label="放大"
        >
          <Maximize2 size={buttonSize} />
        </button>
      )}

      {previewModal && typeof document !== "undefined"
        ? createPortal(previewModal, document.body)
        : null}
    </>
  );
}
