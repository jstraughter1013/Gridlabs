# GridLabs Feature Roadmap

**Zero-config, component-first UI preview for Vite + React projects**

This document outlines the complete feature roadmap for GridLabs, tracking what's already implemented and what's planned for future releases. All features are evaluated against our core "zero-configuration" philosophy.

## Core Philosophy

> **Zero-Configuration Creed**: Users should be able to drop a component in `src/`, push to Git, and see it live in seconds—without any additional setup, accounts, or configuration.

---

## 0. Core "Zero-Config" Experience (Launch MVP)

| Feature | Status | Description | Priority |
|---------|--------|-------------|----------|
| ✅ Grid View | **IMPLEMENTED** | Auto-discovers every React/Vue/Svelte component in the repo and renders them in a localhost grid the moment you hit Save | - |
| ✅ Vite-powered HMR | **IMPLEMENTED** | Millisecond reloads; no extra dev server | - |
| ❌ Branch Preview URLs | **NOT IMPLEMENTED** | Push to Git → GridLabs Cloud builds the grid and serves it at branch-name.gridlabs.app (Vercel-style) | **HIGH** |
| ❌ Smart-Default Props | **NOT IMPLEMENTED** | AST/TypeScript analysis chooses safe default values so 90% of components render first try | **MEDIUM** |
| ❌ Context Auto-Mocker | **NOT IMPLEMENTED** | Detects common providers (Theme, Router, Redux, i18n) and wraps components automatically | **HIGH** |

## 1. Visual Quality Gates (Reliability)

| Feature | Status | Description | Priority |
|---------|--------|-------------|----------|
| ✅ Snapshot Infrastructure | **IMPLEMENTED** | Playwright captures screenshots, uploads to Firebase Storage | - |
| ✅ Diff Engine | **IMPLEMENTED** | Sharp compares images, generates diff PNGs for > 0.1% changes | - |
| ✅ Visual Badges | **IMPLEMENTED** | Changed components display a badge with diff percentage | - |
| ✅ Changes Panel | **IMPLEMENTED** | Drawer UI lists all components with visual changes | - |
| ✅ Auto-refresh Toast | **IMPLEMENTED** | Notifies users when a newer build is available | - |
| ✅ AI Summary | **IMPLEMENTED** | GPT-4o generates one-line descriptions of visual changes | - |

## 2. Workflow Integrations (Collaboration)

| Feature | Status | Description | Priority |
|---------|--------|-------------|----------|
| ✅ PR Comment Bot | **IMPLEMENTED** | Posts build links and visual changes on every PR | - |
| ✅ Webhook Notifications | **IMPLEMENTED** | Sends change summaries to Slack/Teams | - |
| ✅ Relic-file Scanner | **IMPLEMENTED** | Detects unused modules & duplicate files | - |
| ✅ Search/Filter Bar | **IMPLEMENTED** | Fuzzy search with `/` hotkey filters grid cards | - |
| ❌ Walkthrough GIF Generation | **NOT IMPLEMENTED** | Automatically generate GIFs of component interactions | **MEDIUM** |
| ❌ Jira/Zephyr Export | **NOT IMPLEMENTED** | Export component documentation to project management tools | **LOW** |

## 3. Developer Experience (Convenience)

| Feature | Status | Description | Priority |
|---------|--------|-------------|----------|
| ❌ VS Code Extension | **PLANNED** | "Open Grid Lab" command starts `vite dev` (if needed) and opens `/__grid` | **MEDIUM** |
| ✅ Copy-link Button | **IMPLEMENTED** | Copies `?sha=<commit>` URL so reviewers see the same version | - |
| ❌ GPT Auto-Story | **NOT IMPLEMENTED** | AI-generated documentation for components | **LOW** |
| ❌ Export to Storybook | **NOT IMPLEMENTED** | Convert GridLabs components to Storybook format | **LOW** |

## 4. GridLabs Cloud (Essential for Zero-Config)

| Feature | Status | Description | Priority |
|---------|--------|-------------|----------|
| ✅ Dedicated Cloud Platform | **IMPLEMENTED** | GridLabs-managed deployment platform (no Vercel required) | **CRITICAL** |
| ❌ One-Click Git Integration | **NOT IMPLEMENTED** | Connect repository and automatically deploy | **CRITICAL** |
| ❌ Branch-specific URLs | **NOT IMPLEMENTED** | Automatic deployments for each branch | **HIGH** |
| ❌ Team Collaboration | **NOT IMPLEMENTED** | User management and access controls | **MEDIUM** |
| ❌ Usage Analytics | **NOT IMPLEMENTED** | Track component usage and popularity | **LOW** |

## 5. Design Integration (Ecosystem)

| Feature | Status | Description | Priority |
|---------|--------|-------------|----------|
| ❌ Figma Sync | **NOT IMPLEMENTED** | Two-way sync with design tools | **LOW** |
| ❌ Design Token Visualization | **NOT IMPLEMENTED** | Show how design tokens are used across components | **LOW** |
| ❌ Plugin Ecosystem | **NOT IMPLEMENTED** | Allow third-party extensions | **LOW** |

