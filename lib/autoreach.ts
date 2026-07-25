export type JobStatus = "queued" | "running" | "succeeded" | "failed";
export type PipelineStage = "find" | "research" | "write" | "send" | "followup" | "reply";
export type LeadState =
  | "new" | "discovered" | "researching" | "researched" | "writing" | "ready"
  | "sending" | "sent" | "following_up" | "replied" | "handling" | "handled"
  | "meeting_booked" | "no_reply" | "closed" | "error" | "dead";

export interface RuntimeConfig {
  environment: string;
  simulate: boolean;
  reply_handling_enabled: boolean;
  scheduler_enabled: boolean;
  scheduler_timezone: string;
  stages: PipelineStage[];
}

export interface JobRecord<TResult = unknown> {
  id: string;
  kind: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  result: TResult | null;
  error: string;
  dedupe_key: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface StageResult {
  stage: PipelineStage;
  agent: string;
  processed: number;
  succeeded: number;
  failed: number;
  advanced_ids: string[];
  new_lead_ids: string[];
  outcomes: Record<string, string>;
  errors: string[];
  ok: boolean;
  duration_seconds: number;
}

export interface CampaignBrief {
  id: string;
  name: string;
  user_prompt: string;
  summary: string;
  targeting: {
    industries: string[];
    company_sizes: string[];
    locations: string[];
    job_titles: string[];
    exclude_industries: string[];
    b2b_only: boolean;
  };
  messaging: {
    offer: string;
    value_proposition: string;
    tone: string;
    call_to_action: string;
    proof_points: string[];
    forbidden_claims: string[];
  };
  send_policy: { emails_per_day: number; hourly_send_limit: number; followup_days: number[] };
  source_urls: string[];
  agent_instructions: Record<string, string>;
  status: "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface PipelineLead {
  id: string;
  state: LeadState;
  email: string;
  company: string;
  industry: string;
  quality_score: number;
  company_size_score: number;
  industry_fit_score: number;
  recency_score: number;
  manual_bump: boolean;
  priority: number;
  attempts: number;
  last_error: string;
  retry_after: string | null;
  discovered_at: string | null;
  sent_at: string | null;
  replied_at: string | null;
  state_entered_at: string;
  source_job: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PipelineHealth {
  healthy: boolean;
  stages: Array<{
    stage: Exclude<PipelineStage, "find">;
    queue_depth: number;
    in_progress: number;
    error_rate: number;
    circuit: "closed" | "open" | "half_open";
    oldest_wait_hours: number;
    bottleneck: boolean;
  }>;
  alerts: string[];
  dead_letter_count: number;
  computed_at: string;
}

export interface PipelineReport {
  funnel: Partial<Record<LeadState, number>>;
  sent_today: number;
  replies_today: number;
  meetings_booked: number;
  reply_rate: number;
  meeting_rate: number;
  dead_letter_count: number;
  alerts: string[];
  optimizations: string[];
  generated_at: string;
}

export interface DashboardData {
  config: RuntimeConfig;
  report: PipelineReport;
  health: PipelineHealth;
  campaigns: CampaignBrief[];
  jobs: JobRecord[];
  leads: PipelineLead[];
  leadTotal: number;
}

export class AutoReachApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(typeof body === "object" && body && "detail" in body ? String((body as { detail: unknown }).detail) : `API request failed (${status})`);
  }
}

const BFF_BASE = "/api/autoreach";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BFF_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({ detail: "The API returned an unreadable response." }));
  if (!response.ok) throw new AutoReachApiError(response.status, body);
  return body as T;
}

export const autoreach = {
  config: () => request<RuntimeConfig>("/v1/config"),
  report: () => request<PipelineReport>("/v1/report"),
  health: () => request<PipelineHealth>("/v1/health"),
  campaigns: (limit = 50, offset = 0) => request<{ items: CampaignBrief[] }>(`/v1/campaigns?limit=${limit}&offset=${offset}`),
  createCampaign: (prompt: string) => request<JobRecord<CampaignBrief>>("/v1/campaigns", { method: "POST", body: JSON.stringify({ prompt }) }),
  activateCampaign: (id: string) => request<CampaignBrief>(`/v1/campaigns/${encodeURIComponent(id)}/activate`, { method: "POST" }),
  leads: (state?: LeadState, limit = 100, offset = 0) => {
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (state) query.set("state", state);
    return request<{ items: PipelineLead[]; total: number }>(`/v1/leads?${query}`);
  },
  jobs: (limit = 50, offset = 0) => request<{ items: JobRecord[] }>(`/v1/jobs?limit=${limit}&offset=${offset}`),
  job: <TResult = unknown>(id: string) => request<JobRecord<TResult>>(`/v1/jobs/${encodeURIComponent(id)}`),
  find: () => request<JobRecord<StageResult>>("/v1/jobs/find", { method: "POST" }),
  cycle: () => request<JobRecord<Partial<Record<PipelineStage, StageResult>>>>("/v1/jobs/cycle", { method: "POST" }),
  stage: (stage: PipelineStage) => request<JobRecord<StageResult>>(`/v1/jobs/stages/${stage}`, { method: "POST" }),
};

export async function waitForJob<TResult>(id: string, signal?: AbortSignal): Promise<JobRecord<TResult>> {
  const deadline = Date.now() + 10 * 60_000;
  let delay = 1_000;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const job = await autoreach.job<TResult>(id);
    if (job.status === "succeeded") return job;
    if (job.status === "failed") throw new Error(job.error || `Job ${job.id} failed`);
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, delay);
      signal?.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
    });
    delay = Math.min(5_000, delay + 500);
  }
  throw new Error(`Timed out waiting for job ${id}`);
}

