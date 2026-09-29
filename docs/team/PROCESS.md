# Delivery Team Process

This is the handbook every agent in `.claude/agents/` follows. It defines the
team, the phase gates, who owns which document, the ID scheme, and the rules
that keep a large agent team coherent. If an agent's own file and this
handbook disagree, raise it with the `orchestrator` - do not pick one silently.

## 1. The team

| Phase | Agent | Owns (sole editor) |
|---|---|---|
| 0. Coordination | `orchestrator` | `docs/project/` (task board, plan, RAID log, status reports) |
| 1. Discovery | `product-owner` | `docs/product/` (BRD, vision, backlog, roadmap) |
| 1. Discovery | `ba` | `docs/requirements/` (SRS, user stories, business rules, BPMN, data dictionary, RTM) |
| 1. Discovery | `ux-designer` | `docs/ux/` (flows, wireframes, UI spec, design system, accessibility) |
| 2. Design | `solution-architect` | `docs/architecture/`, `adr/` |
| 2. Design | `api-designer` | `api/` (OpenAPI, AsyncAPI, versioning policy) |
| 2. Design | `data-architect` | `db/` (ERD, schema, migration strategy, indexing, retention, legacy data migration) |
| 2. Design | `security-architect` | `docs/security/` (threat model, security requirements, authn/authz design, secrets, compliance) |
| 3. Build | `frontend-dev` | `frontend/` |
| 3. Build | `backend-dev` | `backend/` (one instance per service/domain in large projects) |
| 3. Build | `mobile-dev` | `mobile/` |
| 3. Build | `integration-dev` | `integrations/` (connectors, adapters, mappings) |
| 3. Build | `code-reviewer` | Review verdicts only - never edits code |
| 4. Quality | `qa-lead` | `docs/qa/` (strategy, plan, test cases, UAT scenarios) |
| 4. Quality | `test-automation` | `tests/` (API, contract, E2E, regression suites) |
| 4. Quality | `performance-tester` | `perf/`, `docs/qa/performance/` |
| 4. Quality | `security-tester` | `docs/security/test-reports/` |
| 5. Ops | `devops` | `.github/workflows/`, `deploy/`, `infra/`, Dockerfiles |
| 5. Ops | `release-manager` | `docs/release/`, `CHANGELOG.md`, tags |
| 5. Ops | `sre` | `docs/ops/`, `observability/` (SLOs, alerts, dashboards, runbooks, postmortems) |
| 6. Docs | `tech-writer` | `docs/guides/`, published API docs |
| 6. Support | `support` | `docs/support/` (triage log, bug reports) |

**Minimum viable team.** When 20+ agents is too many, merge roles:
`product-owner`+`ba`, `solution-architect`+`api-designer`+`data-architect`,
`frontend-dev`, `backend-dev`, `code-reviewer`, `qa-lead`+`test-automation`,
`devops`+`release-manager`+`sre` - seven agents plus the `orchestrator`. The
orchestrator records which merge is in effect in `docs/project/plan.md`, and a
merged agent owns the union of the merged roles' folders.

## 2. Flow and gates

Each gate must pass before the next phase starts. The `orchestrator` checks the
gate against the Definition of Done below and records the result in
`docs/project/gates.md`.

| # | Work | Gate | Gate passes when |
|---|---|---|---|
| G1 | PO + BA + UX produce BRD, SRS, UI spec | Requirements approved | Every FR/NFR has an ID, is testable, and traces to a BR; UI spec covers every user story; PO has signed off; open questions list is empty or explicitly deferred |
| G2 | Architect + API + Data + Security produce architecture, contracts, schema, threat model | Design review | Every FR maps to a component and (if exposed) an endpoint; OpenAPI lints clean; schema covers the data dictionary; every STRIDE threat has a mitigation or accepted-risk entry; ADRs written for each significant decision |
| G3 | QA writes tests in parallel with FE/BE/Mobile; Code Reviewer reviews every change | CI green + review approved | Build, unit, integration, contract tests pass in CI; `code-reviewer` reports no blocking findings; RTM links each FR to code and tests |
| G4 | Performance + Security testing, then UAT | NFRs met, no critical bugs | Every NFR target measured and met (or waived by PO in writing); no open critical/high security findings; UAT scenarios pass |
| G5 | Release Manager + DevOps deploy | Go / no-go | Go/no-go checklist complete, rollback plan tested, release notes written |
| G6 | SRE monitors; Support feeds issues back | Ongoing | SLO dashboards and alerts live; every incident gets a triage entry routed to an owner with requirement IDs |

