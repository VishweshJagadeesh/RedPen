"use client";
import { useState } from "react";
import type { Crop } from "@/lib/domain";
import { cn } from "@/lib/utils";

/** Shows only the answer region of a page photo (crop from the grader), without loading a separate image. */
export function HandwritingCrop({ url, crop, className, maxHeight = 360 }: { url: string | null; crop: Crop | null; className?: string; maxHeight?: number }) {
  const [aspect, setAspect] = useState(850 / 1202);
  if (!url) {
    return (
      <div className={cn("grid h-32 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground", className)}>
        Scan not retained for this answer (seeded history)
      </div>
    );
  }
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const ratio = (c.w * aspect) / c.h;
  return (
    <div className={cn("relative w-full overflow-hidden rounded-lg border bg-[#f4f1ea]", className)} style={{ aspectRatio: String(ratio), maxHeight }} data-demo-id="handwriting-crop">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Handwritten answer"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight);
        }}
        style={{ position: "absolute", width: `${100 / c.w}%`, maxWidth: "none", left: `${(-c.x / c.w) * 100}%`, top: `${(-c.y / c.h) * 100}%`, height: `${100 / c.h}%` }}
      />
    </div>
  );
}
