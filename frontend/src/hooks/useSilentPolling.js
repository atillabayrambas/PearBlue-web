// useSilentPolling — background-refresh a fetcher on an interval without
// disrupting the user. Four guarantees:
//   1) NEVER touches a `loading` state — the caller manages that.
//   2) Skips the tick when the user is actively typing in a form (focus
//      inside <input>, <textarea>, or a contenteditable within the CMS main).
//   3) Only invokes setData when the fetched payload actually changed
//      (JSON.stringify diff) so React doesn't re-render on identical polls.
//   4) Optional `onChange(prev, next)` fires ONLY when the payload changed —
//      the caller decides whether to surface a toast, badge bump, etc.
//
// Also pauses when the tab is hidden (document.visibilityState !== 'visible')
// so we don't burn bandwidth in background tabs.
import { useEffect, useRef } from "react";

const isInteracting = () => {
  if (typeof document === "undefined") return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  return false;
};

export const useSilentPolling = (fetcher, setData, intervalMs = 15000, deps = [], onChange = null) => {
  const lastHash = useRef("");
  const lastData = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      if (isInteracting()) return; // user is typing/selecting — leave state alone
      try {
        const data = await fetcher();
        if (cancelled) return;
        const hash = JSON.stringify(data);
        if (hash === lastHash.current) return; // no change → no re-render
        const prev = lastData.current;
        lastHash.current = hash;
        lastData.current = data;
        setData(data);
        if (onChange) {
          try { onChange(prev, data); } catch { /* swallow — never break the poll loop */ }
        }
      } catch { /* silent: caller decides on error surfacing */ }
    };
    const id = setInterval(tick, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, deps);
};

