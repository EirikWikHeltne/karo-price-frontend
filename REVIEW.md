# Codebase Review: Karo Price Frontend

_Last reviewed: 2026-05-29_

The earlier round of issues (leaking debug endpoint, PostgREST filter injection,
per-request Supabase clients, duplicated `RETAILERS` / `fmt` / `fetchAllRows` /
header / footer / `CAT_CLASS`, sequential home-page fetches, the `min === 0`
spread bug, the `window.innerWidth` SSR crash, missing error states and error
boundary) has been resolved. Shared logic now lives in `lib/` and `components/`,
the debug route is gated to `NODE_ENV === 'development'`, search input is
sanitised, and the home page fetches in parallel.

## Outstanding

### Performance / Architecture
- **All pages are client components.** Every page uses `'use client'` with
  `useEffect` data fetching — no SSR, so no SEO and a slower first paint. Moving
  data fetching into server components (keeping interactive parts as client
  components) would be the largest improvement, if SEO/first-paint matter.
- **No `loading.js` files.** Pages handle loading manually instead of using
  Next.js Suspense loading UI.

### Assets
- **Open Graph image is SVG** (`app/layout.js` → `/og-image.svg`). Facebook,
  LinkedIn, Slack, iMessage and X do not render SVG for OG previews. Provide a
  PNG (1200×630) so link previews actually show an image.

### Developer Experience
- **No ESLint config**, so `next lint` has nothing to run.
- **No tests.**
- **No TypeScript** — plain JS with no type checking.

### Minor
- Inline styles are scattered through the page components (especially
  `historikk/page.js`), mixed with the single global stylesheet.
</content>
</invoke>
