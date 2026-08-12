import { useCallback, useRef } from "react";

// Match a NL postcode anywhere in a free-text address.
export const NL_POSTCODE_RE = /(\d{4}\s?[A-Za-z]{2})/;
export const extractNlPostcode = (text) => {
  const m = String(text || "").match(NL_POSTCODE_RE);
  return m ? m[1].replace(/\s+/g, "").toUpperCase() : null;
};
// Extract a leading house number after a street name (e.g. "Havenstraat 12b" → "12b").
export const extractHouseNumber = (address) => {
  const m = String(address || "").match(/\b(\d{1,5}[a-zA-Z]?)\b/);
  return m ? m[1] : null;
};

// Country-code → human-readable label for the plain-text location display.
// Keep short — we only surface the code + flag emoji.
const CODE_TO_NAME = {
  NL: "Nederland", BE: "België", DE: "Duitsland", FR: "Frankrijk", GB: "Verenigd Koninkrijk",
  US: "United States", CA: "Canada", ES: "Spanje", IT: "Italië", AT: "Oostenrijk",
  CH: "Zwitserland", LU: "Luxemburg", PT: "Portugal", IE: "Ierland", DK: "Denemarken",
  SE: "Zweden", NO: "Noorwegen", FI: "Finland", PL: "Polen", CZ: "Tsjechië",
  AU: "Australië", NZ: "Nieuw-Zeeland", MX: "Mexico", BR: "Brazilië", ZA: "Zuid-Afrika",
  JP: "Japan", CN: "China", IN: "India",
};
const nameFor = (cc) => CODE_TO_NAME[String(cc || "").toUpperCase()] || (cc ? String(cc).toUpperCase() : "");

