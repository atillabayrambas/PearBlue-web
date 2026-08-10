import { useEffect } from "react";

/**
 * Lock the underlying page scroll while a modal or drawer is open.
 * Adds/removes `.pb-lock-scroll` on <body>, which is CSS-driven so the
 * floating chatbot launcher also hides itself on mobile.
 */
export function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.classList.add("pb-lock-scroll");
    return () => {
      document.body.classList.remove("pb-lock-scroll");
      document.body.style.overflow = prevOverflow;
    };
  }, [active]);
}
