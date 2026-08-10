import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Loader2, Camera, User, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "../i18n/LanguageContext";
import { usePageSeo } from "../hooks/usePageSeo";
import { usePostalLookup, extractNlPostcode, extractHouseNumber, NL_POSTCODE_RE } from "../hooks/usePostalLookup";
import { PhoneInput } from "../components/PhoneInput";
import { AvatarPicker } from "../components/AvatarPicker";
import { Avatar } from "../components/Avatar";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PortalProfile() {
  const { lang } = useLang();
  const nl = lang !== "en";
  usePageSeo({
    title: nl ? "Mijn profiel" : "My profile",
    description: nl ? "Beheer je klantprofiel bij PearBlue." : "Manage your PearBlue client profile.",
    path: "/portal/profile",
  });
  const navigate = useNavigate();
  const { lookup } = usePostalLookup();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    axios.get(`${API}/portal/profile`, { withCredentials: true })
      .then((r) => setMe(r.data))
      .catch((e) => {
        if (e?.response?.status === 401) {
          toast.error(nl ? "Log eerst in bij het portaal" : "Please sign in first");
          navigate("/portal");
        } else {
          toast.error(nl ? "Kon profiel niet laden" : "Could not load profile");
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k) => (e) => setMe((m) => ({ ...(m || {}), [k]: e.target.value }));

  const autofill = async () => {
    if (me?.country && !/nederland|netherlands|nl/i.test(me.country)) return;
    let pc = me?.postal_code;
    let hn = me?.house_number;
    if (!pc && me?.address) {
      const found = extractNlPostcode(me.address);
      if (found) pc = found;
    }
    if (!hn && me?.address) {
      const strip = me.address.replace(NL_POSTCODE_RE, "");
      const h = extractHouseNumber(strip);
      if (h) hn = h;
    }
    if (!pc) return;
    setLookingUp(true);
    const r = await lookup(pc, hn);
    setLookingUp(false);
    if (!r) { toast.error(nl ? "Adres niet gevonden" : "Address not found"); return; }
    setMe((m) => ({ ...(m || {}),
      postal_code: pc,
      house_number: hn || m.house_number,
      address: r.street ? `${r.street}${hn ? " " + hn : ""}` : m.address,
      city: r.city || m.city,
      region: r.region || m.region,
      country: r.country === "NL" ? "Nederland" : (r.country || m.country || "Nederland"),
    }));
    toast.success(nl ? `Adres gevonden: ${r.city}` : `Found: ${r.city}`);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put(`${API}/portal/profile`, me, { withCredentials: true });
      toast.success(nl ? "Profiel bijgewerkt" : "Profile updated");
    } catch (err) {
      toast.error(err?.response?.data?.detail || (nl ? "Opslaan mislukt" : "Save failed"));
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted-fg" data-testid="portal-profile-loading">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> {nl ? "Profiel laden…" : "Loading profile…"}
    </div>;
  }
  if (!me) return null;

  const displayName = me.display_name || `${me.first_name || ""} ${me.last_name || ""}`.trim() || me.email;

  return (
    <div className="max-w-4xl mx-auto px-6 lg:px-10 py-10" data-testid="page-portal-profile">
      <Link to="/portal" className="inline-flex items-center gap-1 text-sm text-muted-fg hover:text-pear-500 mb-6" data-testid="portal-profile-back">
        <ArrowLeft className="h-4 w-4" /> {nl ? "Terug naar portaal" : "Back to portal"}
      </Link>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <header className="mb-8">
          <p className="overline mb-2">{nl ? "Klantportaal" : "Client portal"}</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-medium text-strong">{nl ? "Mijn profiel" : "My profile"}</h1>
          <p className="text-sm text-muted-fg mt-2">{nl ? "Beheer je persoonlijke gegevens en avatar. Wijzigingen worden direct opgeslagen." : "Manage your personal details and avatar. Changes save immediately."}</p>
        </header>

        <form onSubmit={save} className="space-y-8">
          {/* Avatar block */}
          <section className="surface border border-app rounded-3xl p-6 sm:p-8" data-testid="portal-profile-avatar-section">
            <div className="flex flex-wrap items-center gap-6">
              <Avatar name={displayName} email={me.email} profilePicture={me.profile_picture} size={96} />
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-lg font-semibold text-strong flex items-center gap-2"><Camera className="h-4 w-4 text-pear-500" /> {nl ? "Profielfoto" : "Profile picture"}</h2>
                <p className="text-xs text-muted-fg mt-1">{nl ? "Kies uit onze 40 unieke avatars, upload een foto of gebruik je webcam." : "Choose from our 40 unique avatars, upload a photo, or use your webcam."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPickerOpen(true)} className="btn-primary text-xs" data-testid="portal-profile-avatar-pick">
                    <Camera className="h-3.5 w-3.5" /> {nl ? "Wijzig avatar" : "Change avatar"}
                  </button>
                  {me.profile_picture && (
                    <button type="button" onClick={() => setMe((m) => ({ ...(m || {}), profile_picture: "" }))} className="text-xs px-3 py-1.5 rounded-full border border-app hover:border-red-400" data-testid="portal-profile-avatar-remove">
                      {nl ? "Terug naar initialen" : "Reset to initials"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Identity */}
          <section className="surface border border-app rounded-3xl p-6 sm:p-8" data-testid="portal-profile-identity-section">
            <h2 className="font-heading text-lg font-semibold text-strong mb-4 flex items-center gap-2"><User className="h-4 w-4 text-pear-500" /> {nl ? "Persoonsgegevens" : "Personal details"}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">{nl ? "Voornaam" : "First name"}</span>
                <input value={me.first_name || ""} onChange={set("first_name")} className="mt-1 w-full rounded-lg border border-app px-3 py-2 text-sm" data-testid="portal-profile-first-name" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">{nl ? "Achternaam" : "Last name"}</span>
                <input value={me.last_name || ""} onChange={set("last_name")} className="mt-1 w-full rounded-lg border border-app px-3 py-2 text-sm" data-testid="portal-profile-last-name" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">{nl ? "Weergavenaam" : "Display name"}</span>
                <input value={me.display_name || ""} onChange={set("display_name")} className="mt-1 w-full rounded-lg border border-app px-3 py-2 text-sm" data-testid="portal-profile-display-name" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">E-mail</span>
                <input value={me.email || ""} disabled className="mt-1 w-full rounded-lg border border-app px-3 py-2 text-sm opacity-60" data-testid="portal-profile-email" />
                <span className="text-[10px] text-muted-fg">{nl ? "Via Zoho gekoppeld, niet te wijzigen." : "Linked via Zoho, cannot be changed."}</span>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">{nl ? "Bedrijf (optioneel)" : "Company (optional)"}</span>
                <input value={me.company || ""} onChange={set("company")} className="mt-1 w-full rounded-lg border border-app px-3 py-2 text-sm" data-testid="portal-profile-company" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg flex items-center gap-1.5"><Phone className="h-3 w-3" /> {nl ? "Telefoon" : "Phone"}</span>
                <div className="mt-1">
                  <PhoneInput value={me.phone || ""} onChange={(v) => setMe((m) => ({ ...(m || {}), phone: v }))} testid="portal-profile-phone" />
                </div>
              </label>
            </div>
          </section>

          {/* Address */}
          <section className="surface border border-app rounded-3xl p-6 sm:p-8" data-testid="portal-profile-address-section">
            <h2 className="font-heading text-lg font-semibold text-strong mb-4 flex items-center gap-2"><MapPin className="h-4 w-4 text-pear-500" /> {nl ? "Adresgegevens" : "Address"}</h2>
            <div className="grid sm:grid-cols-6 gap-3">
              <label className="block sm:col-span-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">{nl ? "Postcode" : "Postal code"}</span>
                <div className="flex gap-1 mt-1">
                  <input value={me.postal_code || ""} onChange={set("postal_code")} onBlur={autofill} placeholder="1234AB" className="flex-1 rounded-lg border border-app px-3 py-2 text-sm uppercase" data-testid="portal-profile-postal" />
                  <button type="button" onClick={autofill} disabled={lookingUp} className="text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-lg border border-app hover:border-pear-500 disabled:opacity-40" data-testid="portal-profile-postal-lookup">{lookingUp ? "…" : (nl ? "Zoek" : "Find")}</button>
                </div>
              </label>
              <label className="block sm:col-span-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">{nl ? "Huisnr." : "House #"}</span>
                <input value={me.house_number || ""} onChange={set("house_number")} onBlur={autofill} className="mt-1 w-full rounded-lg border border-app px-3 py-2 text-sm" data-testid="portal-profile-house-number" />
              </label>
              <label className="block sm:col-span-3">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">{nl ? "Adres" : "Address"}</span>
                <input value={me.address || ""} onChange={set("address")} onBlur={autofill} className="mt-1 w-full rounded-lg border border-app px-3 py-2 text-sm" data-testid="portal-profile-address" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">{nl ? "Plaats" : "City"}</span>
                <input value={me.city || ""} readOnly className="mt-1 w-full rounded-lg border border-app px-3 py-2 text-sm opacity-70 cursor-not-allowed" data-testid="portal-profile-city" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">{nl ? "Regio" : "Region"}</span>
                <input value={me.region || ""} readOnly className="mt-1 w-full rounded-lg border border-app px-3 py-2 text-sm opacity-70 cursor-not-allowed" data-testid="portal-profile-region" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">{nl ? "Land" : "Country"}</span>
                <input value={me.country || "Nederland"} readOnly className="mt-1 w-full rounded-lg border border-app px-3 py-2 text-sm opacity-70 cursor-not-allowed" data-testid="portal-profile-country" />
              </label>
            </div>
          </section>

          <div className="flex justify-end gap-3 sticky bottom-4">
            <button type="submit" disabled={saving} className="btn-primary shadow-2xl" data-testid="portal-profile-save">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? (nl ? "Opslaan…" : "Saving…") : (nl ? "Wijzigingen opslaan" : "Save changes")}
            </button>
          </div>
        </form>
      </motion.div>

      {pickerOpen && (
        <div className="pb-modal" style={{ zIndex: 90 }} onClick={() => setPickerOpen(false)} data-testid="portal-profile-avatar-picker-modal">
          <div className="pb-modal-card w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="px-6 py-4 border-b border-app flex items-center justify-between shrink-0 surface">
              <div className="font-heading text-lg font-semibold text-strong">{nl ? "Kies je avatar" : "Choose your avatar"}</div>
              <button type="button" onClick={() => setPickerOpen(false)} className="text-2xl leading-none text-muted-fg hover:text-strong">×</button>
            </header>
            <div className="pb-modal-body p-6 surface">
              <AvatarPicker
                currentUrl={me.profile_picture}
                onSelect={(url) => { setMe((m) => ({ ...(m || {}), profile_picture: url || "" })); setPickerOpen(false); }}
                onCancel={() => setPickerOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