// ISO-2 code → flag emoji using regional-indicator symbols. Returns 🌍 when unknown.
export const isoToFlag = (iso) => {
  const s = String(iso || "").toUpperCase();
  if (s.length !== 2) return "🌍";
  return String.fromCodePoint(...[...s].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
};

// Heuristic: given a country_code + free-text country name, return the best
// ISO-2 code we can. Used on legacy user records that only stored country name.
export const guessCountryCodeFrom = (code, name) => {
  const c = String(code || "").toUpperCase();
  if (c && c.length === 2) return c;
  const n = String(name || "").toLowerCase();
  if (!n) return "";
  if (/nederland|netherlands/.test(n)) return "NL";
  if (/belg/.test(n)) return "BE";
  if (/deutschland|germany|duitsland/.test(n)) return "DE";
  if (/france|frankrijk/.test(n)) return "FR";
  if (/united states|verenigd staten|america|verenigde/.test(n)) return "US";
  if (/united kingdom|verenigd konink|britain|england/.test(n)) return "GB";
  if (/canada/.test(n)) return "CA";
  if (/spain|spanje|espa/.test(n)) return "ES";
  if (/italy|italia|italië/.test(n)) return "IT";
  if (/portugal/.test(n)) return "PT";
  if (/austria|oostenrijk/.test(n)) return "AT";
  if (/switzerland|zwitserland|schweiz/.test(n)) return "CH";
  if (/luxembourg|luxemburg/.test(n)) return "LU";
  if (/ireland|ierland/.test(n)) return "IE";
  if (/denmark|denemarken/.test(n)) return "DK";
  if (/sweden|zweden/.test(n)) return "SE";
  if (/norway|noorwegen/.test(n)) return "NO";
  if (/finland/.test(n)) return "FI";
  if (/poland|polen/.test(n)) return "PL";
  if (/czech|tsjech/.test(n)) return "CZ";
  if (/australia|australië/.test(n)) return "AU";
  if (/new zealand|nieuw-zeeland/.test(n)) return "NZ";
  if (/mexico/.test(n)) return "MX";
  if (/brazil|brazil/.test(n)) return "BR";
  if (/south africa|zuid-afrika/.test(n)) return "ZA";
  if (/japan/.test(n)) return "JP";
  if (/china/.test(n)) return "CN";
  if (/india/.test(n)) return "IN";
  return "";
};

// Convenience: accept the whole user/profile object and pick country_code first.
export const guessCountryCode = (obj) => guessCountryCodeFrom(obj?.country_code, obj?.country);

// Detect the country of a postcode from its shape. Only truly unambiguous
// formats claim a specific country (NL letters, UK/CA alphanumeric). All
// 4-5 digit numeric codes are treated as ambiguous — the lookup cascade then
// probes EU providers first (DE→FR→IT→ES→AT→BE→US) so European customers
// don't get accidentally routed to the wrong continent.
export const detectPostcodeCountry = (raw) => {
  const pc = String(raw || "").trim().toUpperCase();
  if (!pc) return null;
  if (/^\d{4}\s?[A-Z]{2}$/.test(pc)) return "NL";
  if (/^\d{5}-\d{4}$/.test(pc)) return "US"; // ZIP+4 is unambiguous US
  if (/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(pc)) return "GB"; // UK: SW1A 1AA
  if (/^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/.test(pc)) return "CA"; // K1A 0A6
  if (/^\d{4}$/.test(pc)) return "AMBIGUOUS_4"; // BE / AT / DK / NO / CH / AU / HU
  if (/^\d{5}$/.test(pc)) return "AMBIGUOUS_5"; // DE / FR / IT / ES / US / TR / FI
  return "UNKNOWN";
};

/**
 * Postal-code + address → straat + plaats + regio + land auto-fill.
 * Sequence:
 *   1. NL postcodes → postcode.tech (fastest + provincie + straat).
 *   2. If we also have a street/address string of ≥5 chars → Nominatim (OSM)
 *      which disambiguates the country from the full address (best result
 *      when both postcode and street are known — e.g. same postcode exists
 *      in DE and US, but "10th Ave" + "10001" resolves cleanly to NYC).
 *   3. Zippopotam.us probe cascade — NL/DE/US/FR/GB/BE/... — as fallback
 *      when only the postcode is known.
 *   4. Nominatim postcode-only as last resort.
 *
 * Contract:
 *   const { lookup } = usePostalLookup();
 *   const result = await lookup("9711AA", "12", "Havenstraat");
 *   // { street, city, region, country, country_name, lat, lng } | null
 */
export function usePostalLookup() {
  const cacheRef = useRef({});

  const lookup = useCallback(async (postcode, houseNumber, address, preferredCountry) => {
    const raw = String(postcode || "").trim();
    if (!raw) return null;
    const pcCompact = raw.replace(/\s+/g, "").toUpperCase();
    const hn = String(houseNumber || "").trim();
    const addr = String(address || "").trim();
    const preferred = String(preferredCountry || "").trim().toLowerCase();
    const key = `${pcCompact}|${hn}|${addr.slice(0, 30)}|${preferred}`;
    if (cacheRef.current[key]) return cacheRef.current[key];

    const detected = detectPostcodeCountry(pcCompact);

    // ---- 1) NL fast-path via postcode.tech ----
    if (detected === "NL") {
      try {
        const url = `https://postcode.tech/api/v1/postcode/full?postcode=${pcCompact}${hn ? `&number=${encodeURIComponent(hn)}` : ""}`;
        const r = await fetch(url, { headers: { "Accept": "application/json" } });
        if (r.ok) {
          const d = await r.json();
          if (d && d.postcode) {
            const out = {
              street: d.street || "",
              city: d.city || "",
              region: d.province || "",
              country: "NL",
              country_name: d.country || "Nederland",
              lat: d.geo?.lat || null,
              lng: d.geo?.lon || null,
            };
            cacheRef.current[key] = out;
            return out;
          }
        }
      } catch { /* ignore */ }
    }

    // ---- 2) Nominatim structured lookup — postcode + street produces the
    // best matches worldwide (each is passed as its own field so Nominatim
    // doesn't fuzzy-match the postcode into a street name). When a preferred
    // country was passed (e.g. from the "Change" dropdown), constrain the
    // search to that country so ambiguous postcodes resolve correctly. ----
    if (addr && addr.replace(/\s+/g, "").length >= 3) {
      try {
        const streetParam = `${hn ? hn + " " : ""}${addr}`.trim();
        const countryParam = preferred ? `&countrycodes=${preferred}` : "";
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&postalcode=${encodeURIComponent(pcCompact)}&street=${encodeURIComponent(streetParam)}${countryParam}`;
        const r = await fetch(url, { headers: { "Accept": "application/json" } });
        if (r.ok) {
          const arr = await r.json();
          const hit = Array.isArray(arr) && arr[0];
          if (hit) {
            const a = hit.address || {};
            const cc = (a.country_code || "").toUpperCase();
            const out = {
              street: a.road || a.pedestrian || "",
              city: a.city || a.town || a.village || a.municipality || a.hamlet || "",
              region: a.state || a.region || "",
              country: cc,
              country_name: a.country || nameFor(cc),
              lat: parseFloat(hit.lat) || null,
              lng: parseFloat(hit.lon) || null,
            };
            cacheRef.current[key] = out;
            return out;
          }
        }
      } catch { /* fall through */ }
    }

    // ---- 3) Zippopotam.us probe cascade ----
    const zipCandidates = (() => {
      const pcSpaced = raw.toUpperCase();
      const list = [];
      const add = (cc, pc) => list.push([cc, pc]);
      // Preferred country from the CMS/portal dropdown always tried first.
      if (preferred) add(preferred, pcCompact);
      switch (detected) {
        case "US": add("us", pcCompact.split("-")[0]); break;
        case "GB": {
          const outward = pcCompact.replace(/\s+/g, "").slice(0, -3);
          if (outward) add("gb", outward);
          add("gb", pcSpaced.split(" ")[0]);
          break;
        }
        case "CA": add("ca", pcSpaced.slice(0, 3)); break;
        case "NL": add("nl", pcCompact.slice(0, 4)); break;
        case "AMBIGUOUS_4":
          ["be", "at", "dk", "no", "ch", "au", "hu"].forEach((cc) => add(cc, pcCompact));
          break;
        case "AMBIGUOUS_5":
          // No address context → EU-first (Dutch market bias), US last.
          ["de", "fr", "it", "es", "at", "us", "fi", "tr"].forEach((cc) => add(cc, pcCompact));
          break;
        default:
          ["de", "fr", "gb", "us", "be", "at", "ch", "es", "it", "pt", "au"].forEach((cc) => add(cc, pcCompact));
      }
      return list;
    })();

    for (const [cc, pc] of zipCandidates) {
      try {
        const r = await fetch(`https://api.zippopotam.us/${cc}/${encodeURIComponent(pc)}`, { headers: { "Accept": "application/json" } });
        if (!r.ok) continue;
        const d = await r.json();
        const place = Array.isArray(d.places) && d.places[0];
        if (!place) continue;
        const country_iso = (d["country abbreviation"] || cc).toUpperCase();
        const out = {
          street: "",
          city: place["place name"] || "",
          region: place["state"] || place["state abbreviation"] || "",
          country: country_iso,
          country_name: d.country || nameFor(country_iso),
          lat: parseFloat(place.latitude) || null,
          lng: parseFloat(place.longitude) || null,
        };
        cacheRef.current[key] = out;
        return out;
      } catch { /* try next */ }
    }

    // ---- 4) Nominatim postcode-only fallback ----
    try {
      const q = `${raw}${hn ? ` ${hn}` : ""}`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { "Accept": "application/json" } });
      if (r.ok) {
        const arr = await r.json();
        const hit = Array.isArray(arr) && arr[0];
        if (hit) {
          const a = hit.address || {};
          const cc = (a.country_code || "").toUpperCase();
          const out = {
            street: a.road || a.pedestrian || "",
            city: a.city || a.town || a.village || a.municipality || a.hamlet || "",
            region: a.state || a.region || "",
            country: cc,
            country_name: a.country || nameFor(cc),
            lat: parseFloat(hit.lat) || null,
            lng: parseFloat(hit.lon) || null,
          };
          cacheRef.current[key] = out;
          return out;
        }
      }
    } catch { /* ignore */ }

    return null;
  }, []);

  return { lookup };
}
