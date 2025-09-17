# 🚀 Multi-Modal AI Platform — Starter Repo

This is a **starter skeleton** for the dual-path (Providers + Self-Hosted) multi‑modal AI platform.
Use this with the Developers’ Handbook you already have.

## Quick start (local)
```bash
docker compose up -d
pnpm -C services/jobs-api install && pnpm -C services/jobs-api dev
```

## Repo layout
- `services/` — microservices (API Gateway, Jobs API, Router, Adapters, etc.)
- `portal/` — Next.js dev console (placeholder)
- `sdks/` — SDKs (TypeScript/Python/Go/Java)
- `infra/` — Terraform & Helm
- `db/migrations/` — SQL migrations
- `observability/` — OTel collector, Prometheus/Grafana dashboards
- `docs/` — OpenAPI & AsyncAPI specs
- `.github/workflows/` — CI pipelines