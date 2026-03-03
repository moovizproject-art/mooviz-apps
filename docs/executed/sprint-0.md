# Sprint 0 — Setup & Scaffold — Execution Log

## Sprint Info
- **Sprint ID**: 18 (KAL CRM)
- **Dates**: 2026-03-03 to 2026-03-06
- **Goal**: Repo, Firebase, RN, components, Maps
- **Branch**: `feature/sprint-0-setup`

---

## Task 103: [M0.1] Set up environment separation
**CRM ID**: 103 | **Status**: Complete | **Est**: 2h

### What was done
1. **Firebase login** switched to `tamir@k-a-l.solutions`
2. **Firebase prod project** created: `mooviz-prod` (Project #987192365576)
3. **Firebase apps registered** on both projects:
   - Dev (mooviz-app-9b766): iOS, Android, Web — all with bundle `com.mooviz.app`
   - Prod (mooviz-prod): iOS, Android, Web — same bundle ID
4. **GCP APIs enabled** on both: Firestore, Auth, Cloud Functions, Storage, FCM
5. **Firestore databases** created in `europe-west1` (closest to Israel) on both projects
6. **Firestore rules + indexes** deployed to dev project
7. **`.firebaserc`** created with aliases: default/dev/staging → mooviz-app-9b766, production → mooviz-prod
8. **Environment files** created: `.env.example` (tracked), `.env.dev`, `.env.staging`, `.env.prod` (gitignored)
9. **`docs/credentials.md`** created with all project IDs, app IDs, accounts
10. **`.gitignore`** updated to properly handle env files and docs/

### Acceptance Criteria
- [x] Firebase CLI logged in as tamir@k-a-l.solutions
- [x] Dev project (mooviz-app-9b766) has iOS, Android, Web apps
- [x] Prod project (mooviz-prod) has iOS, Android, Web apps
- [x] Firestore, Auth, Functions, Storage, FCM enabled on both
- [x] Firestore databases created (europe-west1) on both
- [x] Firestore rules and indexes deployed to dev
- [x] `.firebaserc` has correct aliases
- [x] `.env.example` exists with template
- [x] `.env.dev`, `.env.staging`, `.env.prod` have real Firebase configs
- [x] `docs/credentials.md` has all project info
- [ ] Firebase Storage needs manual setup via console (Get Started button)

### Manual Action Required
- **Firebase Storage**: Visit https://console.firebase.google.com/project/mooviz-app-9b766/storage and click "Get Started" to initialize. Same for mooviz-prod.

---
