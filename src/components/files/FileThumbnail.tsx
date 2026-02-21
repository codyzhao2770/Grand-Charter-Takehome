"use client";

import { useState } from "react";
import { FileIcon } from "@/components/icons";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/avif",
]);

function isImage(mimeType: string) {
  return IMAGE_TYPES.has(mimeType);
}

function getFileTypeInfo(mimeType: string): {
  icon: React.ReactNode;
  bg: string;
} {
  if (mimeType === "application/pdf") {
    return {
      bg: "bg-red-50 dark:bg-red-950/30",
      icon: (
        <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          <text x="8.5" y="18" fontSize="6" fontWeight="bold" fill="currentColor" stroke="none">PDF</text>
        </svg>
      ),
    };
  }

  if (mimeType.startsWith("video/")) {
    return {
      bg: "bg-purple-50 dark:bg-purple-950/30",
      icon: (
        <svg className="w-12 h-12 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5c0 .621-.504 1.125-1.125 1.125m1.5 0h12m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 12.75h1.5m-1.5 0c-.621 0-1.125-.504-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125m1.5 3.75c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125M18 8.25h1.5M6 12.75h12" />
        </svg>
      ),
    };
  }

  if (mimeType.startsWith("audio/")) {
    return {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      icon: (
        <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
        </svg>
      ),
    };
  }

  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "application/javascript"
  ) {
    return {
      bg: "bg-sky-50 dark:bg-sky-950/30",
      icon: (
        <svg className="w-12 h-12 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
      ),
    };
  }

  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-tar" ||
    mimeType === "application/gzip" ||
    mimeType === "application/x-7z-compressed" ||
    mimeType === "application/x-rar-compressed"
  ) {
    return {
      bg: "bg-orange-50 dark:bg-orange-950/30",
      icon: (
        <svg className="w-12 h-12 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      ),
    };
  }

  return {
    bg: "bg-zinc-50 dark:bg-zinc-900",
    icon: <FileIcon className="w-12 h-12 text-zinc-400" />,
  };
}

interface FileThumbnailProps {
  fileId: string;
  fileName: string;
  mimeType: string;
  className?: string;
}

export default function FileThumbnail({
  fileId,
  fileName,
  mimeType,
  className = "",
}: FileThumbnailProps) {
  const [imgError, setImgError] = useState(false);

  if (isImage(mimeType) && !imgError) {
    const isSvg = mimeType === "image/svg+xml";
    const src = isSvg
      ? `/api/files/${fileId}/preview`
      : `/api/files/${fileId}/thumbnail`;

    return (
      <div
        className={`relative overflow-hidden bg-zinc-100 dark:bg-zinc-900 ${className}`}
      >
        <img
          src={src}
          alt={fileName}
          loading="lazy"
          onError={() => setImgError(true)}
          className={`w-full h-full ${isSvg ? "object-contain p-2" : "object-cover"}`}
        />
      </div>
    );
  }

  const { icon, bg } = getFileTypeInfo(mimeType);

  return (
    <div
      className={`flex items-center justify-center ${bg} ${className}`}
    >
      {icon}
    </div>
  );
}
