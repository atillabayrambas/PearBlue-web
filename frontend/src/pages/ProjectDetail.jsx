import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, AlertCircle, Calendar, User, CheckCircle2, Circle,
  CircleDot, Clock, Target, Flag, ListChecks, TrendingUp,
} from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_ICON = {
  closed: { Icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-100", label: { nl: "Afgerond", en: "Completed" } },
  completed: { Icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-100", label: { nl: "Voltooid", en: "Completed" } },
  archived: { Icon: CheckCircle2, color: "text-slate-400", bg: "bg-slate-100", label: { nl: "Gearchiveerd", en: "Archived" } },
  active: { Icon: CircleDot, color: "text-pear-500", bg: "bg-pear-100", label: { nl: "Actief", en: "Active" } },
  open: { Icon: CircleDot, color: "text-pear-500", bg: "bg-pear-100", label: { nl: "Open", en: "Open" } },
  in_progress: { Icon: Clock, color: "text-amber-500", bg: "bg-amber-100", label: { nl: "In behandeling", en: "In progress" } },
  overdue: { Icon: AlertCircle, color: "text-red-500", bg: "bg-red-100", label: { nl: "Over tijd", en: "Overdue" } },
  default: { Icon: Circle, color: "text-slate-400", bg: "bg-slate-100", label: { nl: "Onbekend", en: "Unknown" } },
};

const statusFor = (raw) => {
  const s = String(raw || "").toLowerCase().replace(/\s+/g, "_");
  return STATUS_ICON[s] || STATUS_ICON.default;
};

const T = {
  back: { nl: "Terug naar portaal", en: "Back to portal" },
  loading: { nl: "Project laden…", en: "Loading project…" },
  cantOpen: { nl: "Kon project niet openen", en: "Could not open project" },
  unknown: { nl: "Onbekende fout", en: "Unknown error" },
  owner: { nl: "Eigenaar", en: "Owner" },
  start: { nl: "Start", en: "Start" },
  end: { nl: "Voltooid / Laatste update", en: "Completed / Last update" },
  progress: { nl: "Voortgang", en: "Progress" },
  milestones: { nl: "Mijlpalen", en: "Milestones" },
  tasks: { nl: "Taken", en: "Tasks" },
  noMilestones: { nl: "Nog geen mijlpalen ingesteld.", en: "No milestones yet." },
  noTasks: { nl: "Nog geen taken.", en: "No tasks yet." },
  goals: { nl: "Doelen & scope", en: "Goals & scope" },
  overall: { nl: "Totale voortgang", en: "Overall progress" },
};

export default function ProjectDetail() {
  const { projectId } = useParams();
  const { lang: language } = useLang();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [tasks, setTasks] = useState({ loading: true, data: null });
  const [milestones, setMilestones] = useState({ loading: true, data: null });

  useEffect(() => {
    const opts = { withCredentials: true };
    axios.get(`${API}/portal/projects/${projectId}`, opts)
      .then((r) => setState({ loading: false, data: r.data, error: null }))
      .catch((e) => setState({ loading: false, data: null, error: e?.response?.data?.detail || e.message }));
    axios.get(`${API}/portal/projects/${projectId}/tasks`, opts)
      .then((r) => setTasks({ loading: false, data: r.data }))
      .catch(() => setTasks({ loading: false, data: null }));
    axios.get(`${API}/portal/projects/${projectId}/milestones`, opts)
      .then((r) => setMilestones({ loading: false, data: r.data }))
      .catch(() => setMilestones({ loading: false, data: null }));
  }, [projectId]);

  const t = (k) => T[k]?.[language] || T[k]?.nl || k;
  const project = state.data?.projects?.[0] || state.data?.project || null;
  const taskList = tasks.data?.tasks || [];
  const milestoneList = milestones.data?.milestones || [];

  // Overall % complete from task_count if present
  const tc = project?.task_count || {};
  const openN = parseInt(tc.open || 0);
  const closedN = parseInt(tc.closed || 0);
  const overallPct = openN + closedN > 0 ? Math.round((closedN / (openN + closedN)) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12" data-testid="page-project-detail">
      <Link to="/portal" className="inline-flex items-center gap-1 text-sm text-muted-fg hover:text-pear-500 mb-6" data-testid="project-back">
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </Link>
      {state.loading && (
        <div className="flex items-center gap-2 text-muted-fg text-sm"><Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}</div>
      )}
      {state.error && !state.loading && (
        <div className="surface border border-app rounded-3xl p-8 text-center">
          <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="font-heading text-lg text-strong">{t("cantOpen")}</p>
          <p className="text-sm text-muted-fg mt-1">{typeof state.error === "string" ? state.error : t("unknown")}</p>
        </div>
      )}
      {project && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {/* Header */}
          {(() => {
            const st = statusFor(project.status);
            return (
              <>
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 mb-3 ${st.bg}`}>
                  <st.Icon className={`h-3.5 w-3.5 ${st.color}`} />
                  <span className={`text-xs font-semibold uppercase tracking-widest ${st.color}`}>{st.label[language] || st.label.nl}</span>
                </div>
                <h1 className="font-heading text-3xl sm:text-4xl font-medium text-strong mb-4" data-testid="project-name">{project.name}</h1>
              </>
            );
          })()}
          {project.description && (
            <div className="surface border border-app rounded-2xl p-5 mb-8">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-fg mb-2"><Target className="h-3 w-3" /> {t("goals")}</div>
              <p className="text-strong/90 whitespace-pre-wrap text-sm leading-relaxed">{project.description}</p>
            </div>
          )}

          {/* Meta cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {project.owner_name && (
              <div className="surface border border-app rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs text-muted-fg uppercase tracking-widest mb-1"><User className="h-3 w-3" /> {t("owner")}</div>
                <p className="text-sm text-strong font-semibold">{project.owner_name}</p>
              </div>
            )}
            {(project.start_date || project.created_date) && (
              <div className="surface border border-app rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs text-muted-fg uppercase tracking-widest mb-1"><Calendar className="h-3 w-3" /> {t("start")}</div>
                <p className="text-sm text-strong font-semibold">{project.start_date || project.created_date}</p>
              </div>
            )}
            {(project.end_date || project.updated_date) && (
              <div className="surface border border-app rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs text-muted-fg uppercase tracking-widest mb-1"><Flag className="h-3 w-3" /> {t("end")}</div>
                <p className="text-sm text-strong font-semibold">{project.end_date || project.updated_date}</p>
              </div>
            )}
          </div>

          {/* Overall progress bar */}
          {(openN + closedN) > 0 && (
            <div className="surface border border-app rounded-2xl p-5 mb-8" data-testid="project-overall">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-fg"><TrendingUp className="h-3 w-3" /> {t("overall")}</div>
                <span className="text-sm font-semibold text-strong tabular-nums">{overallPct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200/50 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${overallPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full bg-pear-500"
                />
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {Object.entries(tc).map(([k, v]) => (
                  <div key={k} className="surface-2 rounded-xl p-3">
                    <p className="text-xl font-heading font-semibold text-strong">{v}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-fg mt-0.5">{k}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestones */}
          <div className="surface border border-app rounded-2xl p-5 mb-8" data-testid="project-milestones">
            <div className="flex items-center gap-2 mb-4">
              <Flag className="h-4 w-4 text-pear-500" />
              <h3 className="font-heading font-semibold text-strong">{t("milestones")}</h3>
              <span className="text-xs text-muted-fg">({milestoneList.length})</span>
            </div>
            {milestones.loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-fg"><Loader2 className="h-3 w-3 animate-spin" /> …</div>
            ) : milestoneList.length === 0 ? (
              <p className="text-sm text-muted-fg">{t("noMilestones")}</p>
            ) : (
              <ol className="space-y-2">
                {milestoneList.map((m, i) => {
                  const st = statusFor(m.status);
                  return (
                    <li key={m.id || i} className="flex items-start gap-3 rounded-xl surface-2 p-3">
                      <div className={`w-8 h-8 rounded-full ${st.bg} ${st.color} flex items-center justify-center shrink-0`}>
                        <st.Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-strong truncate">{m.name}</p>
                        <p className="text-xs text-muted-fg">
                          {(st.label[language] || st.label.nl)}{m.end_date ? ` · ${m.end_date}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Tasks */}
          <div className="surface border border-app rounded-2xl p-5" data-testid="project-tasks">
            <div className="flex items-center gap-2 mb-4">
              <ListChecks className="h-4 w-4 text-pear-500" />
              <h3 className="font-heading font-semibold text-strong">{t("tasks")}</h3>
              <span className="text-xs text-muted-fg">({taskList.length})</span>
            </div>
            {tasks.loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-fg"><Loader2 className="h-3 w-3 animate-spin" /> …</div>
            ) : taskList.length === 0 ? (
              <p className="text-sm text-muted-fg">{t("noTasks")}</p>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto">
                {taskList.map((tk, i) => {
                  const st = statusFor(tk.status?.name || tk.status);
                  return (
                    <li key={tk.id || tk.id_string || i} className="flex items-center gap-3 rounded-xl surface-2 p-3" data-testid={`task-row-${i}`}>
                      <st.Icon className={`h-5 w-5 shrink-0 ${st.color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-strong truncate">{tk.name}</p>
                        <p className="text-xs text-muted-fg truncate">
                          {(st.label[language] || st.label.nl)}
                          {tk.percent_complete != null ? ` · ${tk.percent_complete}%` : ""}
                          {tk.end_date ? ` · ${tk.end_date}` : ""}
                        </p>
                      </div>
                      {tk.percent_complete != null && (
                        <div className="w-16 h-1.5 rounded-full bg-slate-200/50 overflow-hidden shrink-0">
                          <div className="h-full bg-pear-500" style={{ width: `${tk.percent_complete}%` }} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
