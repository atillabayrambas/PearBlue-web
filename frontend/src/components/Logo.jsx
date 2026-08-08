import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";

// Two new logos: light theme (dark text) and dark theme (white text). Blue pear stays original.
const LOGO_LIGHT = "https://customer-assets-gfyr7b9c.emergentagent.net/job_sheet-converter-68/artifacts/0iemi3i5_PearBlue%20logo-04.webp"; // dark text — for light theme
const LOGO_DARK = "https://customer-assets-gfyr7b9c.emergentagent.net/job_sheet-converter-68/artifacts/q9h768hj_PearBlue%20logo-03.webp"; // light/white text — for dark theme

export const Logo = ({ size = 40, showText = true, className = "" }) => {
  const { resolved } = useTheme();
  const src = resolved === "dark" ? LOGO_DARK : LOGO_LIGHT;

  return (
    <Link to="/" className={`inline-flex items-center ${className}`} data-testid="brand-logo" aria-label="PearBlue home">
      {showText ? (
        <img src={src} alt="PearBlue" style={{ height: size }} className="w-auto" />
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
