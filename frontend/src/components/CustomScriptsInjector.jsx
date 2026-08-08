import { useEffect } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Client-side fallback injector for header/footer scripts.
 * PREFERRED path is SSR: the backend writes the scripts directly into
 * public/index.html between <!-- PB_HEADER_START --> ... <!-- PB_HEADER_END -->
 * markers (so third-party crawlers like Trustpilot can find them).
 * This component only runs when those markers are still empty.
 */
export const CustomScriptsInjector = () => {
  useEffect(() => {
    // Detect if SSR already placed scripts — if so, skip client-side injection.
    const headHtml = document.head.innerHTML;
    const bodyHtml = document.body.innerHTML;
    const headerPlaceholderEmpty = /<!-- PB_HEADER_START --><!-- PB_HEADER_END -->/.test(headHtml);
    const footerPlaceholderEmpty = /<!-- PB_FOOTER_START --><!-- PB_FOOTER_END -->/.test(bodyHtml);

    axios.get(`${API}/site/scripts`).then((r) => {
      const { header_scripts, footer_scripts } = r.data || {};
      const injectInto = (parent, html, marker) => {
        if (!html || !parent) return;
        if (parent.querySelector(`[data-pb-script="${marker}"]`)) return;
        // Use DOMParser so <meta>/<link>/<script> tags survive parsing
        // (a plain <div>.innerHTML strips head-only elements).
        const doc = new DOMParser().parseFromString(
          `<!doctype html><html><head>${html}</head><body>${html}</body></html>`,
          "text/html",
        );
        const source = parent === document.head ? doc.head : doc.body;
        Array.from(source.childNodes).forEach((node) => {
          if (node.tagName === "SCRIPT") {
            const s = document.createElement("script");
            for (const attr of node.attributes) s.setAttribute(attr.name, attr.value);
            s.text = node.textContent;
            s.setAttribute("data-pb-script", marker);
            parent.appendChild(s);
          } else if (node.nodeType === 1) {
            const clone = node.cloneNode(true);
            clone.setAttribute("data-pb-script", marker);
            parent.appendChild(clone);
          }
        });
      };
      if (headerPlaceholderEmpty) injectInto(document.head, header_scripts, "header");
      if (footerPlaceholderEmpty) injectInto(document.body, footer_scripts, "footer");
    }).catch(() => {});
  }, []);
  return null;
};
