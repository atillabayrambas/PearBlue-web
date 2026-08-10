import React from "react";

// Pear-themed avatar with initials fallback when no profile_picture is set.
// Deterministic gradient color from the person's name so the same user always
// gets the same colour across pages.
export const Avatar = ({ name, email, profilePicture, size = 32 }) => {
  const label = (name || email || "?").trim();
  const initials = label.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const hash = [...label].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  const hue = Math.abs(hash) % 360;
  return profilePicture ? (
    <img
      src={profilePicture}
      alt={label}
      width={size}
      height={size}
      className="rounded-full object-cover"
      data-testid="user-avatar"
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center font-heading font-semibold text-white shadow-sm shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 65% 45%))`,
        fontSize: Math.max(10, size * 0.4),
      }}
      data-testid="user-avatar-initials"
    >{initials}</div>
  );
};

export default Avatar;
