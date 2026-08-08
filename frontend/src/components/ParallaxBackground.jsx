import React, { useEffect, useRef } from "react";

/**
 * Very subtle parallax background using the PearBlue pear logo.
 * Opacity kept between 4-5% so the pear + squares are visible but not distracting.
 * Uses requestAnimationFrame + transform for a smooth, non-nauseating scroll effect.
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
          // Very subtle upward drift — 6% of scroll speed, capped.
          const y = Math.min(latest * 0.06, 120);
          el.style.transform = `translate3d(0, ${-y}px, 0)`;
          raf = 0;
        });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Hide on admin routes — the CMS should feel clean and dense.
  if (location.startsWith("/admin")) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      data-testid="parallax-bg"
    >
      <div
        ref={ref}
        className="absolute -top-20 right-[-8%] w-[90vw] max-w-[900px] aspect-[3/4] opacity-[0.045] will-change-transform select-none"
        style={{
          backgroundImage: `url("${LOGO_URL}")`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "contain",
          backgroundPosition: "top right",
        }}
      />
    </div>
  );
};
