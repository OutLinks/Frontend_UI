"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Database,
  LayoutDashboard,
  Mail,
  Menu,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  autoreach,
  CampaignBrief,
  DashboardData,
  JobRecord,
  LeadState,
  PipelineLead,
  PipelineStage,
  waitForJob,
} from "@/lib/autoreach";

const demoCampaigns: CampaignBrief[] = [{
  id: "demo-campaign",
  name: "Cybersecurity hiring signals",
  user_prompt: "Find growing security teams and contact talent leaders.",
  summary: "Reach talent leaders at growing US cybersecurity companies.",
  targeting: { industries: ["Cybersecurity"], company_sizes: ["50–250"], locations: ["United States"], job_titles: ["VP People", "Head of Talent"], exclude_industries: [], b2b_only: true },
  messaging: { offer: "Specialist recruiting support", value_proposition: "Fill difficult security roles faster", tone: "professional", call_to_action: "Book a short call", proof_points: [], forbidden_claims: [] },
  send_policy: { emails_per_day: 20, hourly_send_limit: 5, followup_days: [3, 7, 14] },
  source_urls: [], agent_instructions: {}, status: "active", created_at: "2026-07-20T08:00:00Z", updated_at: "2026-07-23T08:00:00Z",
}];

const demoLeads: PipelineLead[] = [
  { id: "demo-1", state: "ready", email: "maya@northstarsecurity.com", company: "Northstar Security", industry: "Cybersecurity", quality_score: .88, company_size_score: .8, industry_fit_score: .92, recency_score: .9, manual_bump: false, priority: .88, attempts: 0, last_error: "", retry_after: null, discovered_at: "2026-07-23T08:00:00Z", sent_at: null, replied_at: null, state_entered_at: "2026-07-23T09:00:00Z", source_job: "demo", metadata: {}, created_at: "2026-07-23T08:00:00Z", updated_at: "2026-07-23T09:00:00Z" },
  { id: "demo-2", state: "researched", email: "noah@veridianlabs.com", company: "Veridian Labs", industry: "SaaS", quality_score: .92, company_size_score: .85, industry_fit_score: .91, recency_score: .95, manual_bump: false, priority: .92, attempts: 0, last_error: "", retry_after: null, discovered_at: "2026-07-23T07:30:00Z", sent_at: null, replied_at: null, state_entered_at: "2026-07-23T08:30:00Z", source_job: "demo", metadata: {}, created_at: "2026-07-23T07:30:00Z", updated_at: "2026-07-23T08:30:00Z" },
  { id: "demo-3", state: "sent", email: "ari@pillarsystems.com", company: "Pillar Systems", industry: "Technology", quality_score: .84, company_size_score: .76, industry_fit_score: .87, recency_score: .8, manual_bump: false, priority: .84, attempts: 0, last_error: "", retry_after: null, discovered_at: "2026-07-22T08:00:00Z", sent_at: "2026-07-23T09:30:00Z", replied_at: null, state_entered_at: "2026-07-23T09:30:00Z", source_job: "demo", metadata: {}, created_at: "2026-07-22T08:00:00Z", updated_at: "2026-07-23T09:30:00Z" },
];

