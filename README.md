

# 🚀 Multi-Modal AI Platform — Developers’ Handbook (Shareable README)

> Version: 1.0 • Owner: Platform Engineering • Audience: Junior–Mid Developers

This document is an end‑to‑end, **junior‑friendly** guide that explains **what we’re building**, the **tech stack**, and **exactly how to start** coding and running the platform locally. You can hand this to the team as-is.

---

## 1) What We’re Building (Plain English)

We’re creating one API that can handle **Text**, **Image**, **Audio**, and **Video** generation/processing. Every request can be executed in **two ways**:

1. **Provider Path (A):** Call external AI providers (fal.ai, Replicate, OpenRouter, Stability, etc.).  
2. **Self‑Hosted Path (B):** Run open‑source models on **our own GPU cluster**.

A **Router** decides which path is used per request (fastest, cheapest, or SLA/policy‑safe). We **stream results**, **meter usage**, **capture cost**, and **store artifacts** (e.g., images/audio/video) securely. The platform is **multi‑tenant** with **SSO**, **quotas**, **observability**, **billing**, and **reliable workflows** built in.

---

## 2) Mental Model & Diagram

### Planes & Layers

- **Edge Plane:** API Gateway (auth, rate limits, WAF), Streaming Gateway (SSE/WS).  
- **Control Plane:** Identity (Keycloak), Policy (OPA), Jobs API, Router, Billing/Ledger, Model Catalog, Orchestration (Temporal).  
- **Data Plane:** Provider Adapters (fal/replicate/openrouter/stability), Local Adapters (vLLM/Triton/TGI/Whisper/Coqui), GPU Workers.  
- **Data & Storage:** Postgres, Redis, MinIO, ClickHouse, NATS/Kafka.  
- **Observability:** Prometheus, Grafana, OpenTelemetry, Jaeger, Loki.

### ASCII Lifecycle

```
Client
  |  HTTP/2 + Bearer API key / OIDC
  v
[ API Gateway (Envoy/Kong) ] --mTLS--> [ Jobs API ]
             |                                   \
             |  SSE/WS (stream tokens/chunks)     \  NATS "job.created"
             v                                     v
       [ Streaming GW ]                        [ Router ]
                                                  |   \
                                     (A) Providers |    \ (B) Self-hosted
                                                  v      v
                                     [ provider adapters ]     [ local adapters ]
                                     (fal/replicate/...)       (vLLM/Triton/TGI/Whisper/Coqui)
                                                  |                    |
                                                  v                    v
                                      Responses + Usage        Responses + Usage
                                                  \                    /
                                                   \                  /
                                                    v                v
                                                [ Jobs API ] -- final result -> Client (SSE/HTTP)
                                                         \
                                                          \ writes: Postgres (job, ledger), MinIO (artifacts),
                                                           \        ClickHouse (analytics), NATS events
```

---

## 3) Tech Stack (Primary Choices, with “Why”)

### Runtime & Clusters
- **Kubernetes 1.29+** (containerd). Nodepools: `general`, `gpu` (A100/H100; MIG).  
- **NVIDIA GPU Operator** (manages drivers/CUDA; enables MIG).  
- OS: **Ubuntu LTS**, cgroups v2.

### Edge & Networking
- **Envoy Gateway** *(or Kong on Envoy)* — WAF, JWT, rate limits, HTTP/2 + gRPC, SSE/WS pass‑through.  
- **mTLS** service‑to‑service (mesh optional at start).  
- **Streaming:** **SSE** for token streams; **WebSocket** for duplex audio.

### Identity, Policy, Secrets
- **Keycloak** — OIDC/SAML SSO; realms/clients/roles for tenants/workspaces.  
- **OPA + Gatekeeper** — ABAC/RBAC, admission policies, “deny by default”.  
- **HashiCorp Vault (+ KMS/HSM)** — Provider keys, DB creds, webhook secrets.

### Data & Storage
- **PostgreSQL 16** (HA via CloudNativePG/Patroni) — tenants, jobs, ledger, policies; **RLS** for isolation.  
- **Redis 7** — rate limits, idempotency, short‑TTL results.  
- **MinIO (S3)** — artifacts & model assets (SSE‑KMS); presigned URLs.  
- **ClickHouse 24+** — analytics (usage, latency, cost) at low cost.  
- **NATS JetStream** *(or Kafka)* — events: `job.*`, `billing.*`, `provider.*`.

### Orchestration
- **Temporal** — durable workflows for multi‑step pipelines (retries/compensation).

