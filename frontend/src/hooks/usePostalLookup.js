import { useCallback, useRef } from "react";

/**
 * Nederlandse postcode → straat + plaats + provincie auto-fill.
 * Uses the free postcode.tech API (no key required for demos, rate-limited).
 * Falls back to the free Nominatim (OpenStreetMap) geocoder if postcode.tech fails.
 *
 * Contract:
 *   const { lookup } = usePostalLookup();
 *   const result = await lookup("9711AA", "12");
 *   // { street, city, region, country, lat, lng } | null
 */
export function usePostalLookup() {
  const cacheRef = useRef({}); // key -> result

  const lookup = useCallback(async (postcode, houseNumber) => {
    const pc = String(postcode || "").replace(/\s+/g, "").toUpperCase();
    const hn = String(houseNumber || "").trim();
    if (!/^\d{4}[A-Z]{2}$/.test(pc)) return null;
    const key = `${pc}|${hn}`;
    if (cacheRef.current[key]) return cacheRef.current[key];

    // Try postcode.tech (free demo endpoint)
    try {
      const url = `https://postcode.tech/api/v1/postcode/full?postcode=${pc}${hn ? `&number=${encodeURIComponent(hn)}` : ""}`;
      const r = await fetch(url, { headers: { "Accept": "application/json" } });
      if (r.ok) {
        const d = await r.json();
        if (d && d.postcode) {
          const out = {
            street: d.street || "",
            city: d.city || "",
            region: d.province || "",
            country: "NL",
            lat: d.geo?.lat || null,
            lng: d.geo?.lon || null,
          };
          cacheRef.current[key] = out;
          return out;
        }
      }
    } catch { /* ignore */ }

    // Fallback: Nominatim (OSM) — slower, less accurate on region but always works
    try {
      const q = `${pc}${hn ? ` ${hn}` : ""} Netherlands`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { "Accept": "application/json" } });
      if (r.ok) {
        const arr = await r.json();
        const hit = Array.isArray(arr) && arr[0];
        if (hit) {
          const a = hit.address || {};
          const out = {
            street: a.road || a.pedestrian || "",
            city: a.city || a.town || a.village || a.municipality || "",
            region: a.state || "",
            country: (a.country_code || "").toUpperCase() || "NL",
            lat: parseFloat(hit.lat),
            lng: parseFloat(hit.lon),
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
