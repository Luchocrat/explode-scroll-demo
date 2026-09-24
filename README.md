# Explode on Scroll

Next.js (App Router) demo that loads a 7-part GLB and drives an explode-apart
animation from **scroll progress** (0 → 1). Parts move along vectors from the
model center to each part origin. Orbit with drag.

Built with React Three Fiber (`three`, `@react-three/fiber`, `@react-three/drei`).

## Quick start

```bash
cd /workspace/explode-scroll-demo   # or your clone path
npm install
npm run dev
# open http://localhost:3000
```

Production:

```bash
npm run build
npm run start
# equivalent: npx next start
# open http://localhost:3000
```

## Layout

| Path | Role |
|---|---|
| `public/model.glb` | 7 CAD solids as separate meshes |
| `src/components/ExplodeOnScroll.tsx` | Client R3F explode component |
| `src/components/ExplodeStage.tsx` | 300vh scroll + sticky 100vh stage |
| `src/app/page.tsx` | Home page |

## Deploy (Vercel)

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import the project in [Vercel](https://vercel.com/new).
3. Framework preset: **Next.js**. Build command `npm run build`, output default.
4. No env vars required. Static asset `public/model.glb` is served as `/model.glb`.

Or from the CLI:

```bash
npx vercel
```

## Notes

- Hint: “Scroll to explode · drag to orbit”
- Background: `#0e1014`
- Scroll section height ≈ `300vh`; stage is sticky `100vh`
- Tunable via `explodeDistance` on `<ExplodeOnScroll />`
