import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, AlertCircle, Calendar, User, CheckCircle2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ProjectDetail() {
  const { projectId } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    axios.get(`${API}/portal/projects/${projectId}`, { withCredentials: true })
      .then((r) => setState({ loading: false, data: r.data, error: null }))
      .catch((e) => setState({ loading: false, data: null, error: e?.response?.data?.detail || e.message }));
  }, [projectId]);

  const project = state.data?.projects?.[0] || state.data?.project || null;

  return (
    <div className="max-w-4xl mx-auto px-6 lg:px-10 py-12" data-testid="page-project-detail">
      <Link to="/portal" className="inline-flex items-center gap-1 text-sm text-muted-fg hover:text-pear-500 mb-6" data-testid="project-back">
        <ArrowLeft className="h-4 w-4" /> Terug naar portaal
      </Link>
      {state.loading && (
        <div className="flex items-center gap-2 text-muted-fg text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Project laden…</div>
      )}
      {state.error && !state.loading && (
        <div className="surface border border-app rounded-3xl p-8 text-center">
          <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="font-heading text-lg text-strong">Kon project niet openen</p>
          <p className="text-sm text-muted-fg mt-1">{typeof state.error === "string" ? state.error : "Onbekende fout"}</p>
        </div>
      )}
      {project && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="overline mb-2">{project.status || "Actief"}</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-medium text-strong mb-4" data-testid="project-name">{project.name}</h1>
          {project.description && (
            <p className="text-muted-fg mb-8 whitespace-pre-wrap">{project.description}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {project.owner_name && (
              <div className="surface border border-app rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs text-muted-fg uppercase tracking-widest mb-1"><User className="h-3 w-3" /> Eigenaar</div>
                <p className="text-sm text-strong font-semibold">{project.owner_name}</p>
              </div>
            )}
            {(project.start_date || project.created_date) && (
              <div className="surface border border-app rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs text-muted-fg uppercase tracking-widest mb-1"><Calendar className="h-3 w-3" /> Start</div>
                <p className="text-sm text-strong font-semibold">{project.start_date || project.created_date}</p>
              </div>
            )}
            {(project.end_date || project.updated_date) && (
              <div className="surface border border-app rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs text-muted-fg uppercase tracking-widest mb-1"><CheckCircle2 className="h-3 w-3" /> Voltooid / Laatste update</div>
                <p className="text-sm text-strong font-semibold">{project.end_date || project.updated_date}</p>
              </div>
            )}
          </div>
          {project.task_count && (
            <div className="surface border border-app rounded-2xl p-6">
              <h3 className="font-heading text-lg font-semibold text-strong mb-4">Voortgang</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                {Object.entries(project.task_count).map(([k, v]) => (
                  <div key={k} className="surface-2 rounded-xl p-4">
                    <p className="text-2xl font-heading font-semibold text-strong">{v}</p>
                    <p className="text-xs uppercase tracking-widest text-muted-fg mt-1">{k}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
