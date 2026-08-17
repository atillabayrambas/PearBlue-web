import React from "react";
import {
  FaLinkedinIn,
  FaFacebookF,
  FaInstagram,
  FaXTwitter,
  FaYoutube,
  FaTiktok,
  FaWhatsapp,
  FaTelegram,
  FaSignalMessenger,
  FaDiscord,
  FaGithub,
  FaGitlab,
  FaBehance,
  FaDribbble,
  FaMedium,
  FaMastodon,
  FaBluesky,
  FaThreads,
  FaVimeoV,
  FaTwitch,
  FaPinterestP,
  FaRedditAlien,
  FaGoogle,
  FaStar,
} from "react-icons/fa6";

// Curated list of channels — order = display order in the footer.
// Every entry maps the CMS field name (`social_*`) to a compact brand icon
// and a `title` for accessibility. Trustpilot has no dedicated icon in
// react-icons/fa6, so we reuse a filled star which matches its visual
// language (5 golden stars).
export const SOCIAL_CHANNELS = [
  { key: "social_linkedin", label: "LinkedIn", Icon: FaLinkedinIn },
  { key: "social_facebook", label: "Facebook", Icon: FaFacebookF },
  { key: "social_instagram", label: "Instagram", Icon: FaInstagram },
  { key: "social_twitter", label: "X (Twitter)", Icon: FaXTwitter },
  { key: "social_youtube", label: "YouTube", Icon: FaYoutube },
  { key: "social_tiktok", label: "TikTok", Icon: FaTiktok },
  { key: "social_whatsapp", label: "WhatsApp", Icon: FaWhatsapp },
  { key: "social_telegram", label: "Telegram", Icon: FaTelegram },
  { key: "social_signal", label: "Signal", Icon: FaSignalMessenger },
  { key: "social_discord", label: "Discord", Icon: FaDiscord },
  { key: "social_github", label: "GitHub", Icon: FaGithub },
  { key: "social_gitlab", label: "GitLab", Icon: FaGitlab },
  { key: "social_behance", label: "Behance", Icon: FaBehance },
  { key: "social_dribbble", label: "Dribbble", Icon: FaDribbble },
  { key: "social_medium", label: "Medium", Icon: FaMedium },
  { key: "social_mastodon", label: "Mastodon", Icon: FaMastodon },
  { key: "social_bluesky", label: "Bluesky", Icon: FaBluesky },
  { key: "social_threads", label: "Threads", Icon: FaThreads },
  { key: "social_vimeo", label: "Vimeo", Icon: FaVimeoV },
  { key: "social_twitch", label: "Twitch", Icon: FaTwitch },
  { key: "social_pinterest", label: "Pinterest", Icon: FaPinterestP },
  { key: "social_reddit", label: "Reddit", Icon: FaRedditAlien },
  { key: "social_trustpilot", label: "Trustpilot", Icon: FaStar },
  { key: "social_google_business", label: "Google Business", Icon: FaGoogle },
];

/**
 * SocialIcons — renders only the channels for which the admin has provided
 * a URL in Site Instellingen. Zero clutter when nothing is set up yet.
 */
export const SocialIcons = ({ settings, size = "sm" }) => {
  const sizes = size === "lg"
    ? "h-10 w-10 text-[15px]"
    : "h-9 w-9 text-[13px]";
  const active = SOCIAL_CHANNELS.filter((c) => {
    const v = settings?.[c.key];
    return typeof v === "string" && v.trim().length > 0;
  });
  if (!active.length) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid="social-icons">
      {active.map(({ key, label, Icon }) => (
        <a
          key={key}
          href={settings[key]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          data-testid={`social-icon-${key.replace("social_", "")}`}
          className={`${sizes} inline-flex items-center justify-center rounded-full border border-app surface-2 text-muted-fg hover:text-white hover:bg-pear-500 hover:border-pear-500 transition-colors`}
        >
          <Icon aria-hidden="true" />
        </a>
      ))}
    </div>
  );
};
