import { useEffect } from "react";

const SITE = "https://sheet-converter-68.preview.emergentagent.com";
const DEFAULT_OG_IMAGE = "https://customer-assets-gfyr7b9c.emergentagent.net/job_sheet-converter-68/artifacts/0iemi3i5_PearBlue%20logo-04.webp";

const setMeta = (attr, name, content) => {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
};

const setLink = (rel, href) => {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
};

export const usePageSeo = ({ title, description, path = "", image = DEFAULT_OG_IMAGE, type = "website" }) => {
  useEffect(() => {
    const fullTitle = title ? `${title} · PearBlue` : "PearBlue — Jouw Complete Digitale Partner";
    document.title = fullTitle;
    const url = `${SITE}${path}`;
    setMeta("name", "description", description);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:type", type);
    setMeta("property", "og:image", image);
    setMeta("property", "og:site_name", "PearBlue");
    setMeta("property", "og:locale", "nl_NL");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image);
    setLink("canonical", url);
  }, [title, description, path, image, type]);
};
