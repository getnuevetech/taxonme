import type { ReactNode } from "react";

// Editorial headline helper: words wrapped in *asterisks* render as italic
// serif accents in brand blue. When no markers are present, the final word is
// accented automatically — so admin-edited copy always gets the treatment.
export function Accent({ text, accentClass = "font-serif italic text-indigo-600" }: { text: string; accentClass?: string }) {
  let source = text;
  if (!/\*[^*]+\*/.test(source)) {
    const match = source.match(/^([\s\S]*?)(\S+?)([.!?…]*)$/);
    if (match && match[2]) source = `${match[1]}*${match[2]}*${match[3]}`;
  }
  const parts = source.split(/(\*[^*]+\*)/g);
  const nodes: ReactNode[] = parts.map((part, i) =>
    part.startsWith("*") && part.endsWith("*") ? (
      <em key={i} className={accentClass}>
        {part.slice(1, -1)}
      </em>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
  return <>{nodes}</>;
}

// Small uppercase kicker with the leading dash, as in the reference design.
export function Kicker({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] ${light ? "text-indigo-300" : "text-indigo-600"}`}>
      <span className={`inline-block h-px w-8 ${light ? "bg-indigo-300" : "bg-indigo-600"}`} />
      {children}
    </p>
  );
}
