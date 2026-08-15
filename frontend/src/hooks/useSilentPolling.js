// useSilentPolling — background-refresh a fetcher on an interval without
// disrupting the user. Three guarantees:
//   1) NEVER touches a `loading` state — the caller manages that.
//   2) Skips the tick when the user is actively typing in a form (focus
//      inside <input>, <textarea>, or a contenteditable within the CMS main).
//   3) Only invokes setData when the fetched payload actually changed
//      (JSON.stringify diff) so React doesn't re-render on identical polls.
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

export const useSilentPolling = (fetcher, setData, intervalMs = 15000, deps = []) => {
  const lastHash = useRef("");
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
        lastHash.current = hash;
        setData(data);
      } catch { /* silent: caller decides on error surfacing */ }
    };
    const id = setInterval(tick, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, deps);
};
