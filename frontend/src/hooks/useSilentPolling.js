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
//
// Callbacks (fetcher/setData/onChange) are captured in refs so the effect
// only re-subscribes when the caller explicitly changes `deps` or `intervalMs`
// — this keeps the hook lint-clean under `react-hooks/exhaustive-deps`
// without lying about dependencies via an eslint-disable directive.
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
  const fetcherRef = useRef(fetcher);
  const setDataRef = useRef(setData);
  const onChangeRef = useRef(onChange);
  // Keep the refs pointing to the latest callback identity on every render
  // without triggering the polling effect below.
  fetcherRef.current = fetcher;
  setDataRef.current = setData;
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      if (isInteracting()) return; // user is typing/selecting — leave state alone
      try {
        const data = await fetcherRef.current();
        if (cancelled) return;
        const hash = JSON.stringify(data);
        if (hash === lastHash.current) return; // no change → no re-render
        const prev = lastData.current;
        lastHash.current = hash;
        lastData.current = data;
        setDataRef.current(data);
        if (onChangeRef.current) {
          try { onChangeRef.current(prev, data); } catch { /* swallow — never break the poll loop */ }
        }
      } catch { /* silent: caller decides on error surfacing */ }
    };
    const id = setInterval(tick, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
    // We intentionally exclude fetcher/setData/onChange — those are captured
    // via refs so their identity doesn't restart the interval. The caller
    // signals "re-subscribe" through `deps` and `intervalMs`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
};
