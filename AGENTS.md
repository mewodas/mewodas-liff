<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Staging Workflow for Customer-Facing Changes

Customer-facing files (app/home/*, app/record/*, app/profile/*, app/goals/*,
app/announcements/*, app/onboard/*, app/exercise/*, app/weight/*,
app/history/*, components/FooterNav.tsx, components/OnboardingFlow.tsx)
must NEVER be pushed directly to main.

Workflow:
1. Branch: `git checkout -b staging/<feature-name>`
2. Implement changes
3. `git push origin staging/<feature-name>`
4. Vercel creates a preview deployment URL automatically
5. Share preview URL with the owner for QA
6. Only after explicit approval, merge to main

This applies because main = production = live customer environment.
Admin/store-side files (app/admin/*, app/store/*, lib/*, api/admin/*)
are exempt — only the gym owner accesses those.

Exception: Critical bug fixes that directly break customer navigation
(e.g., redirect freeze, onboarding hang) may be pushed directly to main
with explicit owner acknowledgment. Document the exception in the commit message.
