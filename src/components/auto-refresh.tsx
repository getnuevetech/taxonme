"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Refreshes the page on an interval while a background job (e.g. analysis)
// is running. It unmounts automatically once the server stops rendering it.
export function AutoRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return null;
}
