"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Whole-page GPX drop target (locked scope: the page accepts files, not
 * individual day cells).
 *
 * Drag events fire for every child element entering/leaving, so a naive
 * dragenter/dragleave pair flickers. We count enters and leaves and only clear
 * the overlay when the counter returns to zero.
 */
export function DropZone({
  onFiles,
  disabled = false,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const reset = useCallback(() => {
    depth.current = 0;
    setDragging(false);
  }, []);

  useEffect(() => {
    if (disabled) return;

    function hasFiles(e: DragEvent): boolean {
      return Array.from(e.dataTransfer?.types ?? []).includes("Files");
    }

    function onDragEnter(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    }

    function onDragOver(e: DragEvent) {
      if (!hasFiles(e)) return;
      // Required, or the browser opens the file instead of firing drop.
      e.preventDefault();
    }

    function onDragLeave(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current -= 1;
      if (depth.current <= 0) reset();
    }

    function onDrop(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      reset();
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) onFiles(files);
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [onFiles, disabled, reset]);

  if (!dragging) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-8 backdrop-blur-sm">
      <div className="rounded-2xl border-2 border-dashed border-white/80 px-10 py-8 text-center">
        <p className="text-lg font-semibold text-white">Drop GPX files</p>
        <p className="mt-1 text-sm text-white/80">
          They roll into this week&apos;s totals — no need to match them to days.
        </p>
      </div>
    </div>
  );
}
