# GridLabs

**Zero-config, component-first UI preview for Vite + React projects**

GridLabs automatically discovers every `.tsx/.jsx` file under `src/`, builds them with your real app configuration, and lays them out in a share-able grid.  
It's like Storybook, but without stories, routes, or manual wiring—drop a component in **`src/`**, push to Git, and it appears live in seconds.

---

## ✨ Why GridLabs?

| Pain in current workflow | How GridLabs fixes it |
| ------------------------ | --------------------- |
| Manually creating stories / routes for every new component | **Auto-discover plug-in** finds files on `vite dev` and in CI builds |
| Colleagues can't see WIP UI without pulling code | **Live grid** deployed to Vercel for every commit |
| Hard to share exact build during design reviews | **Copy-link** button copies `?sha=<commit>` URL so reviewers see the same version |
| Visual regressions spotted only after QA | (Phase D) **Automated screenshots** + diff & GPT-summary per commit |

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

You can try the live instance here 👉 **https://gridlabs.vercel.app/__grid**

---

## 🗺 Roadmap

### ✅ Phase C  — Visual snapshots (COMPLETED)

1. ✅ **Snapshot engine** – Playwright screenshots each tile after `vite build`
2. ✅ **Cloud storage** – PNGs uploaded to Firebase Storage under `gridshots/<commit>/`
3. ✅ **Thumbnail display** – Grid shows snapshot as card background

> ⭐ Value: Anyone can scroll the grid and see exactly how each component looked for that commit.

### 🔄 Phase D  — Smart diff & AI summary (NEXT UP)

* Compare current PNG vs. previous base with Sharp  
* If >0.1 % pixels changed, store diff image  
* Call GPT-4o to generate a one-line summary ("Button corner-radius changed from 4 px to 8 px")

### Phase E  — Workflow integrations

* Bitbucket Pipeline comments a link to the new grid on every PR  
* Optional Slack / Teams webhook with changed components  
* Search / filter bar inside grid

### Phase F  — VS Code extension (optional)

* "Open Grid Lab" command starts `vite dev` if needed and opens `/__grid`  
* Publish to VS Code Marketplace

### Phase G  — UX polish & docs

* Responsive layout & dark-mode tweaks  
* Logo / branding in navbar  
* One-page README with GIF demo & installation snippet

### Phase H  — Public beta launch

* Invite 5–10 design-partner teams  
* Post on r/reactjs & Dev.to  
* Add Intercom or Slack link for feedback

---

## Contributing / Getting Started Locally

```bash
git clone https://bitbucket.org/sharedpath/gridlabs.git
cd gridlabs
npm install
npm run dev         # open http://localhost:5173/__grid
```