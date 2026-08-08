import { useEffect } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Fetches custom header/footer scripts configured by super-admins and injects them
 * into the DOM. Runs once on app mount.
 */
export const CustomScriptsInjector = () => {
  useEffect(() => {
    axios.get(`${API}/site/scripts`).then((r) => {
      const { header_scripts, footer_scripts } = r.data || {};
      const injectInto = (parent, html, marker) => {
        if (!html || !parent) return;
        if (parent.querySelector(`[data-pb-script="${marker}"]`)) return;
        const wrap = document.createElement("div");
        wrap.setAttribute("data-pb-script", marker);
        wrap.innerHTML = html;
        // Move each element into the parent so <script> tags execute
        Array.from(wrap.childNodes).forEach((node) => {
          if (node.tagName === "SCRIPT") {
            const s = document.createElement("script");
            for (const attr of node.attributes) s.setAttribute(attr.name, attr.value);
            s.text = node.textContent;
            s.setAttribute("data-pb-script", marker);
            parent.appendChild(s);
          } else {
            const clone = node.cloneNode(true);
            if (clone.setAttribute) clone.setAttribute("data-pb-script", marker);
            parent.appendChild(clone);
          }
        });
      };
      injectInto(document.head, header_scripts, "header");
      injectInto(document.body, footer_scripts, "footer");
    }).catch(() => {});
  }, []);
  return null;
};
