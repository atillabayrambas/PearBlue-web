import React, { useEffect, useRef } from "react";

/**
 * Full-viewport parallax pear background.
 * - Fixed cover across the whole viewport (not just a corner).
 * - Very subtle: opacity ~0.05 (in the 1-6% range).
 * - Gentle scroll drift creates parallax without motion sickness.
 * - Auto-hides on /admin routes.
 */
const LOGO_URL = "https://customer-assets-gfyr7b9c.emergentagent.net/job_sheet-converter-68/artifacts/4u2log8q_PearBlue%20logo-10.webp";

export const ParallaxBackground = () => {
  const ref = useRef(null);
  const location = typeof window !== "undefined" ? window.location.pathname : "";

  useEffect(() => {
    let raf = 0;
    let latest = 0;
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      latest = window.scrollY || window.pageYOffset;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          const drift = Math.min(latest * 0.08, 220);
          const scale = 1 + Math.min(latest * 0.00005, 0.03);
          el.style.transform = `translate3d(0, ${-drift}px, 0) scale(${scale})`;
          raf = 0;
        });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  if (location.startsWith("/admin")) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      data-testid="parallax-bg"
    >
      {/* Main stretched watermark — covers full viewport at low opacity */}
      <div
        ref={ref}
        className="absolute inset-0 opacity-[0.06] will-change-transform select-none"
        style={{
          backgroundImage: `url("${LOGO_URL}")`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          transformOrigin: "center center",
        }}
      />
      {/* Secondary softer layer for texture depth */}
      <div
        className="absolute inset-0 opacity-[0.03] select-none"
        style={{
          backgroundImage: `url("${LOGO_URL}")`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "auto 130vh",
          backgroundPosition: "center 20%",
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
};
