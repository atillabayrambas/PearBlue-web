import React from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { usePageSeo } from "../hooks/usePageSeo";
import { ReviewForm } from "../components/Reviews";
import { Logo } from "../components/Logo";

export default function ReviewInvitePage() {
  usePageSeo({ title: "Laat je review achter", description: "Deel je ervaring met PearBlue.", path: "/review" });
  const [params] = useSearchParams();
  const project = params.get("project") || "";

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16" data-testid="page-review-invite">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="surface border border-app rounded-3xl shadow-[0_30px_80px_rgba(10,25,47,0.08)] p-8 sm:p-10 w-full max-w-xl">
        <div className="flex justify-center mb-6"><Logo size={64} iconOnly showText={false} /></div>
        <p className="overline text-center mb-3">Bedankt · Thanks</p>
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-strong text-center mb-2">
          Deel je ervaring
        </h1>
        <p className="text-sm text-muted-fg text-center mb-8">
          Je feedback maakt PearBlue beter voor iedereen · Your feedback makes PearBlue better for everyone.
        </p>
        <ReviewForm compact initialProject={project} />
      </motion.div>
    </div>
  );
}