### Inference (Self‑Hosted)
- **Text:** **vLLM** (primary), **TGI** (alt), **TensorRT‑LLM** for ultra‑low latency.  
- **Image:** **Diffusers + SDXL/LCM/ControlNet** on **Triton**; **Real‑ESRGAN** (upscale); **CodeFormer/GFPGAN** (face fix).  
- **Audio:** **Faster‑Whisper (CTranslate2)** for STT; **Coqui‑TTS/Piper** for TTS; **torchaudio/librosa** for DSP.  
- **Video:** **AnimateDiff/SVD** generation; **RIFE/FILM** interpolation; **FFmpeg** mux/post.  
- **Scaling:** **KEDA** (scale by queue depth), MIG partitions; priority classes (text > audio > image > video).

### Provider Adapters (External Path)
- **fal.ai**, **Replicate**, **OpenRouter**, **Stability** — HTTP/gRPC clients; normalize outputs and usage (tokens/steps/gpu_sec/audio_sec).

### Observability
- **Prometheus + Alertmanager** — metrics (QPS, latency, errors, GPU util, queue depth).  
- **Grafana** — dashboards (per‑tenant usage/cost, provider health, pipeline latency).  
- **OpenTelemetry + Jaeger** — distributed tracing.  
- **Loki** *(or ELK)* — JSON logs (PII‑minimized).

### CI/CD & Supply Chain
- **GitHub Actions** (CI), **Argo CD** (GitOps), **Helm** charts per service.  
- **Trivy/Grype** scans, **Syft** SBOM, **Cosign** image signing.  
- **Conftest (OPA)** policy gates.

### Frontend & SDKs
- **Next.js 14+**, TypeScript, Tailwind, shadcn/ui, **next‑intl** (RTL/LTR).  
- SDKs: **TypeScript/Node**, **Python**, **Go**, **Java** (generated from OpenAPI).  
- Docs: **Docusaurus** or **Nextra**.

---

## 4) Local Development (Step‑by‑Step)

### Prerequisites
Install: Docker, kubectl, Helm, Node 20, Python 3.11, Go 1.22, psql, redis‑cli, MinIO client (`mc`), `nats` CLI, Temporal CLI (`tctl`).

### Option A — Docker Compose (fastest to start)
`compose.yml` (Postgres, Redis, MinIO, ClickHouse, NATS, Temporal, Keycloak) — see repo. Then:

```bash
docker compose up -d
mc alias set local http://localhost:9000 minio minio123
mc mb local/artifacts-dev
```

### Option B — kind + Helm (closer to prod)
Create a kind cluster and install the same components via Helm charts. Use `kubectl port-forward` for local access.

---

## 5) Database Schema, RLS & Migrations (PostgreSQL 16)

**Core tables**: `tenants`, `workspaces`, `api_keys`, `jobs`, `job_steps`, `artifacts`, `usage_events`, `ledger_entries`, `holds`, `model_catalog`, `routing_policies`, `audit_logs`.

**RLS** (Row‑Level Security): enable on workspace‑scoped tables and set `app.workspace_id` after auth:
```sql
alter table jobs enable row level security;
create policy by_workspace on jobs
  using (workspace_id = current_setting('app.workspace_id')::ulid);
-- App sets: SET app.workspace_id = '<workspace-ulid>';
```

**Migrations:** Use **Flyway** or **Atlas** with expand → backfill → contract pattern.

---

## 6) Auth (Keycloak) & API Keys

- Users sign in via **Keycloak** (OIDC).  
- Server‑to‑server uses **API keys** stored as **hash** (prefix + argon2/bcrypt).  
- Header: `Authorization: Bearer <api_key>`.

Keycloak dev bootstrap: `http://localhost:8080` → admin/admin → create realm “dev”, client “portal”, roles: owner/admin/developer/analyst.

---

## 7) Jobs API (Stable Contract)

**Endpoints**
- `POST /v1/jobs/text.generate`
- `POST /v1/jobs/image.generate`
- `POST /v1/jobs/audio.transcribe`
- `POST /v1/jobs/audio.tts`
- `POST /v1/jobs/video.generate`
- `GET /v1/jobs/{id}`
- `GET /v1/jobs/{id}/stream` (SSE)

**Request (text example)**
```json
{
  "workspace_id": "wksp_01H...",
  "input": { "prompt": "Summarize this in Persian" },
  "model_hint": "llm:fa-medium",
  "routing_policy": "lowest_latency",
  "idempotency_key": "d72b-unique-123",
  "metadata": { "ticket_id": "CS-44" }
}
```

