import React from "react";

// Renders `**bold**` (Markdown-style) and `` `code` `` (inline code) segments
// inside a plain string as real JSX <strong> and <code> elements. Everything
// else stays as text — no full Markdown parser needed for the changelog.
//
// Keeps the changelog copy readable in source (with **stars**) while looking
// polished on the public /changelog page and the CMS mirror.
const TOKEN_RE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

export const RichText = ({ text }) => {
  if (!text || typeof text !== "string") return text || null;
  const parts = text.split(TOKEN_RE).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i} className="text-strong font-semibold">{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith("`") && p.endsWith("`")) {
          return (
            <code key={i} className="font-mono text-[0.85em] px-1 py-0.5 rounded surface-2 border border-app/60 text-pear-600 dark:text-pear-400">
              {p.slice(1, -1)}
            </code>
          );
        }
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
};
