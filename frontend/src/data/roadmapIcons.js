// Curated Lucide-react icon whitelist for the About-page roadmap timeline
// and the matching CMS icon-picker. MUST stay in sync with
// `ROADMAP_ICON_WHITELIST` in `/app/backend/server.py`.
import {
  Globe, Wand2, Smartphone, Tablet, Gamepad2, Cpu,
  Rocket, Sparkles, Palette, ShieldCheck, Wrench,
  Layers, Star, Trophy, Award, Package, Zap, Brain,
  Cloud, Code, Database, MessageCircle, Lock, Leaf,
} from "lucide-react";

// Map of name → component. Anything unknown falls back to Sparkles so the
// CMS never renders an empty tile if the backend introduces a new icon.
export const ROADMAP_ICON_MAP = {
  Globe, Wand2, Smartphone, Tablet, Gamepad2, Cpu,
  Rocket, Sparkles, Palette, ShieldCheck, Wrench,
  Layers, Star, Trophy, Award, Package, Zap, Brain,
  Cloud, Code, Database, MessageCircle, Lock, Leaf,
};

export const ROADMAP_ICON_NAMES = Object.keys(ROADMAP_ICON_MAP);

export const iconFromName = (name) => ROADMAP_ICON_MAP[name] || Sparkles;
