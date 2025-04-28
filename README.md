# GridLabs

**Zero-config, component-first UI preview for Vite + React projects**

GridLabs automatically discovers every `.tsx/.jsx` file under `src/`, builds them with your real app configuration, and lays them out in a share-able grid.  
It’s like Storybook, but without stories, routes, or manual wiring—drop a component in **`src/`**, push to Git, and it appears live in seconds.

**April 2025 Update:** Phase E (Workflow integrations) is now complete! PR comment bot, Slack notifications, relic-file scanner, search/filter bar, and auto-refresh toast are all implemented and working.

---

## ✨ Why GridLabs?

| Pain in current workflow | How GridLabs fixes it |
| ------------------------ | --------------------- |
| Manually creating stories / routes for every new component | **Auto-discover plug-in** finds files on `vite dev` and in CI builds |
| Colleagues can’t see WIP UI without pulling code | **Live grid** deployed to Vercel for every commit |
| Hard to share exact build during design reviews | **Copy-link** button copies `?sha=<commit>` URL so reviewers see the same version |
| Visual regressions spotted only after QA | **Automated screenshots + diff & GPT summary** for each commit |
| Zombie / duplicate files accumulate over time | **Relic-file scanner** flags unused or duplicate files right in the PR comment |

---

## ✅ Current status

| Area | Details |
|------|---------|
| **Scaffold** | Vite + React + TypeScript + Chakra UI |
| **Plug-in** | `vite-plugin-gridlabs` emits `virtual:gridlabs-map` (list of components) |
| **Grid UI** | `/__grid` route with component cards showing live thumbnails |
| **CI / Hosting** | Bitbucket → Vercel auto-deploy (Production) |
| **Components detected** | `HelloCard.tsx`, `Intro.tsx`, `Landing.tsx` (demo set) |
| **Snapshot Infrastructure** | Playwright captures screenshots, uploads to Firebase Storage |
| **Thumbnail Display** | Grid cards show component snapshots as backgrounds |
| **Diff Engine** | Sharp compares images, generates diff PNGs for > 0.1 % changes |
| **AI Summary** | GPT-4o generates one-line descriptions of visual changes |
| **Changes Panel** | Drawer UI lists all components with visual changes |
| **Diff Badges** | Changed components display a badge with diff percentage |
| **PR Comment Bot** | Posts build links and visual changes on every PR |
| **Webhook Notifications** | Sends change summaries to Slack/Teams |
| **Relic-file Scanner** | Detects unused modules & duplicate files |
| **Search/Filter Bar** | Fuzzy search with `/` hotkey filters grid cards |
| **Auto-refresh Toast** | Notifies users when a newer build is available |

Try the live instance 👉 **https://gridlabs.vercel.app/__grid**

---

## 🗺 Roadmap

### ✅ Phase C — Visual snapshots (COMPLETED)

1. **Snapshot engine** – Playwright screenshots each tile after `vite build`  
2. **Cloud storage** – PNGs uploaded to Firebase Storage under `gridshots/<commit>/`  
3. **Thumbnail display** – Grid shows snapshots as card backgrounds  

> ⭐ Value: Anyone can scroll the grid and see exactly how each component looked for that commit.

### ✅ Phase D — Smart diff & AI summary (COMPLETED)

* Compare current PNG vs. previous base with Sharp  
* Store diff image when > 0.1 % pixels change  
* GPT-4o generates a one-line summary of the visual change  
* Diff summaries surface inside the grid UI  

### ✅ Phase D.2 — UI integration for diffs (COMPLETED)

* Visual badges on changed components  
* Tooltip / click modal with AI summary + tri-view diff  
* “Changes” drawer listing all diffs  

### ✅ Phase E — Workflow integrations (COMPLETED)

* Pipeline posts PR comments with links to new Grid builds and component changes
* Slack/Teams webhook notifications for designers and QA
* Relic-file scanner detects unused modules & duplicate files
* Search/filter bar with `/` hotkey for instant filtering
* Auto-refresh toast notifies users when newer builds are available

### 🔄 Phase F — VS Code extension (optional) (NEXT UP)

* “Open Grid Lab” command starts `vite dev` (if needed) and opens `/__grid`  
* Publish to VS Code Marketplace

### Phase G — UX polish & docs

* Responsive tweaks & dark-mode pass  
* Logo / branding in navbar  
* One-page README with GIF demo & installation snippet

### Phase H — Public beta launch

* Invite 5–10 design-partner teams  
* Post on r/reactjs & Dev.to  
* Add Intercom or Slack link for feedback

---

## 🧹 Relic-file scanner (preview)

The relic scanner runs in CI **after the Vite build**:

1. Crawls `src/**/*.{tsx,ts,jsx,js}`  
2. Compares the file list to Vite’s dependency graph and the GridLabs component map  
3. Flags files that are **unreferenced** or **hash-identical duplicates**  
4. Appends the findings to the same PR comment created by the visual-diff bot

Example output in a pull-request comment:


---

## Contributing / Getting Started Locally

```bash
git clone https://bitbucket.org/sharedpath/gridlabs.git
cd gridlabs
npm install
npm run dev        # open http://localhost:5173/__grid
```

### Setting up Workflow Integrations

To enable the Phase E workflow integrations:

1. **PR Comments**: Add `BITBUCKET_ACCESS_TOKEN` to your repository variables in Bitbucket Pipelines settings

2. **Slack Notifications**: Add `SLACK_WEBHOOK_URL` to your repository variables

3. **Teams Notifications** (optional): Add `TEAMS_WEBHOOK_URL` to your repository variables

4. **Local Testing**: Create a `.env.local` file with these variables for local development (this file is gitignored)

Happy grid-hacking! 🚀
