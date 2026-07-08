# @ci-shard-advisor/web

Static React + Vite web demo for CI Shard Advisor. It runs the whole analysis
in the browser (ADR-002) — a Playwright JSON report is never uploaded anywhere.

## Develop

```bash
pnpm dev         # dev server at http://localhost:5173
pnpm build       # production build
pnpm preview     # serve the production build
pnpm typecheck   # strict TypeScript
```

## Tests

Component tests (Vitest + Testing Library), run everywhere:

```bash
pnpm test
```

End-to-end tests (Playwright) cover the demo, the upload flow, a **privacy**
check (the report never leaves the page) and an **accessibility** scan (axe).
They need browser binaries and their system libraries:

```bash
npx playwright install --with-deps chromium   # one-time, needs OS packages
pnpm e2e
```

`--with-deps` installs the system libraries Chromium needs (`libnspr4`,
`libnss3`, …); on headless CI without root, use a Playwright base image instead.

The same journeys are also covered with **Cypress** (`cypress/e2e/`) — demo,
upload, the privacy assertion and an accessibility scan via `cypress-axe`. The
Cypress binary is installed on demand:

```bash
npx cypress install     # one-time, downloads the Cypress binary
pnpm e2e:cypress        # builds, serves the preview and runs cypress run
# or: pnpm cypress:open
```
