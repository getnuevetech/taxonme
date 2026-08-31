/** Soft-format stored assistant text: **emphasis** → teal strong (monetization CTAs). */
export function AssistantMessageText({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((part, index) => {
        const match = /^\*\*([^*]+)\*\*$/.exec(part);
        if (match) {
          return (
            <strong key={index} className="font-semibold text-teal-700">
              {match[1]}
            </strong>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}
