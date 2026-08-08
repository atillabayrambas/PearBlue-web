import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const genSessionId = () => {
  const existing = localStorage.getItem("pb_chat_session");
  if (existing) return existing;
  const id = `web-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
  localStorage.setItem("pb_chat_session", id);
  return id;
};

export const Chatbot = () => {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId] = useState(genSessionId);
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
      setMessages((m) => [...m, { role: "assistant", content: lang === "nl" ? "Sorry, ik kan even niet reageren. Probeer het zo opnieuw of mail info@pearblue.nl." : "Sorry, I can't respond right now. Please try again shortly or email info@pearblue.nl." }]);
    } finally {
      setBusy(false);
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

            <form onSubmit={send} className="p-3 border-t border-app flex items-center gap-2" data-testid="chatbot-form">
              <input
                id="pb-chat-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={lang === "nl" ? "Stel een vraag…" : "Ask a question…"}
                className="flex-1 rounded-full surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong"
                data-testid="chatbot-input"
              />
              <button type="submit" disabled={busy || !input.trim()} className="w-10 h-10 rounded-full bg-pear-500 text-white flex items-center justify-center hover:bg-pear-600 disabled:opacity-50" data-testid="chatbot-send">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
