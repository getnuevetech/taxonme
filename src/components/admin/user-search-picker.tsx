"use client";

import { useState, useRef, useEffect } from "react";
import { inputClass } from "../ui";

type Result = { id: string; label: string; email: string; phone: string; role: string };

// Suggestive search over customers/consultants (name, email, or mobile).
// Sets a hidden input with the chosen user's id for the surrounding form.
export function UserSearchPicker({ name, placeholder }: { name: string; placeholder?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState<Result | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const search = (q: string) => {
    setQuery(q);
    setSelected(null);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/user-search?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  return (
    <div ref={boxRef} className="relative">
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2">
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium text-slate-900">
              {selected.label} <span className="text-xs font-normal text-indigo-600">({selected.role})</span>
            </p>
            <p className="truncate text-xs text-slate-500">{selected.email}{selected.phone ? ` · ${selected.phone}` : ""}</p>
          </div>
          <button type="button" onClick={() => { setSelected(null); setQuery(""); }} className="text-xs font-medium text-slate-500 hover:text-slate-800">
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            value={query}
            onChange={(e) => search(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={placeholder ?? "Search by name, email, or mobile…"}
            autoComplete="off"
            className={inputClass}
          />
          {open && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {loading && <p className="px-3 py-2 text-xs text-slate-400">Searching…</p>}
              {!loading && results.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-400">No matching customers or consultants.</p>
              )}
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setSelected(r); setOpen(false); }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
                >
                  <span className="font-medium text-slate-900">{r.label}</span>{" "}
                  <span className="text-xs text-indigo-600">({r.role})</span>
                  <span className="block text-xs text-slate-500">{r.email}{r.phone ? ` · ${r.phone}` : ""}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
