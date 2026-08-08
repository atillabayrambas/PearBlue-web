import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Sparkles, User, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "../i18n/LanguageContext";
import { LocalCaptcha, ConsentText } from "./LocalCaptcha";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const genSessionId = () => {
  const existing = localStorage.getItem("pb_chat_session");
  if (existing) return existing;
  const id = `web-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
  localStorage.setItem("pb_chat_session", id);
  return id;
};

// Smiley 1-5 rating widget shown inside the chat panel after some exchanges.
const SMILEYS = ["😞", "🙁", "😐", "🙂", "😄"];
const ChatbotRating = ({ sessionId, lang }) => {
  const key = `pb_chat_rating_${sessionId}`;
  const [done, setDone] = useState(() => localStorage.getItem(key) === "1");
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  if (done) return null;
  const rate = async (r) => {
    if (busy) return;
    setBusy(true);
    try {
      await axios.post(`${API}/chat/rating`, { session_id: sessionId, rating: r, source: "chat" });
      localStorage.setItem(key, "1");
      setDone(true);
      toast.success(lang === "en" ? "Thanks for your feedback!" : "Bedankt voor je feedback!");
    } catch {
      toast.error(lang === "en" ? "Rating failed" : "Beoordelen mislukt");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="px-4 py-2 border-t border-app bg-pear-50/40 dark:bg-pear-500/5 flex items-center justify-between gap-2" data-testid="chatbot-rating">
      <span className="text-[11px] text-muted-fg">{lang === "en" ? "How's this chat?" : "Hoe was deze chat?"}</span>
      <div className="flex items-center gap-1">
        {SMILEYS.map((emo, idx) => {
          const r = idx + 1;
          const active = hover >= r;
          return (
            <button
              key={r}
              type="button"
              disabled={busy}
              onMouseEnter={() => setHover(r)}
              onMouseLeave={() => setHover(0)}
              onClick={() => rate(r)}
              className={`text-lg transition-transform ${active ? "scale-125" : "opacity-75 hover:opacity-100"}`}
              aria-label={`Rate ${r}`}
              data-testid={`chatbot-rating-${r}`}
            >
              {emo}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const Chatbot = () => {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId] = useState(genSessionId);
  const [showHandoff, setShowHandoff] = useState(false);
  const [handoffForm, setHandoffForm] = useState({ name: "", email: "", message: "" });
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffDone, setHandoffDone] = useState(false);
  const [captchaOk, setCaptchaOk] = useState(() => localStorage.getItem("pb_chat_captcha") === "ok");
  const scrollerRef = useRef(null);

  const welcome = lang === "nl"
    ? "Hoi! Ik ben Pear, de digitale assistent van PearBlue. Vraag me gerust wat over onze diensten of prijzen."
    : "Hi! I'm Pear, PearBlue's digital assistant. Ask me anything about our services or pricing.";

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: welcome }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, open]);

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await axios.post(`${API}/chat`, { session_id: sessionId, message: text, language: lang });
      setMessages((m) => [...m, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 400 && detail?.reason) {
        const msg = lang === "en" ? detail.message_en : detail.message;
        setMessages((m) => [...m, { role: "assistant", content: msg || "" }]);
      } else if (status === 429) {
        const msg = lang === "en" ? detail?.message_en : detail?.message;
        setMessages((m) => [...m, { role: "assistant", content: msg || "" }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: lang === "nl" ? "Sorry, ik kan even niet reageren. Probeer het zo opnieuw of vraag een medewerker onder in het scherm." : "Sorry, I can't respond right now. Please try again shortly or request an agent below." }]);
      }
    } finally {
      setBusy(false);
    }
  };

  const submitHandoff = async (e) => {
    e?.preventDefault();
    if (handoffBusy) return;
    setHandoffBusy(true);
    try {
      // Prefill message with last user turn if empty
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const msg = handoffForm.message.trim() || (lastUser ? lastUser.content : "");
      if (!msg || msg.length < 5) {
        toast.error(lang === "en" ? "Please describe your question first." : "Beschrijf eerst je vraag.");
        setHandoffBusy(false);
        return;
      }
      await axios.post(`${API}/chat/agent-handoff`, {
        session_id: sessionId,
        name: handoffForm.name.trim(),
        email: handoffForm.email.trim(),
        message: msg,
      });
      setHandoffDone(true);
      toast.success(lang === "en" ? "An agent is on the way!" : "Een medewerker komt eraan!");
    } catch (err) {
      toast.error(err?.response?.data?.detail?.message || (lang === "en" ? "Could not connect to an agent" : "Kon geen agent bereiken"));
    } finally {
      setHandoffBusy(false);
    }
  };

  const suggestions = lang === "nl"
    ? ["Wat kost een website?", "Wat is Bitdefender GravityZone?", "Werken jullie ook in Groningen?"]
    : ["What does a website cost?", "What is Bitdefender GravityZone?", "Do you work in Groningen?"];

  return (
    <>
      {/* Launcher */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.6 }}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[80] w-14 h-14 rounded-full bg-pear-500 text-white shadow-[0_15px_40px_rgba(2,192,255,0.45)] flex items-center justify-center hover:bg-pear-600 transition-colors"
        aria-label={open ? "Close chat" : "Open chat"}
        data-testid="chatbot-launcher"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div key="msg" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="fixed bottom-24 right-6 z-[80] w-[92vw] sm:w-[400px] max-h-[70vh] rounded-3xl surface border border-app shadow-[0_30px_80px_rgba(10,25,47,0.18)] flex flex-col overflow-hidden"
            data-testid="chatbot-panel"
          >
            <div className="p-4 border-b border-app flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pear-500 text-white flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-heading font-semibold text-strong text-sm leading-tight">Pear</div>
                <div className="text-[11px] text-muted-fg">{lang === "nl" ? "Digitale assistent · online" : "Digital assistant · online"}</div>
              </div>
            </div>

            <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="chatbot-messages">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user" ? "bg-pear-500 text-white rounded-br-sm" : "surface-2 text-strong rounded-bl-sm"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="surface-2 rounded-2xl px-4 py-3 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-pear-500 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-pear-500 animate-pulse" style={{ animationDelay: "0.15s" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-pear-500 animate-pulse" style={{ animationDelay: "0.3s" }} />
                  </div>
                </div>
              )}
            </div>

            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5" data-testid="chatbot-suggestions">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); setTimeout(() => document.getElementById("pb-chat-input")?.focus(), 0); }}
                    className="text-[11px] rounded-full border border-app px-3 py-1.5 text-strong hover:border-pear-500 hover:text-pear-500"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {!captchaOk && (
              <div className="px-4 py-3 border-t border-app bg-pear-50/40 dark:bg-pear-500/5" data-testid="chatbot-captcha-gate">
                <p className="text-xs text-muted-fg mb-1">
                  {lang === "en" ? "Confirm you're human to start chatting:" : "Bevestig dat je een mens bent om te starten:"}
                </p>
                <LocalCaptcha onChange={(ok) => { setCaptchaOk(ok); if (ok) localStorage.setItem("pb_chat_captcha", "ok"); }} />
                <ConsentText context="chatbot" />
              </div>
            )}

            {/* Smiley rating — appears after the user has had at least 2 exchanges */}
            {captchaOk && messages.filter((m) => m.role === "user").length >= 2 && (
              <ChatbotRating sessionId={sessionId} lang={lang} />
            )}

            <form onSubmit={send} className="p-3 border-t border-app flex items-center gap-2" data-testid="chatbot-form">
              <input
                id="pb-chat-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={lang === "nl" ? "Stel een vraag…" : "Ask a question…"}
                disabled={!captchaOk}
                className="flex-1 rounded-full surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong disabled:opacity-50"
                data-testid="chatbot-input"
              />
              <button type="submit" disabled={busy || !input.trim() || !captchaOk} className="w-10 h-10 rounded-full bg-pear-500 text-white flex items-center justify-center hover:bg-pear-600 disabled:opacity-50" data-testid="chatbot-send">
                <Send className="h-4 w-4" />
              </button>
            </form>

            <div className="px-3 pb-3 -mt-1">
              <button
                type="button"
                onClick={() => setShowHandoff(true)}
                data-testid="chatbot-request-agent"
                className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] text-muted-fg hover:text-pear-500 py-1"
              >
                <User className="h-3 w-3" />
                {lang === "en" ? "Talk to a real person" : "Vraag een medewerker"}
              </button>
            </div>

            {/* Handoff overlay */}
            <AnimatePresence>
              {showHandoff && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 surface rounded-2xl z-10 flex flex-col p-5"
                  data-testid="chatbot-handoff-panel"
                >
                  <button
                    onClick={() => setShowHandoff(false)}
                    className="self-start inline-flex items-center gap-1 text-xs text-muted-fg hover:text-pear-500 mb-3"
                    data-testid="chatbot-handoff-back"
                  >
                    <ArrowLeft className="h-3 w-3" /> {lang === "en" ? "Back to chat" : "Terug naar chat"}
                  </button>
                  {handoffDone ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center" data-testid="chatbot-handoff-done">
                      <div className="w-12 h-12 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center mb-3"><Sparkles className="h-6 w-6" /></div>
                      <p className="font-heading text-lg text-strong">{lang === "en" ? "Thanks — an agent is on the way!" : "Bedankt — een medewerker komt eraan!"}</p>
                      <p className="text-xs text-muted-fg mt-2 max-w-xs">
                        {lang === "en"
                          ? "We'll reply by email within 2 minutes during business hours."
                          : "We reageren binnen 2 minuten per e-mail tijdens werktijden."}
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={submitHandoff} className="flex flex-col gap-2.5 flex-1 overflow-y-auto">
                      <p className="text-xs text-muted-fg mb-1">
                        {lang === "en" ? "Give us your details and we'll email you back within 2 min." : "Laat je gegevens achter en we mailen je binnen 2 minuten."}
                      </p>
                      <input required minLength={2} value={handoffForm.name} onChange={(e) => setHandoffForm({ ...handoffForm, name: e.target.value })}
                        placeholder={lang === "en" ? "Your name" : "Jouw naam"} data-testid="chatbot-handoff-name"
                        className="rounded-xl surface-2 border border-transparent focus:border-pear-500 px-3 py-2 text-sm outline-none text-strong" />
                      <input required type="email" value={handoffForm.email} onChange={(e) => setHandoffForm({ ...handoffForm, email: e.target.value })}
                        placeholder="you@example.com" data-testid="chatbot-handoff-email"
                        className="rounded-xl surface-2 border border-transparent focus:border-pear-500 px-3 py-2 text-sm outline-none text-strong" />
                      <textarea rows={3} value={handoffForm.message} onChange={(e) => setHandoffForm({ ...handoffForm, message: e.target.value })}
                        placeholder={lang === "en" ? "How can we help? (optional — we'll use your last message)" : "Waarmee kunnen we helpen? (optioneel — anders gebruiken we je laatste bericht)"}
                        data-testid="chatbot-handoff-message"
                        className="rounded-xl surface-2 border border-transparent focus:border-pear-500 px-3 py-2 text-sm outline-none resize-none text-strong" />
                      <button type="submit" disabled={handoffBusy} className="btn-primary justify-center mt-1" data-testid="chatbot-handoff-submit">
                        {handoffBusy ? "…" : (lang === "en" ? "Send" : "Versturen")}
                      </button>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