const demoData: DashboardData = {
  config: { environment: "demo", simulate: true, reply_handling_enabled: false, scheduler_enabled: true, scheduler_timezone: "Asia/Colombo", stages: ["find", "research", "write", "send", "followup"] },
  report: { funnel: { discovered: 18, researched: 12, ready: 6, sent: 42, replied: 8, meeting_booked: 4 }, sent_today: 42, replies_today: 8, meetings_booked: 4, reply_rate: .19, meeting_rate: .095, dead_letter_count: 0, alerts: [], optimizations: [], generated_at: "2026-07-23T10:20:30Z" },
  health: { healthy: true, stages: [{ stage: "research", queue_depth: 6, in_progress: 0, error_rate: 0, circuit: "closed", oldest_wait_hours: .4, bottleneck: false }, { stage: "write", queue_depth: 6, in_progress: 1, error_rate: 0, circuit: "closed", oldest_wait_hours: .2, bottleneck: false }, { stage: "send", queue_depth: 6, in_progress: 0, error_rate: 0, circuit: "closed", oldest_wait_hours: .1, bottleneck: false }], alerts: [], dead_letter_count: 0, computed_at: "2026-07-23T10:20:30Z" },
  campaigns: demoCampaigns,
  jobs: [
    { id: "job-1", kind: "pipeline.stage", status: "succeeded", payload: {}, result: null, error: "", dedupe_key: null, created_at: "2026-07-23T10:42:00Z", started_at: "2026-07-23T10:42:00Z", completed_at: "2026-07-23T10:42:08Z" },
    { id: "job-2", kind: "pipeline.cycle", status: "succeeded", payload: {}, result: null, error: "", dedupe_key: null, created_at: "2026-07-23T10:14:00Z", started_at: "2026-07-23T10:14:00Z", completed_at: "2026-07-23T10:14:12Z" },
  ],
  leads: demoLeads,
  leadTotal: 3,
};

const navigation = [
  ["Dashboard", LayoutDashboard],
  ["Campaigns", Target],
  ["Leads", UsersRound],
  ["Pipeline", Activity],
] as const;

const leadStates: Array<LeadState | "all"> = ["all", "discovered", "researched", "ready", "sent", "replied", "meeting_booked", "error"];
const stages: PipelineStage[] = ["research", "write", "send", "followup", "reply"];