Feedback loops route back through the `orchestrator`: a failing test goes to
the builder who owns the code; a requirement gap goes to `ba`; a contract gap
goes to `api-designer`; a design gap goes to `solution-architect`.

## 3. Traceability and IDs

Everything traces: **BR → FR/NFR → US/AC → API endpoint / screen → code → test → release.**

| Prefix | Meaning | Owner |
|---|---|---|
| `BR-###` | Business requirement | `product-owner` |
| `FR-###`, `NFR-###` | Functional / non-functional requirement | `ba` |
| `US-###`, `AC-###.n` | User story, acceptance criterion n | `ba` |
| `BRULE-###` | Business rule | `ba` |
| `SCR-###` | Screen / UI state spec | `ux-designer` |
| `ADR-####` | Architecture decision record | `solution-architect` |
| `SEC-###`, `THR-###` | Security requirement, threat | `security-architect` |
| `TC-###` | Test case | `qa-lead` |
| `CR-###` | Change request | raised by anyone, decided by the document owner |
| `RISK-/ASM-/ISS-/DEP-###` | RAID log entries | `orchestrator` |
| `BUG-###`, `INC-###` | Bug, incident | `support`, `sre` |

- Commits and PRs reference the IDs they implement (`FR-012`, `US-004`).
- Test names or tags carry the `TC-###` and the `FR-###` they verify.
- `docs/requirements/rtm.md` is the traceability matrix. `ba` owns its
  structure; `test-automation` and builders report the links they add, and the
  RTM is regenerated from those references (script in `tools/rtm/` once
  `devops` builds it) rather than hand-maintained where possible.

## 4. Rules

1. **Single source of truth is the repo.** `docs/`, `api/`, `db/`, `adr/` are
   versioned together with the code. Agents read from and write to the repo -
   never "remember" a decision that is not written down.
2. **Contracts are owned.** Only the owner edits a document (table in §1).
   Anyone else files a change request: copy
   `docs/team/change-request-template.md` to `docs/change-requests/CR-###.md`
   and hand it to the `orchestrator`, who routes it to the owner.
3. **Everything traces to IDs.** Work without an ID is not started.
4. **Nobody grades their own work.** Reviewers and testers are never the
   builders of what they check. `test-automation` writes tests from the spec,
   not from the code.
5. **Scope each agent's context.** The orchestrator hands each agent only the
   slices it needs (the relevant FR IDs, the relevant OpenAPI paths), not the
   whole document set.
6. **Done is defined per agent.** Each agent file has a Definition of Done
   checklist; the orchestrator verifies it before accepting the output.
7. **Escalate rather than invent.** Any ambiguity goes back to `ba` (what) or
   `solution-architect` (how) via the orchestrator. Agents list assumptions and
   open questions explicitly; they never fill a gap silently.

## 5. Handoff report

Every agent ends its work with this report so the orchestrator can check gates
without re-reading everything:

```
Status: done | blocked | needs-decision
Artifacts: <paths created or changed>
IDs covered: <FR-/US-/TC-/... IDs this work satisfies>
Definition of Done: <each checklist item: pass / fail / n.a.>
Change requests raised: <CR-### or none>
Open questions / escalations: <for whom, and what decision is needed>
Assumptions made: <each one, so it can be corrected>
```
