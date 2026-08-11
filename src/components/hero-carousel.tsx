"use client";

import { useState, useEffect } from "react";

// Crossfading hero imagery. The image list is admin-managed via the
// home.hero_images setting (JSON array of URLs/paths).
export function HeroCarousel({ images, intervalMs = 5000 }: { images: string[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % images.length), intervalMs);
    return () => clearInterval(t);
  }, [images.length, intervalMs]);

  if (images.length === 0) return null;

  return (
    <div className="relative">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl ring-1 ring-slate-200">
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt="TaxOnMe makes taxes feel simple"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${i === index ? "opacity-100" : "opacity-0"}`}
          />
        ))}
      </div>

      {/* Floating product chips for a software feel */}
      <div className="absolute -left-5 top-6 hidden rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-slate-200 sm:block">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Case readiness</p>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-[72%] rounded-full bg-emerald-500" />
          </div>
          <span className="text-xs font-bold text-slate-800">72%</span>
        </div>
      </div>
      <div className="absolute -right-4 bottom-16 hidden rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-slate-200 sm:block">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">✓</span>
          $2,772 refund difference found
        </p>
        <p className="mt-0.5 text-[10px] text-slate-400">Case TOM-000123 · verified against transcript</p>
      </div>

      {images.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-indigo-600" : "w-2 bg-slate-300 hover:bg-slate-400"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