function formatPercent(value: number) { return `${(value * 100).toFixed(value > .1 ? 1 : 2)}%`; }
function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function initials(company: string) { return company.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

function LoadingPanel() {
  return <div className="loading-panel"><RefreshCw size={20} /><strong>Loading AutoReach data</strong><p>Checking campaigns, pipeline health, leads, and jobs…</p></div>;
}

function CampaignModal({ close, onCreated, connected }: { close: () => void; onCreated: (campaign: CampaignBrief) => void; connected: boolean }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pollController = useRef<AbortController | null>(null);

  useEffect(() => () => pollController.current?.abort(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (prompt.trim().length < 10) return setError("Describe the audience and offer in at least 10 characters.");
    setBusy(true); setError("");
    try {
      pollController.current = new AbortController();
      const queued = await autoreach.createCampaign(prompt.trim());
      const completed = await waitForJob<CampaignBrief>(queued.id, pollController.current.signal);
      if (!completed.result) throw new Error("Campaign generation completed without a draft.");
      onCreated(completed.result);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Campaign generation failed.");
    } finally { pollController.current = null; setBusy(false); }
  }

  return <div className="modal-wrap"><button className="scrim" onClick={close} aria-label="Close campaign setup" /><form className="campaign-modal" onSubmit={submit}>
    <header><div><span>NEW CAMPAIGN</span><h2>Describe who you want to reach</h2><p>AutoReach will turn this into a draft for you to review before activation.</p></div><button type="button" className="icon-button" onClick={close}><X size={18} /></button></header>
    {!connected && <div className="inline-warning"><AlertTriangle size={16} /> Connect the backend before generating a campaign.</div>}
    <label>Campaign prompt<textarea autoFocus value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={20000} placeholder="Find property-management companies in Colombo with 10 to 100 employees and contact founders about our maintenance automation platform." /></label>
    <div className="prompt-help"><span>Include audience, location, decision-maker, and offer.</span><span>{prompt.length} / 20,000</span></div>
    {error && <p className="form-error">{error}</p>}
    <footer><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" disabled={!connected || busy}>{busy ? <><RefreshCw className="spin" size={15} /> Generating draft…</> : <><Plus size={15} /> Generate draft</>}</button></footer>
  </form></div>;
}

function CampaignReview({ campaign, close, activate, busy }: { campaign: CampaignBrief; close: () => void; activate: () => void; busy: boolean }) {
  return <div className="modal-wrap"><button className="scrim" onClick={close} aria-label="Close campaign review" /><section className="campaign-modal review-modal">
    <header><div><span>CAMPAIGN DRAFT</span><h2>{campaign.name}</h2><p>{campaign.summary}</p></div><button className="icon-button" onClick={close}><X size={18} /></button></header>
    <div className="review-grid"><article><span>TARGETING</span><strong>{campaign.targeting.industries.join(", ") || "Any industry"}</strong><p>{[...campaign.targeting.locations, ...campaign.targeting.company_sizes, ...campaign.targeting.job_titles].join(" · ")}</p></article><article><span>MESSAGE</span><strong>{campaign.messaging.value_proposition}</strong><p>{campaign.messaging.call_to_action} · {campaign.messaging.tone} tone</p></article><article><span>SEND POLICY</span><strong>{campaign.send_policy.emails_per_day} emails per day</strong><p>{campaign.send_policy.hourly_send_limit}/hour · Follow-ups on days {campaign.send_policy.followup_days.join(", ")}</p></article></div>
    <div className="activation-note"><CheckCircle2 size={16} /><span>Activation makes this the only active campaign. Any current campaign returns to draft.</span></div>
    <footer><button className="secondary-button" onClick={close}>Keep as draft</button><button className="primary-button" onClick={activate} disabled={busy}>{busy ? <><RefreshCw className="spin" size={15} /> Activating…</> : <><Play size={15} /> Activate campaign</>}</button></footer>
  </section></div>;
}

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState<DashboardData>(demoData);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [filter, setFilter] = useState<LeadState | "all">("all");
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [draft, setDraft] = useState<CampaignBrief | null>(null);
  const [activating, setActivating] = useState(false);
  const [runningJob, setRunningJob] = useState("");
  const [toast, setToast] = useState("");
  const jobController = useRef<AbortController | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }, []);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [config, report, health, campaigns, jobs, leads] = await Promise.all([
        autoreach.config(), autoreach.report(), autoreach.health(), autoreach.campaigns(50), autoreach.jobs(20), autoreach.leads(undefined, 100),
      ]);
      setData({ config, report, health, campaigns: campaigns.items, jobs: jobs.items, leads: leads.items, leadTotal: leads.total });
      setConnected(true); setConnectionError("");
    } catch (error) {
      setConnected(false);
      setConnectionError(error instanceof Error ? error.message : "Unable to connect to AutoReach.");
      if (!quiet) setData(demoData);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => () => jobController.current?.abort(), []);

  useEffect(() => {
    if (!connected || active !== "Leads") return;
    const controller = new AbortController();
    autoreach.leads(filter === "all" ? undefined : filter, 100).then((response) => setData((current) => ({ ...current, leads: response.items, leadTotal: response.total }))).catch(() => undefined);
    return () => controller.abort();
  }, [filter, active, connected]);

  async function runPipeline(kind: "find" | "cycle" | "stage", stage?: PipelineStage) {
    if (!connected) return showToast("Connect AutoReach before running pipeline jobs");
    setRunningJob(stage || kind);
    try {
      jobController.current = new AbortController();
      const queued = kind === "find" ? await autoreach.find() : kind === "cycle" ? await autoreach.cycle() : await autoreach.stage(stage!);
      showToast(`${label(queued.kind)} queued`);
      await refresh(true);
      const completed = await waitForJob(queued.id, jobController.current.signal);
      showToast(`${label(completed.kind)} completed successfully`);
      await refresh(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Pipeline job failed");
    } finally { jobController.current = null; setRunningJob(""); }
  }

  async function activateDraft() {
    if (!draft) return;
    setActivating(true);
    try {
      const activated = await autoreach.activateCampaign(draft.id);
      showToast(`${activated.name} is now active`); setDraft(null); await refresh(true);
    } catch (error) { showToast(error instanceof Error ? error.message : "Activation failed"); }
    finally { setActivating(false); }
  }

  const activeCampaign = data.campaigns.find((campaign) => campaign.status === "active");
  const runningCount = data.jobs.filter((job) => job.status === "running" || job.status === "queued").length;
  const today = useMemo(() => new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase(), []);

  return <div className="app-shell">
    {sidebarOpen && <button className="mobile-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />}
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="brand"><span className="brand-mark"><ArrowRight size={16} /></span><strong>Outbound<span>OS</span></strong><button className="mobile-close" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
      <button className="workspace-select"><span className="workspace-logo">A</span><span><small>WORKSPACE</small><strong>AutoReach</strong></span><ChevronDown size={15} /></button>
      <nav>{navigation.map(([name, Icon]) => <button key={name} className={active === name ? "active" : ""} onClick={() => { setActive(name); setSidebarOpen(false); }}><Icon size={18} /><span>{name}</span>{name === "Pipeline" && runningCount > 0 && <b>{runningCount}</b>}</button>)}</nav>
      <button className="settings-link" onClick={() => setActive("Settings")}><Settings size={18} /><span>Runtime</span></button>
      <div className={`sender-health ${data.health.healthy ? "" : "unhealthy"}`}><div><span><i /> {data.health.healthy ? "Pipeline healthy" : "Pipeline warning"}</span><strong>{data.health.dead_letter_count} dead</strong></div><p>{data.config.simulate ? "Simulation mode" : data.config.environment} · {data.config.scheduler_enabled ? "Scheduler on" : "Scheduler off"}</p></div>
      <div className="profile"><span className={`connection-dot ${connected ? "live" : "demo"}`} /><span><strong>{connected ? "API connected" : "Demo data"}</strong><small>{connected ? data.config.scheduler_timezone : "Configure .env.local"}</small></span></div>
    </aside>

    <div className="main-wrap">
      <header className="topbar"><button className="menu-button" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button><div className="mobile-brand"><span className="brand-mark"><ArrowRight size={14} /></span><strong>OutboundOS</strong></div><div className="page-context"><strong>{active}</strong><span>{connected ? "Live AutoReach data" : "Demo preview"}</span></div><div className="top-actions"><button onClick={() => void refresh()}><RefreshCw size={16} /><span>Refresh</span></button><button><CircleHelp size={17} /><span>Help</span></button><button className="icon-button"><Bell size={18} />{data.health.alerts.length > 0 && <i />}</button></div></header>

      <main>
        {!connected && !loading && <section className="connection-banner"><Server size={18} /><div><strong>Showing demo data</strong><p>{connectionError} Add <code>AUTOREACH_API_URL</code> and <code>AUTOREACH_API_SECRET</code> to <code>.env.local</code>.</p></div><button onClick={() => void refresh()}>Try again</button></section>}
        {loading ? <LoadingPanel /> : <>
          {active === "Dashboard" && <DashboardView data={data} activeCampaign={activeCampaign} today={today} connected={connected} openCampaign={() => setCampaignOpen(true)} runCycle={() => void runPipeline("cycle")} setView={setActive} />}
          {active === "Campaigns" && <CampaignsView campaigns={data.campaigns} connected={connected} openCampaign={() => setCampaignOpen(true)} review={setDraft} />}
          {active === "Leads" && <LeadsView leads={data.leads} total={data.leadTotal} filter={filter} setFilter={setFilter} />}
          {active === "Pipeline" && <PipelineView data={data} connected={connected} running={runningJob} run={runPipeline} />}
          {active === "Settings" && <RuntimeView data={data} connected={connected} />}
        </>}
      </main>
    </div>

    {campaignOpen && <CampaignModal connected={connected} close={() => setCampaignOpen(false)} onCreated={(campaign) => { setCampaignOpen(false); setDraft(campaign); void refresh(true); }} />}
    {draft && <CampaignReview campaign={draft} close={() => setDraft(null)} activate={() => void activateDraft()} busy={activating} />}
    {toast && <div className="toast"><CheckCircle2 size={16} />{toast}</div>}
  </div>;
}

function DashboardView({ data, activeCampaign, today, connected, openCampaign, runCycle, setView }: { data: DashboardData; activeCampaign?: CampaignBrief; today: string; connected: boolean; openCampaign: () => void; runCycle: () => void; setView: (view: string) => void }) {
  const ready = data.report.funnel.ready || 0;
  return <>
    <section className="welcome"><div><span>{today}</span><h1>Your outreach workspace</h1><p>{data.health.healthy ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {data.health.healthy ? "The pipeline is operating normally." : `${data.health.alerts.length} pipeline alert${data.health.alerts.length === 1 ? "" : "s"} need attention.`}</p></div><button className="primary-button" onClick={openCampaign} disabled={!connected}><Plus size={17} /> New campaign</button></section>
    <section className="metrics"><article><span className="metric-icon purple"><Mail size={19} /></span><div><p>Sent</p><strong>{data.report.sent_today}</strong><small>Cumulative audit-log count</small></div></article><article><span className="metric-icon blue"><UsersRound size={19} /></span><div><p>Replies</p><strong>{data.report.replies_today}</strong><small>{formatPercent(data.report.reply_rate)} reply rate</small></div></article><article><span className="metric-icon green"><Target size={19} /></span><div><p>Meetings booked</p><strong>{data.report.meetings_booked}</strong><small>{formatPercent(data.report.meeting_rate)} meeting rate</small></div></article></section>
    <section className="content-grid dashboard-grid"><article className="panel"><div className="panel-title"><div><h2>Pipeline overview</h2><p>Current lead states</p></div><button onClick={() => setView("Leads")}>View leads <ArrowRight size={14} /></button></div><div className="funnel-row">{[["Discovered", data.report.funnel.discovered || 0], ["Researched", data.report.funnel.researched || 0], ["Ready", ready], ["Sent", data.report.funnel.sent || 0], ["Replied", data.report.funnel.replied || 0]].map(([name, value], index) => <div key={name}><span>{name}</span><strong>{value}</strong>{index < 4 && <ArrowRight size={14} />}</div>)}</div><div className="pipeline-actions"><button className="secondary-button" onClick={() => setView("Pipeline")}><Activity size={15} /> Pipeline controls</button><button className="primary-button" onClick={runCycle} disabled={!connected}><Play size={15} /> Run one cycle</button></div></article>
      <aside className="panel attention-panel"><div className="panel-title"><div><h2>System health</h2><p>Queue and risk summary</p></div></div><div className="health-summary"><span className={data.health.healthy ? "ok" : "warn"}>{data.health.healthy ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}</span><div><strong>{data.health.healthy ? "All systems normal" : "Review pipeline alerts"}</strong><small>{data.health.dead_letter_count} dead-lettered · {data.health.stages.reduce((sum, stage) => sum + stage.queue_depth, 0)} queued</small></div></div>{data.health.stages.slice(0, 3).map((stage) => <div className="health-stage" key={stage.stage}><span>{label(stage.stage)}</span><strong>{stage.queue_depth} queued</strong><i className={stage.circuit} /></div>)}</aside></section>
    <section className="lower-grid"><article className="panel campaign-panel"><div className="panel-title"><div><h2>Active campaign</h2><p>Only one campaign can be active</p></div><button onClick={() => setView("Campaigns")}>All campaigns <ArrowRight size={14} /></button></div>{activeCampaign ? <CampaignRow campaign={activeCampaign} /> : <div className="empty-state"><Target size={22} /><strong>No active campaign</strong><p>Create or activate a draft to start outreach.</p></div>}</article><JobList jobs={data.jobs.slice(0, 3)} compact /></section>
  </>;
}

function CampaignRow({ campaign, review }: { campaign: CampaignBrief; review?: (campaign: CampaignBrief) => void }) {
  return <button className="campaign-summary campaign-button" onClick={() => review?.(campaign)} disabled={!review}><div className="campaign-name"><span className="campaign-icon"><Mail size={18} /></span><span><strong>{campaign.name}</strong><small>{campaign.targeting.industries.join(", ") || "All industries"} · {campaign.targeting.locations.join(", ") || "All locations"}</small></span></div><span className={`status ${campaign.status}`}><i /> {label(campaign.status)}</span><div><small>PER DAY</small><strong>{campaign.send_policy.emails_per_day}</strong></div><div><small>HOURLY</small><strong>{campaign.send_policy.hourly_send_limit}</strong></div><div><small>FOLLOW-UPS</small><strong>{campaign.send_policy.followup_days.length}</strong></div></button>;
}

function CampaignsView({ campaigns, connected, openCampaign, review }: { campaigns: CampaignBrief[]; connected: boolean; openCampaign: () => void; review: (campaign: CampaignBrief) => void }) {
  return <><section className="page-heading"><div><span>CAMPAIGNS</span><h1>Campaigns</h1><p>Generate a draft, review its targeting and policy, then activate it.</p></div><button className="primary-button" onClick={openCampaign} disabled={!connected}><Plus size={16} /> New campaign</button></section><section className="panel campaign-list"><div className="table-heading"><span>{campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}</span><small>Activating a draft replaces the current active campaign</small></div>{campaigns.map((campaign) => <CampaignRow key={campaign.id} campaign={campaign} review={campaign.status === "draft" ? review : undefined} />)}{campaigns.length === 0 && <div className="empty-state"><Target size={24} /><strong>No campaigns yet</strong><p>Describe your audience and offer to generate the first draft.</p></div>}</section></>;
}

function LeadsView({ leads, total, filter, setFilter }: { leads: PipelineLead[]; total: number; filter: LeadState | "all"; setFilter: (state: LeadState | "all") => void }) {
  return <><section className="page-heading"><div><span>LEADS</span><h1>Pipeline leads</h1><p>Read-only lead records from the AutoReach orchestrator.</p></div><div className="total-pill">{total} total</div></section><section className="panel lead-panel"><div className="filter-bar"><Search size={16} /><span>Filter by state</span><select value={filter} onChange={(event) => setFilter(event.target.value as LeadState | "all")}>{leadStates.map((state) => <option key={state} value={state}>{label(state)}</option>)}</select></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>LEAD</th><th>INDUSTRY</th><th>STATE</th><th>QUALITY</th><th>PRIORITY</th><th>UPDATED</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id}><td><div className="lead-cell"><span className="avatar purple">{initials(lead.company)}</span><span><strong>{lead.company}</strong><small>{lead.email || "No verified email"}</small></span></div></td><td>{lead.industry || "—"}</td><td><span className={`lead-state ${lead.state}`}>{label(lead.state)}</span></td><td><strong>{Math.round(lead.quality_score * 100)}</strong><small>/100</small></td><td>{lead.priority.toFixed(2)}</td><td>{formatTime(lead.updated_at)}</td></tr>)}</tbody></table></div>{leads.length === 0 && <div className="empty-state"><UsersRound size={24} /><strong>No matching leads</strong><p>Run discovery or choose a different state filter.</p></div>}<div className="table-foot">Showing up to 100 records. The API uses offset pagination.</div></section></>;
}

