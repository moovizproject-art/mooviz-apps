# MOOVIZ — Session Continuation Guide
> Last updated: 2026-03-11 | Sprint 3 (M3) IN PROGRESS

## Current State

### Branch: `main` (merged from `feature/optimization-qa-round1`)
### Last commit: `f3dec81` — QA Round 1 complete

---

## What Was Done (March 10-11) — QA Round 1

### Mobile App Fixes
1. **ForgotPasswordScreen** — Logo added, security message
2. **Accent color** — Changed to #FF9800 across app
3. **LoginScreen** — Remember Me checkbox (30-day session), field spacing, car centering
4. **RegisterScreen** — ToS checkbox, gender field, age range chips, saved to Firestore
5. **CreateDeliveryScreen** — Size guide modal (accent color + "מדריך מידות"), field reorder (notes after media), centered add-media icons, time range picker chips
6. **DriverOnboarding** — 6th step (💳 direct payment info)
7. **SettingsDrawer** — YouTube, LinkedIn, Website social links
8. **ChatScreen** — Car icon on system messages, 12h auto-close banner

### Chat Auto-Close System (12 hours)
- `functions/src/scheduled/chatAutoClose.ts` — Hourly cron, closes chats 12h after delivery
- `functions/src/triggers/deliveryTrigger.ts` — Sets `chatCloseAt` on completion, immediate close on cancel
- `functions/src/triggers/chatTrigger.ts` — Blocks messages on closed chats (server-side deletion)
- `apps/mobile/src/hooks/useChat.ts` — Real-time `isClosed` listener
- `apps/mobile/src/screens/shared/ChatScreen.tsx` — Closed banner replaces input bar
- `functions/src/callable/deliveryCallable.ts` — New chats get `closed: false`

### Admin Dashboard Enhancements
- **PeriodFilter** — 7d/30d/90d/quarter/year/all on ALL stats, charts, tables
- **User breakdown** — 4 cards: senders/drivers × registered/active (active = last 30 days)
- **Regional distribution** — Horizontal bar chart (גוש דן, חיפה, ירושלים, נגב, גליל, השרון)
- **Delivery timings** — Table: post→approval, approval→pickup, pickup→delivery, total by region
- **Monthly deliveries** — Bar chart, last 12 months
- **Monthly cashflow** — Area chart, revenue per month (completed deliveries)
- **Drill-down** — Click user cards→users page, pie slices→deliveries, regional bars→filtered view
- **CSV export on EVERYTHING** — Dashboard charts, users, deliveries, all chats, per-chat messages
- **ChatsPage** — Image rendering, system messages, per-chat + all-chats CSV export

### Deployments
- 25 Cloud Functions deployed (incl. new `chatAutoClose`)
- Admin: https://mooviz-app-9b766.web.app
- Release APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (76MB)
- QA summary PDF: `docs/qa-round1-summary.pdf`

---

## Next Session Tasks

### Priority 1: Remaining M3 Items
- [ ] Glide migration image fetcher (`scripts/fix-glide-migration.ts` ready but not executed)
  - Downloads profile photos, KYC docs, item photos from Glide URLs → Firebase Storage
  - Resets all migrated users to sender role + pending KYC
  - Fixes chat participant names
- [ ] KAL Solutions "Developed by" attribution (footer/splash)
- [ ] Ratings & reviews system
- [ ] E2E testing on physical devices

### Priority 2: CRM Sprint Tasks
- 141: Navigation deep links
- 159: Interstitial ad infrastructure
- 160: Analytics events

### Priority 3: Admin Polish
- [ ] Custom domain setup for admin (DNS → Firebase Hosting)
- [ ] Admin DrillDown drawer (Task 9 from dashboard plan — deferred)
- [ ] Deliveries page: read `?status=` and `?region=` query params from drill-down navigation

---

## Key Files Changed in QA Round 1
| File | What |
|------|------|
| `apps/admin/src/hooks/useAnalytics.ts` | User breakdown, regional, timings, monthly charts hooks |
| `apps/admin/src/hooks/useStats.ts` | Period-filtered stats + status distribution |
| `apps/admin/src/pages/DashboardPage.tsx` | Full dashboard with all charts + drill-down |
| `apps/admin/src/components/CsvExport.tsx` | Reusable CSV export with BOM |
| `apps/admin/src/components/PeriodFilter.tsx` | Period selector component |
| `apps/admin/src/constants/regions.ts` | Israel city→region mapping |
| `functions/src/scheduled/chatAutoClose.ts` | Hourly cron for chat closure |
| `docs/qa-round1-summary.html` | Client-facing summary (Hebrew) |
| `docs/qa-round1-summary.pdf` | PDF version |

## Environment Quick Start
```bash
# Start Metro (from apps/mobile/)
cd apps/mobile && node ../../node_modules/react-native/cli.js start --reset-cache

# Android build + install
cd apps/mobile/android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk

# Admin dev
cd apps/admin && npm run dev -- --port 5002

# Deploy functions
cd functions && npm run build && firebase deploy --only functions

# Deploy admin
cd apps/admin && node ../../node_modules/.pnpm/vite@5.4.21_@types+node@25.3.3_terser@5.46.0/node_modules/vite/bin/vite.js build
firebase deploy --only hosting
```

## User Preferences
- **NO** `Co-Authored-By: Claude` in git commits
- Client should not see AI attribution
- Hebrew RTL is primary language
- Use Gamma for PDF generation
- Sounds OFF by default
