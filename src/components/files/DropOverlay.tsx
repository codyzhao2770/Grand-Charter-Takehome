"use client";

import { UploadIcon } from "@/components/icons";

export default function DropOverlay({ label }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-blue-50/80 dark:bg-blue-950/50 border-2 border-dashed border-blue-500 rounded-lg pointer-events-none">
      <div className="text-center">
        <UploadIcon className="w-12 h-12 mx-auto mb-2 text-blue-500" />
        <p className="text-lg font-medium text-blue-600 dark:text-blue-400">
          {label || "Drop files to upload"}
        </p>
      </div>
    </div>
  );
}