function PipelineView({ data, connected, running, run }: { data: DashboardData; connected: boolean; running: string; run: (kind: "find" | "cycle" | "stage", stage?: PipelineStage) => Promise<void> }) {
  return <><section className="page-heading"><div><span>PIPELINE</span><h1>Pipeline controls</h1><p>Queue durable jobs and monitor their progress.</p></div><button className="primary-button" disabled={!connected || !!running} onClick={() => void run("cycle")}><Play size={15} /> Run cycle</button></section><section className="control-grid"><article className="panel control-card"><span className="control-icon"><Search size={19} /></span><div><h2>Discover leads</h2><p>Find new leads for the active campaign. Discovery is not included in a normal cycle.</p></div><button className="secondary-button" disabled={!connected || !!running} onClick={() => void run("find")}>{running === "find" ? <RefreshCw className="spin" size={15} /> : <Play size={15} />} Run discovery</button></article><article className="panel control-card"><span className="control-icon blue"><Activity size={19} /></span><div><h2>Process pipeline</h2><p>Run reply, follow-up, send, write, and research in dependency-safe order.</p></div><button className="secondary-button" disabled={!connected || !!running} onClick={() => void run("cycle")}>{running === "cycle" ? <RefreshCw className="spin" size={15} /> : <Play size={15} />} Run one cycle</button></article></section><section className="panel stages-panel"><div className="panel-title"><div><h2>Run one stage</h2><p>Use targeted jobs for operations and testing</p></div></div><div className="stage-buttons">{stages.map((stage) => <button key={stage} disabled={!connected || !!running || (stage === "reply" && !data.config.reply_handling_enabled)} onClick={() => void run("stage", stage)}>{running === stage ? <RefreshCw className="spin" size={15} /> : <Play size={14} />}<span><strong>{label(stage)}</strong><small>{stage === "reply" && !data.config.reply_handling_enabled ? "Disabled by runtime" : `${data.health.stages.find((item) => item.stage === stage)?.queue_depth || 0} queued`}</small></span></button>)}</div></section><JobList jobs={data.jobs} /></>;
}

