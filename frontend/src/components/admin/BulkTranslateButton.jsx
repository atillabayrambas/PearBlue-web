// BulkTranslateButton — one-click bulk translate NL → EN for a list of CMS
// items. Iterates the list, calls /api/admin/ai/translate for each item's
// text field(s), and PATCHes the target `_en` field back on the item. Shows
// a live progress bar and respects the rate-limit (auto-waits on 429 using
// the response's retry_after_seconds).
//
// Usage:
//   <BulkTranslateButton
//     items={projects}
//     itemLabel={(p) => p.title}
//     needsTranslation={(p) => p.title && !p.title_en}
//     fields={[
//       { srcKey: "title", dstKey: "title_en" },
//       { srcKey: "description", dstKey: "description_en" },
//     ]}
//     patchUrl={(p) => `/api/projects/${p.id}`}
//     onDone={() => reload()}
//   />
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Sparkles, Loader2, XCircle } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useLang } from "../../i18n/LanguageContext";
import { API } from "./_shared";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export const BulkTranslateButton = ({
  items,
  itemLabel,
  needsTranslation,
  fields, // [{srcKey, dstKey}, ...]
  patchUrl, // (item) => absolute or /api-relative URL
  onDone,
  testid = "bulk-translate-btn",
}) => {
  const { authHeader } = useAuth();
  const { lang } = useLang();
  const en = lang === "en";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, currentLabel: "", waitingSecs: 0 });
  const [errors, setErrors] = useState([]);
  const cancelRef = useRef(false);
  // Cancel any in-flight loops when the component unmounts so setState never
  // fires after unmount (React warning).
  useEffect(() => () => { cancelRef.current = true; }, []);

  const pending = (items || []).filter((i) => needsTranslation ? needsTranslation(i) : true);

  const run = async () => {
    cancelRef.current = false;
    setBusy(true);
    setErrors([]);
    setProgress({ done: 0, total: pending.length, currentLabel: "", waitingSecs: 0 });
    let errs = [];
    for (let i = 0; i < pending.length; i++) {
      if (cancelRef.current) break;
      const item = pending[i];
      const label = itemLabel ? itemLabel(item) : `#${i + 1}`;
      setProgress((p) => ({ ...p, currentLabel: label, waitingSecs: 0 }));
      const patchBody = {};
      let itemErrored = false;
      for (const f of fields) {
        const src = item[f.srcKey];
        if (!src || !src.trim()) continue;
        // Retry up to 3× on 429 respecting retry_after_seconds.
        let attempt = 0;
        while (attempt < 3) {
          if (cancelRef.current) break;
          try {
            const r = await axios.post(
              `${API}/admin/ai/translate`,
              { text: src, source_lang: "nl", target_lang: "en" },
              { headers: authHeader() },
            );
            patchBody[f.dstKey] = r.data?.translated || "";
            setProgress((p) => ({ ...p, waitingSecs: 0 }));
            break;
          } catch (e) {
            if (e?.response?.status === 429) {
              const detail = e.response?.data?.detail;
              const totalWait = (detail && typeof detail === "object" && detail.retry_after_seconds) || 30;
              // Tick down the visible countdown every second while we wait.
              for (let s = totalWait; s > 0; s -= 1) {
                if (cancelRef.current) break;
                setProgress((p) => ({ ...p, currentLabel: label, waitingSecs: s }));
                // eslint-disable-next-line no-await-in-loop
                await sleep(1000);
              }
              setProgress((p) => ({ ...p, waitingSecs: 0 }));
              attempt += 1;
              continue;
            }
            errs.push({ label, field: f.srcKey, error: e?.response?.data?.detail || e.message });
            itemErrored = true;
            break;
          }
        }
      }
      if (!itemErrored && Object.keys(patchBody).length > 0 && !cancelRef.current) {
        try {
          await axios.patch(patchUrl(item), patchBody, { headers: authHeader() });
        } catch (e) {
          errs.push({ label, field: "save", error: e?.response?.data?.detail || e.message });
        }
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setErrors(errs);
    setBusy(false);
    if (errs.length === 0) {
      toast.success(en ? `Translated ${pending.length} item(s) ✓` : `${pending.length} item(s) vertaald ✓`);
      setOpen(false);
      onDone?.();
    } else {
      toast.error(en ? `${errs.length} error(s) — see panel` : `${errs.length} fout(en) — zie paneel`);
      onDone?.();
    }
  };

  const cancel = () => { cancelRef.current = true; };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 text-xs font-semibold uppercase tracking-widest px-3 py-1.5"
        data-testid={testid}
        title={en ? "AI-translate all NL items to EN in bulk" : "Vertaal alle NL-items naar EN in bulk"}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {en ? "Bulk AI translate" : "Bulk AI vertaal"}
        {pending.length > 0 && (
          <span className="ml-1 rounded-full bg-violet-500 text-white text-[9px] px-1.5 py-0.5" data-testid={`${testid}-count`}>
            {pending.length}
          </span>
        )}
      </button>

      {open && (
        <div className="pb-modal" onClick={() => !busy && setOpen(false)} data-testid={`${testid}-modal`}>
          <div className="pb-modal-card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="font-heading font-semibold text-strong text-lg flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  {en ? "Bulk AI translate" : "Bulk AI vertaal"}
                </p>
                <p className="text-[11px] text-muted-fg mt-1">
                  {en
                    ? "Translates NL text on every item in this list to EN and saves it in the `_en` fields. Skips items already translated."
                    : "Vertaalt de NL-tekst van elk item in deze lijst naar EN en slaat op in de `_en` velden. Slaat items over die al vertaald zijn."}
                </p>
              </div>
              <button onClick={() => !busy && setOpen(false)} className="text-muted-fg hover:text-strong text-2xl leading-none disabled:opacity-30" disabled={busy}>×</button>
            </div>

            <div className="rounded-xl surface-2 border border-app p-3 mb-3 text-xs">
              <div className="flex items-center justify-between text-strong">
                <span>{en ? "Items to translate" : "Items te vertalen"}</span>
                <span className="font-mono font-semibold text-violet-600" data-testid={`${testid}-pending`}>{pending.length}</span>
              </div>
              <div className="flex items-center justify-between text-muted-fg mt-1">
                <span>{en ? "Fields per item" : "Velden per item"}</span>
                <span className="font-mono">{fields.map((f) => f.srcKey).join(", ")}</span>
              </div>
            </div>

            {busy && (
              <div className="mb-3" data-testid={`${testid}-progress`}>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-2">
                  <div
                    className={`h-full transition-all duration-300 ${progress.waitingSecs > 0 ? "bg-amber-400" : "bg-violet-500"}`}
                    style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-fg flex items-center gap-1.5">
                  <Loader2 className={`h-3 w-3 animate-spin ${progress.waitingSecs > 0 ? "text-amber-500" : "text-violet-500"}`} />
                  <span className="font-mono">{progress.done}/{progress.total}</span>
                  <span className="truncate">· {progress.currentLabel}</span>
                  {progress.waitingSecs > 0 && (
                    <span className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-mono font-semibold px-2 py-0.5" data-testid={`${testid}-cooldown`}>
                      ⏳ {en ? "rate limit" : "rate limit"} · {progress.waitingSecs}s
                    </span>
                  )}
                </p>
              </div>
            )}

            {errors.length > 0 && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-500/10 p-2 text-xs max-h-32 overflow-y-auto" data-testid={`${testid}-errors`}>
                <p className="font-semibold text-red-600 mb-1">
                  <XCircle className="h-3 w-3 inline" /> {errors.length} {en ? "error(s)" : "fout(en)"}
                </p>
                <ul className="space-y-0.5 text-strong/90">
                  {errors.slice(0, 8).map((e, i) => (
                    <li key={i} className="truncate">· <strong>{e.label}</strong> ({e.field}): {String(e.error).slice(0, 100)}</li>
                  ))}
                  {errors.length > 8 && <li>… {errors.length - 8} {en ? "more" : "meer"}</li>}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              {busy ? (
                <button type="button" onClick={cancel} className="text-xs px-4 py-2 rounded-full border border-red-200 text-red-500 hover:bg-red-50" data-testid={`${testid}-cancel`}>
                  {en ? "Cancel" : "Annuleer"}
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setOpen(false)} className="text-xs px-4 py-2 rounded-full border border-app hover:border-pear-500" data-testid={`${testid}-close`}>
                    {en ? "Close" : "Sluiten"}
                  </button>
                  <button
                    type="button"
                    onClick={run}
                    disabled={pending.length === 0}
                    className="btn-primary text-xs disabled:opacity-50"
                    data-testid={`${testid}-start`}
                  >
                    <Sparkles className="h-3.5 w-3.5 inline mr-1" />
                    {en ? `Translate ${pending.length}` : `Vertaal ${pending.length}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
