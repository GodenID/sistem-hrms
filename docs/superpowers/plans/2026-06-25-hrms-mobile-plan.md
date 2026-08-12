# Implementation Plan: HRMS Mobile View

## Date
2026-06-25

## Overview
Implement a mobile-only frontend HRMS application using React 18 + Vite + Tailwind CSS + react-router-dom. The app has two pages: Login (dummy auth) and Dashboard (live clock + clock in/out).

## Architecture

```
Sistem HRMS/
├── docs/superpowers/plans/2026-06-25-hrms-mobile-plan.md  (this file)
├── docs/superpowers/specs/2026-06-25-hrms-mobile-design.md  (design spec)
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx              # React entry point
    ├── App.jsx               # Router & protected route
    ├── index.css             # Tailwind directives + mobile layout
    ├── context/
    │   ├── AuthContext.jsx   # Login state + username
    │   └── ClockContext.jsx  # Clock in/out state + localStorage
    ├── hooks/
    │   └── useLocalStorage.js
    └── pages/
        ├── LoginPage.jsx     # Login form (Indonesian UI)
        └── DashboardPage.jsx # Greeting, live clock, buttons
```

## Implementation Steps

### Phase 1: Project Scaffolding
1. Create `package.json` with React 18, Vite, Tailwind CSS, react-router-dom, PostCSS.
2. Create `vite.config.js` with standard React plugin.
3. Create `tailwind.config.js` with content paths and custom max-width.
4. Create `postcss.config.js` with Tailwind and Autoprefixer.
5. Create `index.html` with root div and script pointing to `src/main.jsx`.

### Phase 2: Core Application
6. Create `src/index.css` with Tailwind directives and mobile-centered container styles.
7. Create `src/main.jsx` rendering `<App />` into root with `StrictMode`.
8. Create `src/hooks/useLocalStorage.js` for localStorage read/write with JSON parse/stringify and fallback to in-memory.
9. Create `src/context/AuthContext.jsx` providing `{ user, login, logout, isAuthenticated }`.
10. Create `src/context/ClockContext.jsx` providing `{ clockIn, clockOut, date, doClockIn, doClockOut }` persisted via `useLocalStorage`.
11. Create `src/pages/LoginPage.jsx` with form validation (non-empty), dummy login, error message in Indonesian.
12. Create `src/pages/DashboardPage.jsx` with greeting, live time (1s interval), clock buttons with correct disabled states.
13. Create `src/App.jsx` with BrowserRouter, routes, and protected route wrapper.

### Phase 3: Verification
14. Run `pnpm install`.
15. Run `pnpm dev` and verify pages load via curl.
16. Run build/lint to ensure no errors.

## Design Decisions
- **Dummy login**: Any non-empty username/password accepted; username used for greeting.
- **localStorage key**: `hrms_clock_data` stores `{ clockIn, clockOut, date }`.
- **Time format**: Indonesian locale (`id-ID`) with "WIB" suffix, updated every second on dashboard.
- **Disabled states**: Clock In disabled after clocked in; Clock Out disabled until clocked in and disabled after clocked out.
- **Mobile layout**: `max-w-[430px] mx-auto` container.
- **Language**: All UI text in Indonesian.

## Out of Scope
- Backend integration or real authentication.
- Multi-day attendance history.
- Edit/delete clock records.
- Desktop-specific layout.