**Response (202)**
```json
{ "job_id": "job_01HF...", "status": "pending" }
```

**SSE**: `GET /v1/jobs/{id}/stream` → events `token`, `usage`, `complete`, `error`.

**Idempotency**: Clients send `Idempotency-Key`; server stores final result for 24h and returns same on retry.

**Webhooks**: HMAC (`sha256=<hex>`) over raw body, headers `X-Webhook-ID`, `X-Event-Timestamp`; reject skew > 5m; exponential retries.

---

## 8) Router (Choosing Provider vs Local)

**Inputs**: modality, `model_hint`, SLA, max latency, workspace policy, provider health, **price** (UMU → IRR).  
**Strategies**: `lowest_latency` | `cheapest` | `sla_preferred` | weighted custom.  
**Fallback**: If chosen route fails/times out, try next best.

Typescript sketch:
```ts
type Candidate = { id:string; provider:"fal"|"replicate"|"openrouter"|"stability"|"local";
                   latency:number; price:number; sla:number; healthy:boolean; };

export function choose(cands: Candidate[], policy:"lowest_latency"|"cheapest"|"sla_preferred"){
  const ok = cands.filter(c => c.healthy);
  if (!ok.length) throw new Error("NO_ROUTE");
  const score = (c: Candidate) =>
    policy === "lowest_latency" ? c.latency :
    policy === "cheapest"       ? c.price   :
                                  -c.sla;
  return ok.sort((a,b)=>score(a)-score(b))[0];
}
```

---

## 9) Adapters

### Provider Adapters (fal/Replicate/OpenRouter/Stability)
- Plain HTTP/gRPC; must return **normalized** shape:
```json
{
  "content": "...",
  "usage": { "tokens": 123, "steps": 0, "gpu_sec": 0, "audio_sec": 0 },
  "latency_ms": 245,
  "cost_umu": 12.34,
  "provider_meta": { "model":"...", "id":"..." }
}
```

### Local Adapters (vLLM/Triton/TGI/Whisper/Coqui)
- **vLLM**: `/v1/chat/completions` or completions; map to same shape.  
- **Triton**: gRPC/HTTP tensors ↔ bytes; save artifacts to MinIO; return S3 URLs.  
- **Whisper (Faster‑Whisper)**: STT → text + timings; diarization optional.  
- **Coqui/Piper**: TTS → wav; upload to MinIO; return presigned URL.

---

## 10) File Service (Uploads, Presign, AV Scan)

**Flow**:  
1) `POST /v1/files/presign` → presigned S3 URL + key.  
2) Client PUT to MinIO directly.  
3) Server AV‑scans (ClamAV), MIME checks, size limits.  
4) Save `uri`, `sha256`, `size_bytes`, `mime` into `artifacts` table.

---

## 11) Usage Metering & Billing (Technical Only)

- Convert usage → **UMU** (tokens/steps/gpu_sec/audio_sec).  
- **UMU → IRR** via pricing table.  
- Lifecycle: **hold** (estimate) → **capture** (actual) → **release** (unused).  
- Double‑entry ledger (`ledger_entries`), tied to `job_id` and workspace.

---

## 12) Observability (Metrics, Traces, Logs)

- **Metrics**: QPS, p50/p95/p99 latency per model/provider, error rate, queue depth, GPU util, SSE drop rate.  
- **Tracing**: OTel spans gateway → router → adapter → runtime; include `job_id`.  
- **Logs**: Structured JSON; no PII; include `job_id`, `workspace_id`, `route`, `provider`.  
- **Dashboards**: Provider health; per‑tenant usage/cost; Temporal pipeline success & latency.

---

## 13) Security Defaults (Copy Into Policy)

- TLS 1.3 everywhere; **mTLS** internal.  
- **OPA** deny‑by‑default; allow per route/policy.  
- **Vault** stores secrets; rotate every 90 days.  
- **Webhook HMAC** required; timestamp skew ≤ 5m; replay nonce store.  
- **Upload limits**: body size caps (e.g., 50 MB text, 200 MB audio); MIME allow‑list; ClamAV scan.  
- **Audit logs**: hash‑chained; weekly WORM snapshot to MinIO.

---

## 14) API & Schema Sources of Truth

- **OpenAPI 3.1** for `/v1` REST; generate SDKs from it.  
- **AsyncAPI** for event topics.  
- **Error Catalog** (stable): `QUOTA_EXCEEDED`, `IDEMPOTENCY_CONFLICT`, `NO_ROUTE`, `PROVIDER_DEGRADED`, `POLICY_DENIED`, `VALIDATION_ERROR`, `INTERNAL_ERROR`.  
- **Pagination**: cursor‑based (`?cursor=...&limit=...`).  
- **IDs/time**: ULIDs; ISO‑8601 UTC timestamps.

