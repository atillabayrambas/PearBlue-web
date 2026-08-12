// Shared helpers and small components used across the Admin CMS split files.
// Extracted from the original AdminDashboard.jsx as part of the modular refactor.
import React from "react";
import { Avatar } from "../Avatar";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const PEARBLUE_LOGO = "https://customer-assets-gfyr7b9c.emergentagent.net/job_sheet-converter-68/artifacts/djwgz9jk_PearBlue%20logo-10.webp";

// Helper to read auth token straight from localStorage (used inside effects
// that fire before `useAuth` context is available).
export const authHeaderFromStorage = () => {
  const t = localStorage.getItem("pb_admin_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// Turn "chat_support" → "Chat support"; "super_admin" → "Super admin"
export const prettyRole = (r) => (r || "").split("_").map((w) => w ? w[0].toUpperCase() + w.slice(1) : "").join(" ").trim();

// Preferred display label for an assignee row from /api/admin/assignees.
// Prefers "First Last"; falls back to display_name; only falls back to email
// when nothing else is available.
export const assigneeLabel = (a) => {
  if (!a) return "—";
  const full = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (a.display_name && !a.display_name.includes("@")) return a.display_name;
  const email = a.email || "";
  const local = email.split("@")[0] || email;
  return local;
};

// Small chip showing an assignee's avatar + name + role. Used in the CMS lists.
export const AssigneeChip = ({ email, assignees, size = 24 }) => {
  if (!email) return <span className="text-[10px] text-muted-fg italic">Niet toegewezen</span>;
  const a = (assignees || []).find((x) => x.email === email);
  const name = assigneeLabel(a) || email;
  return (
    <span className="inline-flex items-center gap-1.5" data-testid={`assignee-chip-${email}`}>
      <Avatar name={name} email={email} profilePicture={a?.profile_picture} size={size} />
      <span className="text-[11px] leading-tight">
        <span className="text-strong font-medium block truncate max-w-[140px]">{name}</span>
        {a?.role && <span className="text-muted-fg text-[10px] block">{prettyRole(a.role)}</span>}
      </span>
    </span>
  );
};

// Stars rating row (used in Reviews)
import { Star } from "lucide-react";
export const StarsRow = ({ n }) => (
  <div className="flex items-center gap-0.5 text-pear-500">
    {[...Array(5)].map((_, i) => (
      <Star key={i} className={`h-3.5 w-3.5 ${i < n ? "fill-current" : "opacity-25"}`} />
    ))}
  </div>
);

// Role labels — shared between UsersAdmin form and role table
export const ROLE_LABELS = {
  super_admin: "Super administrator",
  beheerder: "Beheerder",
  analist: "Analist",
  moderator: "Moderator",
  chat_support: "Chat support",
  financien: "Financiën",
  crm: "CRM (Customer Relationship)",
  gebruiker: "Gebruiker",
  admin: "Beheerder (legacy)",
};

// Random pear-and-robot themed avatar generator using DiceBear (bots) with a pear-fresh palette.
const RANDOM_AVATAR_PALETTES = ["02c0ff", "6ee7b7", "34d399", "10b981", "0891b2", "22d3ee", "34e0a1", "84cc16"];
export const generatePearAvatar = (seed) => {
  const s = encodeURIComponent(seed || String(Math.random()).slice(2, 10));
  const bg = RANDOM_AVATAR_PALETTES[Math.floor(Math.random() * RANDOM_AVATAR_PALETTES.length)];
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${s}&backgroundColor=${bg}&scale=90`;
};

// Message list status & priority constants
export const MSG_STATUS = [
  { key: "new", label: "Nieuw", color: "bg-red-100 text-red-600" },
  { key: "in_progress", label: "In behandeling", color: "bg-amber-100 text-amber-700" },
  { key: "on_hold", label: "Hold", color: "bg-slate-100 text-slate-600" },
  { key: "done", label: "Afgerond", color: "bg-emerald-100 text-emerald-700" },
];
export const MSG_PRIORITY = [
  { key: "Major", label: "Major", color: "bg-red-600 text-white" },
  { key: "P1", label: "P1", color: "bg-red-500 text-white" },
  { key: "P2", label: "P2", color: "bg-amber-500 text-white" },
  { key: "P3", label: "P3", color: "bg-slate-400 text-white" },
  { key: "P4", label: "P4", color: "bg-slate-300 text-slate-700" },
];
export const priorityRank = (p) => ({ Major: 0, P1: 1, P2: 2, P3: 3, P4: 4 }[p] ?? 3);

export const STATUS_STYLE = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-pear-100 text-pear-700",
  rejected: "bg-red-100 text-red-700",
};

export const FEEDBACK_STATUS = [
  { key: "new", label: "Nieuw", color: "bg-red-100 text-red-600" },
  { key: "in_progress", label: "In behandeling", color: "bg-amber-100 text-amber-700" },
  { key: "on_hold", label: "On hold", color: "bg-slate-100 text-slate-600" },
  { key: "done", label: "Afgerond", color: "bg-emerald-100 text-emerald-700" },
];

export const REASON_LABEL = {
  rate_limit: "Rate limit",
  spam: "Spam",
  honeypot: "Honeypot",
  captcha: "Captcha",
  manual_block: "Handmatig geblokkeerd",
  unknown: "Onbekend",
};

// Portfolio (Projects) constants
export const CATEGORIES = [
  { key: "media", label: "Media" },
  { key: "ecom", label: "E-commerce" },
  { key: "infra", label: "Infrastructuur" },
  { key: "sec", label: "Security" },
  { key: "ai", label: "AI" },
  { key: "corp", label: "Corporate" },
];
export const emptyProjectForm = { title: "", category: "media", tag: "", description: "", image_url: "", external_url: "" };

// User column config (Users & roles table)
export const USER_COL_DEFS = [
  { key: "email", label: "E-mail", labelEn: "Email", default: true, fixed: true },
  { key: "name", label: "Voor- en achternaam", labelEn: "First & last name", default: true },
  { key: "role", label: "Rol", labelEn: "Role", default: true },
  { key: "company", label: "Bedrijf", labelEn: "Company", default: true },
  { key: "phone", label: "Telefoon", labelEn: "Phone", default: false },
  { key: "city", label: "Plaats", labelEn: "City", default: false },
  { key: "country", label: "Land", labelEn: "Country", default: false },
  { key: "zoho", label: "Zoho", labelEn: "Zoho", default: true },
];

export const readUserCols = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("pb_user_cols") || "null");
    if (Array.isArray(stored)) return stored;
  } catch { /* ignore */ }
  return USER_COL_DEFS.filter((c) => c.default).map((c) => c.key);
};
