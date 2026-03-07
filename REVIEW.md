# Codebase Review: Karo Price Frontend

## 1. Security Issues

### 1a. Debug endpoint exposes sensitive data in production
`app/api/debug/route.js:9` leaks the first 8 characters of `SUPABASE_SERVICE_ROLE_KEY`. This endpoint has no authentication and is publicly accessible.

**Fix:** Remove the debug endpoint entirely, or gate it behind `NODE_ENV === 'development'`.

### 1b. Search input vulnerable to PostgREST filter injection
`app/api/priser/route.js:50-53` and `app/api/historikk/route.js:44` strip some special characters but miss `%` and `_` (SQL wildcards).

**Fix:** Also strip `%` and `_` from user input.

### 1c. Supabase client created per-request in every API route
Every API route creates a new `createClient()` instance instead of using the shared `lib/supabaseServer.js` singleton.

**Fix:** Use the existing `supabaseServer` export from `lib/supabaseServer.js`.

### 1d. Client-side Supabase module is unused
`lib/supabase.js` is never imported anywhere — dead code.

**Fix:** Delete `lib/supabase.js`.

---

## 2. Code Duplication

### 2a. RETAILERS constant duplicated across 5 files
Same array defined in `page.js`, `grafer/page.js`, `historikk/page.js`, `sammenlign/page.js`.

### 2b. `fmt()` function duplicated across 4 files
Identical formatting function in every page component.

### 2c. `fetchAllRows()` duplicated in 3 API routes
Same pagination helper in `priser`, `historikk`, and `produkter`.

### 2d. Header/navigation duplicated across all 5 pages
Every page re-implements the same header. Navigation changes require editing 5 files.

### 2e. Footer duplicated across all 5 pages
Same footer with minor text variations.

### 2f. `CAT_CLASS` mapping duplicated
Defined in both `page.js` and `produkter/page.js`.

**Fix for all:** Extract shared constants, components, and utilities into `lib/` and `components/` directories.

---

## 3. Performance Issues

### 3a. Home page makes sequential API calls
`app/page.js:60-86` — Price fetch and "siste-oppdatering" fetch happen sequentially.

**Fix:** Use `Promise.all()` to parallelize.

### 3b. Historikk page loads ALL price data for the sidebar
Fetches `/api/priser` (with all retailer prices) when only product names/IDs are needed.

**Fix:** Use `/api/produkter` instead.

### 3c. Charts tooltip components re-created every render
`CustomTooltip`, `PieTooltip`, and `renderPieLabel` defined inside render body cause unnecessary re-renders.

**Fix:** Move outside the component.

---

## 4. Bugs & Correctness

### 4a. `window.innerWidth` without SSR guard
`app/historikk/page.js:137` accesses `window.innerWidth` directly — crashes during SSR.

**Fix:** Add `typeof window !== 'undefined'` check.

### 4b. Spread calculation bug when min price is 0
`app/page.js:552` — `min && max` is falsy when `min === 0`.

**Fix:** Change to `min != null && max != null`.

### 4c. `SortIcon` defined as nested component
Creates new component definition every render, breaking React reconciliation.

**Fix:** Move outside the parent component.

### 4d. Errors swallowed silently in sammenlign page
Empty catch block hides fetch failures from the user.

**Fix:** Add error state and display message.

### 4e. Inconsistent `fmt()` return values
Returns `null` in some files, `''` in others.

### 4f. Unused `allHavePrices` variable
`app/sammenlign/page.js:75` — assigned but never read.

---

## 5. Architecture

### 5a. All pages are client components
Every page uses `'use client'` with `useEffect` data fetching — no SSR, no SEO.

**Fix:** Use server components for data fetching, keep interactive parts as client components.

### 5b. No error boundary
No `error.js` files — any render error crashes the entire app.

### 5c. No loading states via Suspense
No `loading.js` files leveraging Next.js Suspense.

---

## 6. Developer Experience

### 6a. No TypeScript
Plain JavaScript with no type checking.

### 6b. No linting or formatting
No ESLint, Prettier, or pre-commit hooks.

### 6c. No tests
Zero test files.

---

## 7. Minor Issues

- OG image uses SVG — many social platforms don't render SVG for Open Graph
- Inline styles scattered throughout (especially `historikk/page.js`)
- Single 673-line CSS file

---

## Priority

| Priority | Issue | Impact |
|----------|-------|--------|
| **Critical** | Debug endpoint leaking key (1a) | Security |
| **High** | Search filter injection (1b) | Security |
| **High** | Spread bug with min=0 (4b) | Correctness |
| **High** | window.innerWidth SSR crash (4a) | Stability |
| **Medium** | Code duplication (2a-2f) | Maintainability |
| **Medium** | Sequential API calls (3a) | Performance |
| **Medium** | No error boundaries (5b) | UX |
| **Medium** | All client-side rendering (5a) | SEO/Performance |
| **Low** | No TypeScript (6a) | DX |
| **Low** | No tests (6c) | Reliability |