---

## 15) Temporal Workflows (Reliable Multi‑Step Jobs)

- Register activities (e.g., `sttWhisper`, `summarizeLLM`, `ttsCoqui`, `persistArtifacts`).  
- Workflow does: call activities with retries; on failure, compensate (release hold).  
- Backoff with jitter; circuit‑breakers mark degraded providers for N seconds.

---

## 16) Testing Strategy (What to Actually Run)

- **Unit**: adapters, router, Jobs API.  
- **Contract (Pact)**: Jobs API ↔ adapters.  
- **Integration**: Docker Compose for Postgres/Redis/MinIO/NATS/Temporal + stub vLLM; run end‑to‑end tests.  
- **Load (k6)**: text SSE, audio WS, image/video batch.  
- **Security**: OWASP ZAP baseline, Semgrep static analysis, OPA policy tests.  
- **Chaos (staging)**: kill pod, inject latency; verify router fallback.

---

## 17) CI/CD Templates

- **GitHub Actions**: lint/test/build, SBOM, vuln scan, Docker build, Cosign sign.  
- **Argo CD**: app‑of‑apps; automated sync, prune, self‑heal.  
- **Helm Values**: per service (image, env, resources, ingress).

---

## 18) Quotas & Rate Limits (Redis Token Bucket)

- Per‑workspace: daily tokens/audio‑sec/GPU‑sec, concurrent jobs.  
- Edge rate limits (burst) at gateway; **authoritative** check in Jobs API.

---

## 19) Repo Layout (Monorepo)

```
/infra/terraform
/infra/helm
/cluster/argo-apps
/services/api-gateway
/services/jobs-api
/services/router
/services/adapters/provider/{fal,replicate,openrouter,stability}
/services/adapters/local/{vllm,tgi,triton,whisper,coqui}
/services/billing-ledger
/services/file-service
/services/orchestrator   # temporal workers
/portal
/sdks/{typescript,python,go,java}
/db/migrations
/observability/{dashboards,otel,alerts}
/docs/{openapi,asyncapi,runbooks}
```

---

## 20) SLOs, Retention, Backups

- **SLOs**: text p95 ≤ 300ms (local), STT RTF ≤ 0.6, image upscale ≤ 8s/op (A100), control plane ≥ 99.9%.  
- **Retention**: artifacts 30d (overridable), logs ≥ 1y, ledger ≥ 10y.  
- **Backups**: Postgres PITR + nightly full; MinIO versioning + lifecycle + weekly WORM snapshot; ClickHouse weekly snapshots.

---

## 21) Definition of Done (Per Feature)

- OpenAPI/AsyncAPI updated in repo.  
- Unit + contract + integration tests pass.  
- k6 baseline meets SLOs at target RPS.  
- Metrics/traces/logs added for new paths.  
- Runbook paragraph updated.  
- Helm values + Argo app updated; deployed to **staging**.  
- Security checks pass (Trivy, Semgrep, OPA gates).

---

## 22) First Tickets to Start Today

1. **Jobs API (TS/Fastify)** with `/text.generate`, `/jobs/:id`, `/jobs/:id/stream` + **Idempotency‑Key**.  
2. **Provider adapter** (fal or replicate) → normalize output & usage.  
3. **Local text adapter (vLLM)** → same contract as provider.  
4. **Router** with `lowest_latency` + fallback (local → provider).  
5. **Usage → UMU → IRR** + **ledger hold/capture/release**.  
6. **Prometheus & OTel** in Jobs API and first adapters.  
7. **Temporal** minimal pipeline: STT → summarize → TTS.  
8. **File service** with MinIO presign + AV scan.  
9. **Portal MVP**: API key manager + Playground for text streaming.

---

## 23) Glossary

- **SSE:** Server‑Sent Events (one‑way stream; great for tokens).  
- **vLLM/TGI:** High‑performance LLM servers.  
- **Triton:** NVIDIA inference server for multi‑model GPU hosting.  
- **Temporal:** Orchestrates multi‑step jobs with retries/state.  
- **UMU:** “Unified Metering Unit” (normalized usage for billing).  
- **RLS:** Row‑Level Security (DB‑level tenant/workspace isolation).

---

**You’re ready.** Start with provider path (fal/replicate), then bring up local vLLM, add routing fallback, wire Temporal pipelines, and ship the portal MVP.