function JobList({ jobs, compact = false }: { jobs: JobRecord[]; compact?: boolean }) {
  return <article className={`panel jobs-panel ${compact ? "compact" : ""}`}><div className="panel-title"><div><h2>Recent jobs</h2><p>Newest first</p></div></div><div className="job-list">{jobs.map((job) => <div className="job-row" key={job.id}><span className={`job-icon ${job.status}`}>{job.status === "succeeded" ? <CheckCircle2 size={15} /> : job.status === "failed" ? <AlertTriangle size={15} /> : <RefreshCw className={job.status === "running" ? "spin" : ""} size={15} />}</span><span><strong>{label(job.kind)}</strong><small>{job.status === "failed" ? job.error : formatTime(job.created_at)}</small></span><span className={`job-status ${job.status}`}>{label(job.status)}</span></div>)}{jobs.length === 0 && <div className="empty-state small"><Clock3 size={20} /><strong>No jobs yet</strong></div>}</div></article>;
}

function RuntimeView({ data, connected }: { data: DashboardData; connected: boolean }) {
  const rows = [["Connection", connected ? "Connected" : "Demo mode"], ["Environment", data.config.environment], ["Simulation", data.config.simulate ? "Enabled" : "Disabled"], ["Scheduler", data.config.scheduler_enabled ? "Enabled" : "Disabled"], ["Timezone", data.config.scheduler_timezone], ["Reply handling", data.config.reply_handling_enabled ? "Enabled" : "Disabled"]];
  return <><section className="page-heading"><div><span>RUNTIME</span><h1>Runtime configuration</h1><p>Read-only settings reported by the AutoReach API.</p></div></section><section className="settings-grid"><article className="panel runtime-card"><div className="panel-title"><div><h2>Service</h2><p>Configuration cannot be changed through the current API</p></div><Database size={18} /></div>{rows.map(([name, value]) => <div className="setting-row" key={name}><span>{name}</span><strong>{label(value)}</strong></div>)}</article><article className="panel runtime-card"><div className="panel-title"><div><h2>Available stages</h2><p>Reported by /v1/config</p></div><Activity size={18} /></div><div className="available-stages">{data.config.stages.map((stage) => <span key={stage}><CheckCircle2 size={14} />{label(stage)}</span>)}</div><div className="runtime-note"><AlertTriangle size={16} /><p>Provider credentials, users, roles, and email accounts are configured outside this frontend because the API has no management endpoints yet.</p></div></article></section></>;
}
