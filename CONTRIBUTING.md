# Contributing

## Branching & PRs
- Use feature branches: `feat/<area>-<short>` or `fix/<area>-<short>`
- Open PRs to `main`, require 1 review, CI must pass

## Code style
- TS: ESLint + Prettier
- Python: Ruff + Black
- Go: golangci-lint

## Definition of Done
- OpenAPI/AsyncAPI updated
- Unit + integration tests pass
- k6 baseline (where applicable)
- Metrics + traces + logs added
- Security scans (Trivy, Semgrep) green