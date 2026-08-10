import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

// Curated list of dial codes with flag emojis. Sorted with most common EU first,
// then A-Z. The value stored/sent is always a single string like "+31612345678".
export const DIAL_CODES = [
  { code: "NL", dial: "+31", flag: "🇳🇱", label: "Nederland" },
  { code: "BE", dial: "+32", flag: "🇧🇪", label: "België" },
  { code: "DE", dial: "+49", flag: "🇩🇪", label: "Deutschland" },
  { code: "FR", dial: "+33", flag: "🇫🇷", label: "France" },
  { code: "GB", dial: "+44", flag: "🇬🇧", label: "United Kingdom" },
  { code: "IE", dial: "+353", flag: "🇮🇪", label: "Ireland" },
  { code: "LU", dial: "+352", flag: "🇱🇺", label: "Luxembourg" },
  { code: "ES", dial: "+34", flag: "🇪🇸", label: "España" },
  { code: "IT", dial: "+39", flag: "🇮🇹", label: "Italia" },
  { code: "PT", dial: "+351", flag: "🇵🇹", label: "Portugal" },
  { code: "AT", dial: "+43", flag: "🇦🇹", label: "Österreich" },
  { code: "CH", dial: "+41", flag: "🇨🇭", label: "Schweiz" },
  { code: "DK", dial: "+45", flag: "🇩🇰", label: "Danmark" },
  { code: "SE", dial: "+46", flag: "🇸🇪", label: "Sverige" },
  { code: "NO", dial: "+47", flag: "🇳🇴", label: "Norge" },
  { code: "FI", dial: "+358", flag: "🇫🇮", label: "Suomi" },
  { code: "PL", dial: "+48", flag: "🇵🇱", label: "Polska" },
  { code: "CZ", dial: "+420", flag: "🇨🇿", label: "Česko" },
  { code: "US", dial: "+1", flag: "🇺🇸", label: "United States" },
  { code: "CA", dial: "+1", flag: "🇨🇦", label: "Canada" },
  { code: "AU", dial: "+61", flag: "🇦🇺", label: "Australia" },
  { code: "IN", dial: "+91", flag: "🇮🇳", label: "India" },
  { code: "JP", dial: "+81", flag: "🇯🇵", label: "Japan" },
  { code: "CN", dial: "+86", flag: "🇨🇳", label: "China" },
  { code: "BR", dial: "+55", flag: "🇧🇷", label: "Brasil" },
  { code: "MX", dial: "+52", flag: "🇲🇽", label: "México" },
  { code: "AR", dial: "+54", flag: "🇦🇷", label: "Argentina" },
  { code: "ZA", dial: "+27", flag: "🇿🇦", label: "South Africa" },
  { code: "MA", dial: "+212", flag: "🇲🇦", label: "Maroc" },
  { code: "TR", dial: "+90", flag: "🇹🇷", label: "Türkiye" },
  { code: "AE", dial: "+971", flag: "🇦🇪", label: "UAE" },
];

/**
 * Parse a stored E.164-ish value ("+31612345678") into { dial, national }.
 */
export const parsePhone = (value) => {
  const v = String(value || "").trim();
  if (!v) return { dial: "+31", national: "" };
  const match = DIAL_CODES
    .slice()
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => v.startsWith(c.dial));
  if (match) return { dial: match.dial, national: v.slice(match.dial.length).trim() };
  if (v.startsWith("+")) {
    const m = v.match(/^(\+\d{1,4})\s*(.*)$/);
    if (m) return { dial: m[1], national: m[2] };
  }
  return { dial: "+31", national: v };
};

/**
 * Themed phone input with dial-code picker (flag + code) + local number field.
 * onChange emits the combined E.164 string, e.g. "+31612345678".
 */
export const PhoneInput = ({ value, onChange, name = "phone", placeholder = "612345678", disabled = false, testid = "phone-input" }) => {
  const { dial: initialDial, national: initialNational } = parsePhone(value);
  const [dial, setDial] = useState(initialDial);
  const [national, setNational] = useState(initialNational);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const cleaned = national.replace(/\D/g, "");
    const combined = cleaned ? `${dial}${cleaned}` : "";
    onChange?.(combined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dial, national]);

  const cur = DIAL_CODES.find((c) => c.dial === dial) || DIAL_CODES[0];
  const filtered = search
    ? DIAL_CODES.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()) || c.dial.includes(search) || c.code.toLowerCase().includes(search.toLowerCase()))
    : DIAL_CODES;

  return (
    <div ref={wrapRef} className="relative" data-testid={testid}>
      <div className="flex rounded-lg border border-app surface overflow-hidden focus-within:border-pear-500">
        <button
          type="button"
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
          className="flex items-center gap-1.5 px-3 py-2 hover:bg-pear-100/40 border-r border-app text-sm text-strong disabled:opacity-40"
          data-testid={`${testid}-dial-toggle`}
        >
          <span className="text-base leading-none">{cur.flag}</span>
          <span className="font-mono">{cur.dial}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
        <input
          type="tel"
          name={name}
          value={national}
          onChange={(e) => setNational(e.target.value.replace(/[^\d\s-]/g, ""))}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 px-3 py-2 text-sm outline-none surface"
          data-testid={`${testid}-national`}
        />
      </div>
      {open && (
        <div className="absolute z-40 mt-1 w-72 max-h-72 overflow-y-auto surface border border-app rounded-2xl shadow-xl p-1.5" data-testid={`${testid}-menu`}>
          <div className="relative mb-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-fg" aria-hidden="true" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek land of code…"
              className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg border border-app surface-2"
              data-testid={`${testid}-search`}
            />
          </div>
          {filtered.map((c) => (
            <button
              key={`${c.code}-${c.dial}`}
              type="button"
              onClick={() => { setDial(c.dial); setOpen(false); setSearch(""); }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-pear-100/50 ${dial === c.dial ? "bg-pear-100 text-pear-700" : "text-strong"}`}
              data-testid={`${testid}-option-${c.code}`}
            >
              <span className="text-base leading-none">{c.flag}</span>
              <span className="flex-1 text-left truncate">{c.label}</span>
              <span className="font-mono text-muted-fg">{c.dial}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="p-3 text-xs text-muted-fg text-center">Geen resultaten</p>}
        </div>
      )}
    </div>
  );
};
