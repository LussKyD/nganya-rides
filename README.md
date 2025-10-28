# Nganya Rides — The Matatu Experience (GitHub Pages-ready)

This repository is a lightweight 3D web prototype inspired by Nairobi's matatu culture.
It uses Three.js (r170) and vanilla JS for an offline-like web demo that runs on GitHub Pages.

---

## Files in this repo
- `index.html` — main page (ES module import of `main.js`)
- `main.js` — game code (ES modules, imports Three.js from unpkg)
- `style.css` — UI styles
- `README.md`, `LICENSE`, `.gitignore`

---

## Goal
Deploy this repo to **GitHub Pages** so the demo runs at:
`https://<your-username>.github.io/<repo-name>/`

This README explains the exact steps (git commands and GitHub UI) to create the repo, commit, and enable Pages.

---

## Recommended License
- **MIT License** — permissive and simple. Included as `LICENSE`.

---

## Step-by-step: Create repository locally, commit, push, enable Pages

### 1) Create a local folder and initialize git
```bash
# in terminal (Mac/Linux/Windows with Git Bash)
mkdir nganya-rides
cd nganya-rides
# copy repository files into this folder (you have them from the zip)
git init
git branch -M main
```

### 2) Add files, make initial commit
```bash
git add .
git commit -m "chore: initial prototype - Nganya Rides v1"
```

### 3) Create remote repo on GitHub
- Go to https://github.com/new
- Repository name: `nganya-rides` (or your preferred name)
- Description: "Nganya Rides — The Matatu Experience (Three.js prototype)"
- Visibility: Public (recommended)
- *Do not* initialize with README/License (we already have them)
- Click **Create repository**

### 4) Link remote and push
Follow the commands GitHub shows; example:
```bash
git remote add origin https://github.com/<your-username>/nganya-rides.git
git push -u origin main
```

### 5) Enable GitHub Pages
- Open your repo on GitHub
- Click **Settings** → **Pages**
- Under “Build and deployment”, choose **Branch: main** and folder **/(root)**
- Save. After a minute the site will be available at `https://<your-username>.github.io/nganya-rides/`

### 6) Making edits & commits
```bash
# after editing files
git add .
git commit -m "feat: add traffic loops and polish UI"
git push
```
GitHub Pages will auto-deploy on push to `main`.

---

## Optional: .gitignore suggestions
```
node_modules/
.DS_Store
*.log
```

---

## Troubleshooting
- If your demo fails due to module imports blocked: ensure you're viewing via `https://` (GitHub Pages) — module imports from `unpkg` work over HTTPS.
- To make the repo fully offline (no external CDN), embed `three.module.js` and OrbitControls source into `main.js` and remove external imports.

---

## Contact / Next steps
If you want I can:
- Produce a fully embedded version (no CDN) — larger repo size.
- Add a small GLTF matatu model and include it in repo.
- Setup GitHub Actions to auto-deploy from a different branch.

