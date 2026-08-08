import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Star, MessageSquareQuote, CircleCheck } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const useCountUp = (target, duration = 900) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!target) return;
    const start = performance.now();
    let frame;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return n;
};

export const TrustStats = () => {
  const [data, setData] = useState({ reviews: 0, avg: 0, projects: 0, loaded: false });

  useEffect(() => {
    axios.get(`${API}/stats/trust`)
      .then((r) => setData({ ...r.data, loaded: true }))
      .catch(() => setData({ reviews: 0, avg: 0, projects: 0, loaded: false }));
  }, []);

  const reviews = useCountUp(data.reviews);
  const projects = useCountUp(data.projects);
  const avg = data.avg;

  if (!data.loaded || (data.reviews === 0 && data.projects === 0)) return null;

  const items = [
    {
      key: "reviews",
      icon: MessageSquareQuote,
      value: reviews,
      label: "Klantreviews",
      sub: "geverifieerd via ons portaal",
    },
    {
      key: "avg",
      icon: Star,
      value: avg > 0 ? avg.toFixed(1) : "—",
      label: "Gemiddelde score",
      sub: "van 5 sterren",
      isRating: true,
    },
    {
      key: "projects",
      icon: CircleCheck,
      value: projects,
      label: "Afgeronde projecten",
      sub: "opgeleverd + betaald",
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16" data-testid="trust-stats">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {items.map((it, i) => (
          <motion.div
            key={it.key}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="surface border border-app rounded-3xl p-8 text-center card-lift"
            data-testid={`trust-stat-${it.key}`}
          >
            <div className="w-12 h-12 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center mx-auto mb-4">
              <it.icon className="h-6 w-6" />
            </div>
            <p className="font-heading text-5xl font-medium text-strong tabular-nums flex items-center justify-center gap-1">
              {it.value}
              {it.isRating && avg > 0 && (
                <Star className="h-6 w-6 text-pear-500 fill-current ml-1" />
              )}
            </p>
            <p className="mt-2 font-heading text-lg text-strong">{it.label}</p>
            <p className="mt-1 text-xs text-muted-fg">{it.sub}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
