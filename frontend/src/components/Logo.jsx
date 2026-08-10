import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";

// Two new logos: light theme (dark text) and dark theme (white text). Blue pear stays original.
const LOGO_LIGHT = "https://customer-assets-gfyr7b9c.emergentagent.net/job_sheet-converter-68/artifacts/q9h768hj_PearBlue%20logo-03.webp"; // dark text — for light theme
const LOGO_DARK = "https://customer-assets-gfyr7b9c.emergentagent.net/job_sheet-converter-68/artifacts/0iemi3i5_PearBlue%20logo-04.webp"; // white/light text — for dark theme
const LOGO_ICON_ONLY = "https://customer-assets-gfyr7b9c.emergentagent.net/job_sheet-converter-68/artifacts/djwgz9jk_PearBlue%20logo-10.webp"; // pear-only, no text

export const Logo = ({ size = 40, showText = true, iconOnly = false, className = "" }) => {
  const { resolved } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const src = iconOnly ? LOGO_ICON_ONLY : (resolved === "dark" ? LOGO_DARK : LOGO_LIGHT);

  // If we're already on '/', clicking the logo should refresh the page
  // (scroll-to-top on same route feels broken; a hard reload gives a clear
  // "back to start" moment as the user expects).
  const onClick = (e) => {
    if (location.pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      // Small delay so the smooth scroll starts before the reload interrupts it
      setTimeout(() => window.location.reload(), 200);
    } else {
      // Different route → let React Router navigate then scroll to top
      e.preventDefault();
      navigate("/");
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  return (
    <Link to="/" onClick={onClick} className={`inline-flex items-center ${className}`} data-testid="brand-logo" aria-label="PearBlue home">
      {(showText && !iconOnly) ? (
        <img src={src} alt="PearBlue" style={{ height: size }} className="w-auto" />
      ) : iconOnly ? (
        <img src={LOGO_ICON_ONLY} alt="PearBlue" style={{ height: size }} className="w-auto" />
      ) : (
        <span
          className="relative block overflow-hidden shrink-0"
          style={{ width: size, height: size }}
          aria-hidden="true"
        >
          <img
            src={src}
            alt=""
            style={{
              height: size,
              width: "auto",
              maxWidth: "none",
              objectFit: "cover",
              objectPosition: "left center",
              position: "absolute",
              left: 0,
              top: 0,
            }}
          />
        </span>
      )}
    </Link>
  );
};
