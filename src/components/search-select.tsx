"use client";

import { useState, useRef, useEffect } from "react";
import { inputClass } from "./ui";

// Suggestive-search inputs for known/enumerable values (states, years, …).
// Users can only PICK from the list — free-typed values are never submitted.

export type Option = { value: string; label: string };

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return ref;
}

export function SearchSelect({
  name,
  options,
  defaultValue = "",
  placeholder = "Type to search…",
  required,
}: {
  name: string;
  options: Option[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const initial = options.find((o) => o.value === defaultValue) ?? null;
  const [selected, setSelected] = useState<Option | null>(initial);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  const filtered = options.filter(
    (o) => o.label.toLowerCase().includes(query.toLowerCase()) || o.value.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={selected?.value ?? ""} required={required} />
      {selected ? (
        <div className={`${inputClass} flex items-center justify-between`}>
          <span className="truncate">{selected.label}</span>
          <button
            type="button"
            onClick={() => { setSelected(null); setQuery(""); setOpen(true); }}
            className="ml-2 shrink-0 text-xs font-medium text-slate-400 hover:text-slate-700"
          >
            change
          </button>
        </div>
      ) : (
        <>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
            className={inputClass}
          />
          {open && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {filtered.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">No matches — pick from the list.</p>}
              {filtered.slice(0, 50).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { setSelected(o); setOpen(false); }}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function MultiSearchSelect({
  name,
  options,
  defaultValues = [],
  placeholder = "Type to search, click to add…",
}: {
  name: string;
  options: Option[];
  defaultValues?: string[];
  placeholder?: string;
}) {
  const [selected, setSelected] = useState<Option[]>(
    options.filter((o) => defaultValues.includes(o.value)),
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  const remaining = options.filter(
    (o) =>
      !selected.some((s) => s.value === o.value) &&
      (o.label.toLowerCase().includes(query.toLowerCase()) || o.value.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={selected.map((s) => s.value).join(", ")} />
      <div className={`${inputClass} flex min-h-10 flex-wrap items-center gap-1.5`}>
        {selected.map((s) => (
          <span key={s.value} className="flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
            {s.label}
            <button
              type="button"
              onClick={() => setSelected(selected.filter((x) => x.value !== s.value))}
              className="text-indigo-400 hover:text-indigo-700"
              aria-label={`Remove ${s.label}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ""}
          autoComplete="off"
          className="min-w-24 flex-1 border-0 bg-transparent p-0 text-sm focus:outline-none focus:ring-0"
        />
      </div>
      {open && remaining.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {remaining.slice(0, 50).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { setSelected([...selected, o]); setQuery(""); }}
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