---

## Immediate Priorities

| Rank | Epic | Why it moves the needle now | Key Deliverables (8-week runway) |
|------|------|----------------------------|----------------------------------|
| 1 | GridLabs Cloud v0 ("Upload-&-Serve") | Gives every repo a share-link without Vercel-signup—your core differentiation. | • Wildcard DNS `*.gridlabs.app` + Cloudflare R2 bucket<br>• Presigned-URL API (`POST /uploads`) + auth handshake<br>• `npx gridlabs upload` CLI that zips `vite build` output and pushes to the bucket |
| 2 | GitHub App Auto-Trigger | Turns manual CLI into zero-touch previews—critical for virality and CI-less teams. | • OAuth + webhook listener (`push`, `pull_request`)<br>• Background job that re-uses the upload API<br>• PR comment with branch URL + visual-diff badge |
| 3 | Context Auto-Mocker | Ensures 80–90% of real-world components render on first try—protects the "it just works" promise. | • Heuristics for React‑Router, MUI Theme, Redux, i18n<br>• Fallback dummy providers + dev overlay for edge cases |
| 4 | Smart-Default Props | Cuts the "blank component" rate even further and becomes training data for future AI features. | • Type‑checker pass to pull prop types / defaults<br>• Simple value generator (strings, numbers, enums)<br>• Opt‑in `/* @gridlabs.skip */` pragma for unsafe props |
| 5 | Usage Analytics MVP | Starts building the proprietary data moat and a future paid tier. | • Tiny JS snippet injected at build<br>• Supabase/ClickHouse event ingest (`view`, `diffClick`)<br>• Dashboard card: "Top Viewed" + "Most Changed" components |

## Long-term Vision

The complete GridLabs platform will provide an end-to-end solution for component development, visualization, testing, and collaboration—all with zero configuration required from users. The focus on simplicity and automation will continue to be our key differentiator from tools like Storybook that require significant manual setup.

---

## Execution Timeline & Effort Estimates (Apr – Jul 2025)

### Capacity & Assumptions

* **Solo dev capacity:** 25 focused coding hours per week (≈40 hrs on calendar)
* **Frontier‑AI assist boost:** +30 % productivity (tasks take 70 % of manual time)

### Remaining Immediate‑Priority Epics

| Rank | Epic | Raw pts (manual hrs) | Net hrs w/ AI (×0.7) | Net weeks* | Blocking |
|------|------|---------------------|----------------------|------------|----------|
| 1 | ✅ Cloud v0 – Upload & Serve | 60 pts (120 h) | **84 h** | **3.5 wks** | **COMPLETE** |
| 2 | GitHub App Auto‑Trigger | 45 pts (90 h) | **63 h** | **2.5 wks** | Cloud API |
| 3 | Context Auto‑Mocker | 30 pts (60 h) | **42 h** | **1.7 wks** | parallel |
| 4 | Smart‑Default Props | 28 pts (56 h) | **39 h** | **1.6 wks** | none |
| 5 | Usage Analytics MVP | 30 pts (60 h) | **42 h** | **1.7 wks** | Cloud URLs |

\*Weeks = net hrs ÷ 25.

### Cumulative Calendar Timeline

| Phase | Calendar span | Milestone |
|-------|---------------|-----------|
| Sprint 1–4 | **Apr 28 '25** | ✅ Cloud v0 live; CLI upload & share links |
| Sprint 5–6 | **Jun 2 – Jun 13 ’25** | GitHub App private beta (auto PR links) |
| Sprint 7 | **Jun 16 – Jun 27 ’25** | Context Auto‑Mocker GA |
| Sprint 8 | **Jun 30 – Jul 11 ’25** | Smart‑Default Props beta |
| Sprint 9 | **Jul 14 – Jul 25 ’25** | Usage Analytics dashboard → **v0 Public Launch** |

_Total elapsed: **≈ 12 weeks (end of July 2025)**_

### Stretch Features (Aug – Oct 2025)

| Feature | Net hrs (AI) | Parallel? | Value add |
|---------|--------------|-----------|-----------|
| Walk‑through GIFs | 24 | yes | low |
| VS Code Extension | 40 | yes | medium |
| Team Collaboration & RBAC | 48 | after Analytics | **high** |
| Jira / Zephyr Export | 18 | yes | low |
| GPT Auto‑Story | 32 | after Smart Props | medium |
| Export‑to‑Storybook | 20 | any time | strategic |

### Key Velocity Safeguards

1. Prototype infra locally first (Minio + Ngrok) before wiring Cloudflare buckets.
2. Write reusable Terraform/CDK modules—"automate once, copy thrice".
3. End every week with a dog‑food demo link to prevent scope creep.
4. Let AI own boilerplate; you review, not re‑type.
5. Reserve ~10 % weekly for refactor/retro to keep tests green.

---

### Bottom Line

At current 16‑hour‑for‑12‑point velocity—and with Frontier AI covering scaffolding—**GridLabs Cloud GA ships by late July 2025**. You’ll then have ~13 months to grow revenue, land enterprise logos, and enter M&A talks well before the Fall 2026 consolidation window.

