import React, { useEffect, useRef } from "react";

const TRUSTPILOT_BUSINESS_UNIT_ID = process.env.REACT_APP_TRUSTPILOT_BUSINESS_UNIT_ID || "";
const TRUSTPILOT_REVIEW_URL = process.env.REACT_APP_TRUSTPILOT_REVIEW_URL || "";

// Free Trustpilot embed — no API key needed. TrustBox loads reviews client-side
// via Trustpilot's bootstrap script (widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js).
// To activate: set REACT_APP_TRUSTPILOT_BUSINESS_UNIT_ID (find in Trustpilot Business dashboard →
// Settings → Integrations → TrustBoxes → any snippet contains data-businessunit-id="XXXX").
export const TrustpilotWidget = () => {
  const ref = useRef(null);

  useEffect(() => {
    if (!TRUSTPILOT_BUSINESS_UNIT_ID) return;
    const SRC = "https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js";
    if (!document.querySelector(`script[src="${SRC}"]`)) {
      const s = document.createElement("script");
      s.src = SRC; s.async = true;
      document.head.appendChild(s);
    }
    // Re-init the widget after mount
    const t = setTimeout(() => {
      if (window.Trustpilot && ref.current) window.Trustpilot.loadFromElement(ref.current, true);
    }, 800);
    return () => clearTimeout(t);
  }, []);

  if (!TRUSTPILOT_BUSINESS_UNIT_ID) return null;

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12" data-testid="trustpilot-widget-section">
      <div className="max-w-2xl mb-8">
        <p className="overline mb-3">Onafhankelijke reviews</p>
        <h2 className="font-heading text-3xl sm:text-4xl font-medium tracking-tight text-strong">Bekijk ons op Trustpilot</h2>
      </div>
      <div
        ref={ref}
        className="trustpilot-widget"
        data-locale="nl-NL"
        data-template-id="5419b6ffb0d04a076446a9af"
        data-businessunit-id={TRUSTPILOT_BUSINESS_UNIT_ID}
        data-style-height="240px"
        data-style-width="100%"
        data-theme="light"
      >
        <a href={TRUSTPILOT_REVIEW_URL || "#"} target="_blank" rel="noreferrer">Trustpilot</a>
      </div>
    </section>
  );
};
