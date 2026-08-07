import React from "react";
import { Link } from "react-router-dom";

const LOGO_URL = "https://customer-assets-lxgj4vgw.emergentagent.net/job_3b5c4d50-dd30-4d09-93b8-e113754c7368/artifacts/bxpfaweb_PearBlue-logo-04-scaled.webp";

export const Logo = ({ size = 36, showText = true, className = "" }) => {
  return (
    <Link to="/" className={`inline-flex items-center gap-3 ${className}`} data-testid="brand-logo">
      <span
        className="relative block overflow-hidden shrink-0"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {/* Crop just the pear glyph from the wide logo (blue stays original) */}
        <img
          src={LOGO_URL}
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
      {showText && (
        <span className="font-heading text-[1.35rem] font-semibold tracking-tight text-strong leading-none">
          Pear<span className="text-pear-500">Blue</span>
        </span>
      )}
    </Link>
  );
};
