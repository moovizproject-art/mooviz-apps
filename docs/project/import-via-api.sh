#!/bin/bash
# ============================================================
# MOOVIZ CRM Import via REST API
# Usage: ./import-via-api.sh [project_id]
# Default project_id = 1 (Mooviz Application)
# ============================================================

set -e

PROJECT_ID=${1:-1}
CRM="http://localhost:8080/projects_extended/projects_api"
KEY="20ecc8d1c487e0b7666da0fd7ea975a210875572160b980b9e99b10ea0ce2332"
SECRET="0c029cf7b2c61c68b0fd48f6ed030d0ed465697a57b404067afca5c680cae5ab"

api() {
  local method=$1 endpoint=$2 data=$3
  local url="$CRM/$endpoint"
  if [ "$method" = "GET" ]; then
    curl -sf "$url" -H "X-API-Key: $KEY" -H "X-API-Secret: $SECRET"
  else
    curl -sf -X POST "$url" -H "X-API-Key: $KEY" -H "X-API-Secret: $SECRET" -H "Content-Type: application/json" -d "$data"
  fi
}

extract_id() {
  echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('milestone_id') or json.load(sys.stdin).get('sprint_id') or json.load(sys.stdin).get('task_id', 0))" 2>/dev/null
}

echo "=== MOOVIZ CRM Import — Project $PROJECT_ID ==="
echo ""

# ---- MILESTONES ----
echo "Creating milestones..."

r=$(api POST milestones "{\"project_id\":$PROJECT_ID,\"name\":\"M0 — Project Setup & Kickoff\",\"description\":\"Pre-development: repo, Firebase/GCP, design system scaffold\",\"due_date\":\"2026-03-06\",\"color\":\"#607d8b\"}")
M0=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['milestone_id'])")
echo "  M0: id=$M0"

r=$(api POST milestones "{\"project_id\":$PROJECT_ID,\"name\":\"M1 — Backend + Auth + Base Mobile\",\"description\":\"15% payment = 13,500 NIS + VAT\",\"due_date\":\"2026-03-20\",\"color\":\"#2196f3\"}")
M1=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['milestone_id'])")
echo "  M1: id=$M1"

r=$(api POST milestones "{\"project_id\":$PROJECT_ID,\"name\":\"M2 — Delivery Lifecycle + GPS + Chat + Admin\",\"description\":\"10% payment = 9,000 NIS + VAT\",\"due_date\":\"2026-04-06\",\"color\":\"#ff9800\"}")
M2=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['milestone_id'])")
echo "  M2: id=$M2"

r=$(api POST milestones "{\"project_id\":$PROJECT_ID,\"name\":\"M3 — Feature Completion + Stabilization\",\"description\":\"5% payment = 4,500 NIS + VAT\",\"due_date\":\"2026-04-11\",\"color\":\"#9c27b0\"}")
M3=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['milestone_id'])")
echo "  M3: id=$M3"

r=$(api POST milestones "{\"project_id\":$PROJECT_ID,\"name\":\"M4 — Final Delivery + Store Submission\",\"description\":\"20% payment = 18,000 NIS + VAT\",\"due_date\":\"2026-04-14\",\"color\":\"#4caf50\"}")
M4=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['milestone_id'])")
echo "  M4: id=$M4"

echo "  5 milestones created"
echo ""

# ---- SPRINTS ----
echo "Creating sprints..."

r=$(api POST sprints "{\"project_id\":$PROJECT_ID,\"name\":\"Sprint 0 — Setup & Scaffold\",\"goal\":\"Repo, Firebase, RN, components, Maps\",\"start_date\":\"2026-03-04\",\"end_date\":\"2026-03-06\"}")
S0=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['sprint_id'])")
echo "  S0: id=$S0"

r=$(api POST sprints "{\"project_id\":$PROJECT_ID,\"name\":\"Sprint 1 — Auth + Users + Models\",\"goal\":\"OTP auth, registration, Firestore models, security rules\",\"start_date\":\"2026-03-07\",\"end_date\":\"2026-03-13\"}")
S1=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['sprint_id'])")
echo "  S1: id=$S1"

r=$(api POST sprints "{\"project_id\":$PROJECT_ID,\"name\":\"Sprint 2 — Mobile Scaffold + Home\",\"goal\":\"Auth screens, state mgmt, Firebase service layer, home, listing form\",\"start_date\":\"2026-03-14\",\"end_date\":\"2026-03-20\"}")
S2=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['sprint_id'])")
echo "  S2: id=$S2"

r=$(api POST sprints "{\"project_id\":$PROJECT_ID,\"name\":\"Sprint 3 — Delivery CRUD + Feed + FSM\",\"goal\":\"Listing backend, driver feed, geohash, status state machine\",\"start_date\":\"2026-03-21\",\"end_date\":\"2026-03-27\"}")
S3=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['sprint_id'])")
echo "  S3: id=$S3"

r=$(api POST sprints "{\"project_id\":$PROJECT_ID,\"name\":\"Sprint 4 — GPS + Chat + Push + Pay\",\"goal\":\"Location, live map, chat, proofs, push, payment confirmation\",\"start_date\":\"2026-03-28\",\"end_date\":\"2026-04-03\"}")
S4=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['sprint_id'])")
echo "  S4: id=$S4"

r=$(api POST sprints "{\"project_id\":$PROJECT_ID,\"name\":\"Sprint 5 — Admin Panel + Ratings\",\"goal\":\"Admin auth/dashboard/users/deliveries/reports, rating system\",\"start_date\":\"2026-04-04\",\"end_date\":\"2026-04-09\"}")
S5=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['sprint_id'])")
echo "  S5: id=$S5"

r=$(api POST sprints "{\"project_id\":$PROJECT_ID,\"name\":\"Sprint 6 — Polish + Edge Cases\",\"goal\":\"Cancellation, ads, analytics, loading/empty/error states, bugs, migration\",\"start_date\":\"2026-04-10\",\"end_date\":\"2026-04-14\"}")
S6=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['sprint_id'])")
echo "  S6: id=$S6"

r=$(api POST sprints "{\"project_id\":$PROJECT_ID,\"name\":\"Sprint 7 — Store Submission\",\"goal\":\"Production config, App Store, Play Store, compliance, handover\",\"start_date\":\"2026-04-15\",\"end_date\":\"2026-04-17\"}")
S7=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['sprint_id'])")
echo "  S7: id=$S7"

echo "  8 sprints created"
echo ""

# ---- TASKS ----
echo "Creating tasks..."
TASK_COUNT=0

task() {
  local name=$1 desc=$2 prio=$3 hours=$4 milestone=$5 sprint=$6 type=$7 start=$8
  local data="{\"project_id\":$PROJECT_ID,\"name\":\"$name\",\"description\":\"$desc\",\"priority\":$prio,\"estimated_hours\":$hours,\"milestone\":$milestone,\"sprint_id\":$sprint,\"task_type\":\"$type\",\"startdate\":\"$start\"}"
  local r
  r=$(api POST tasks "$data")
  TASK_COUNT=$((TASK_COUNT + 1))
  local tid
  tid=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['task_id'])" 2>/dev/null)
  echo "  #$TASK_COUNT (id=$tid): $name"
}

# Sprint 0 — M0
task "[M0.1] Create GitHub monorepo" "Set up GitHub repo under KAL Solutions org. Monorepo: /apps/mobile, /apps/admin, /functions, /shared. Branch protection. .gitignore. Client remote for post-milestone push." 3 2 $M0 $S0 task "2026-03-04"
task "[M0.1] Configure CI/CD pipelines" "GitHub Actions for Cloud Functions lint+deploy. EAS Build for iOS+Android. PR checks: lint+typecheck." 3 3 $M0 $S0 task "2026-03-04"
task "[M0.1] Set up environment separation" "Dev/staging/production env configs. .env templates, Firebase aliases, EAS build profiles." 3 2 $M0 $S0 task "2026-03-04"
task "[M0.1] Import tasks into KAL CRM" "Import MOOVIZ tasks into KAL CRM project. Verify milestones and dependencies." 4 1 $M0 $S0 task "2026-03-04"
task "[M0.2] Create Firebase projects (dev+prod)" "Two Firebase projects: mooviz-dev, mooviz-prod. Enable Auth, Firestore, Functions, Storage, FCM. Billing alerts." 4 3 $M0 $S0 task "2026-03-04"
task "[M0.2] Configure Firebase Authentication" "Enable phone SMS + email OTP. SMS templates (Hebrew+English). Authorized domains. Auth emulator." 4 2 $M0 $S0 task "2026-03-04"
task "[M0.2] Set up Firestore + Security Rules baseline" "Init Firestore. Default deny-all rules. Emulator config. Index placeholders." 4 2 $M0 $S0 task "2026-03-05"
task "[M0.2] Set up Cloud Storage and FCM" "Storage buckets for images. Security rules (auth only). FCM enabled, APNs key for iOS." 3 2 $M0 $S0 task "2026-03-05"
task "[M0.3] Initialize React Native project" "Expo managed RN project. TypeScript strict, ESLint, Prettier. Path aliases. Folder structure." 3 3 $M0 $S0 task "2026-03-05"
task "[M0.3] Set up navigation structure" "React Navigation with role-based bottom tabs and stack navigators. RTL support. Deep linking scaffold." 3 3 $M0 $S0 task "2026-03-05"
task "[M0.3] Build base component library" "Button, TextInput, Card, Modal, Avatar, Badge, RatingStars, StatusBadge, Loading/Empty/Error states. Theme system. RTL-aware." 3 4 $M0 $S0 task "2026-03-06"
task "[M0.3] Integrate Google Maps SDK" "Google Maps in RN. API keys iOS+Android. Base MapView, Marker, region components." 3 3 $M0 $S0 task "2026-03-06"

# Sprint 1 — M1
task "[M1.1] Implement OTP login flow (SMS)" "Phone input + country code → SMS OTP → 6-digit verify → authenticated. Loading, errors (invalid/wrong/expired/rate-limit)." 4 6 $M1 $S1 feature "2026-03-07"
task "[M1.1] Implement OTP login flow (Email)" "Email input → magic link or OTP → verified. Fallback when SMS unavailable." 3 4 $M1 $S1 feature "2026-03-07"
task "[M1.1] Implement auth state persistence" "Persist auth across restarts. Token auto-refresh. Logout clears session. Deep link on expiry." 4 3 $M1 $S1 feature "2026-03-08"
task "[M1.2] Build registration form screen" "Multi-step: name, phone, email, city, role, profile photo, ID/license. Validation per spec. Terms consent." 4 8 $M1 $S1 feature "2026-03-08"
task "[M1.2] Implement profile photo upload" "Camera + gallery. Resize/compress. Upload to Cloud Storage. Default avatar fallback." 3 4 $M1 $S1 feature "2026-03-09"
task "[M1.2] Implement KYC-Light (ID/license upload)" "Upload ID/license for admin verification. Camera/gallery. Cloud Storage. KYC status: pending/approved/rejected." 3 4 $M1 $S1 feature "2026-03-09"
task "[M1.2] Build profile view and edit screens" "Profile: all data, rating stars, completed count, join date. Edit: name, city, photo." 3 4 $M1 $S1 feature "2026-03-10"
task "[M1.3] Implement Firestore data models" "All collections: users, deliveries, chats+messages subcollection, ratings, reports, adminActions. TypeScript interfaces. Indexes." 4 8 $M1 $S1 feature "2026-03-10"
task "[M1.3] Set up Firestore composite indexes" "Composite indexes: deliveries by status+geohash, user deliveries, chat messages by timestamp." 3 2 $M1 $S1 task "2026-03-11"
task "[M1.4] Implement Firestore security rules" "Rules for all collections. RBAC: users read own, drivers see available deliveries, admins elevated." 4 6 $M1 $S1 feature "2026-03-11"
task "[M1.4] Build Cloud Functions scaffold" "Functions TypeScript project. Groups: auth/, delivery/, chat/, notification/, admin/. Shared utils. Emulator. Deploy." 3 4 $M1 $S1 task "2026-03-12"
task "[M1.4] Implement RBAC utility functions" "getRoleFromToken(), requireRole() middleware, isAdmin(). Role validation in triggers." 4 3 $M1 $S1 feature "2026-03-12"

# Sprint 2 — M1.5/M1.6 + M2.1 start
task "[M1.5] Build auth flow screens (complete)" "Splash, welcome slides, phone/email selection, OTP auto-fill, route to registration or home." 3 6 $M1 $S2 feature "2026-03-14"
task "[M1.5] Implement global state management" "Auth context, user profile, active deliveries, notification badge. Persistent offline cache." 3 4 $M1 $S2 feature "2026-03-14"
task "[M1.5] Build Firebase service layer" "AuthService, FirestoreService (typed CRUD), StorageService, FCMService abstractions." 3 6 $M1 $S2 feature "2026-03-15"
task "[M1.5] Implement error boundary + crash handling" "Global error boundary. Fallback screen with retry. Unhandled rejection handling. Crash reporting." 3 3 $M1 $S2 task "2026-03-16"
task "[M1.6] Build home screen (role-based)" "Sender: Create delivery CTA. Driver: Find deliveries CTA. Greeting, tagline, social links." 3 4 $M1 $S2 feature "2026-03-17"
task "[M1.6] Build onboarding flow (first-time)" "2-3 slides explaining app. Skip button, dot nav. Shown once (persisted flag)." 2 3 $M1 $S2 feature "2026-03-18"
task "[M2.1] Build create listing form" "Google Places autocomplete, item photo, date picker (ASAP/future), type, size, price (NIS), notes. Validation." 4 10 $M2 $S2 feature "2026-03-18"

# Sprint 3 — M2.1-M2.3
task "[M2.1] Implement listing backend (CRUD)" "Cloud Functions: create (validation), edit (status=New only), delete (status=New). Geohash from coords." 4 6 $M2 $S3 feature "2026-03-21"
task "[M2.1] Build My Deliveries screen (Sender)" "List: item photo, addresses, status badge. Detail: cancel, chat, phone, navigate, report." 3 6 $M2 $S3 feature "2026-03-22"
task "[M2.2] Build driver feed screen" "Scrollable available listings. Card: photo, pickup, destination, price. Filters: size, city, radius. Pull-refresh." 4 8 $M2 $S3 feature "2026-03-22"
task "[M2.2] Implement geohash-based radius search" "Geohash library. getDeliveriesInRadius(lat,lng,km). Haversine filter. Configurable 1/3/5km." 4 6 $M2 $S3 feature "2026-03-23"
task "[M2.2] Implement I am Interested action" "Driver interested → status=pending, removed from feed, push to sender. One driver per delivery." 4 4 $M2 $S3 feature "2026-03-24"
task "[M2.3] Implement delivery status state machine" "CRITICAL: Cloud Function validating all transitions. 7 statuses, actor validation, no cancel after pickup, 72h timeout. Audit log." 4 12 $M2 $S3 feature "2026-03-24"
task "[M2.3] Build delivery detail screen with actions" "Full info, status badge, role-based action buttons. Sender: approve/cancel/map/chat. Driver: pickup/deliver/cancel/nav/chat. Timeline." 4 8 $M2 $S3 feature "2026-03-26"

# Sprint 4 — M2.4-M2.7
task "[M2.4] Implement driver location broadcasting" "Location updates 10-30s during active delivery. lat/lng/geohash/heading/speed. Battery optimized. Stops on complete." 4 6 $M2 $S4 feature "2026-03-28"
task "[M2.4] Build live map tracking view" "Google Maps with both markers. Real-time driver updates. Route line. Status markers. Location unavailable fallback." 4 8 $M2 $S4 feature "2026-03-28"
task "[M2.4] Implement navigation deep links" "Launch Google Maps/Waze/Apple Maps. App chooser. Status-dependent destination." 2 3 $M2 $S4 task "2026-03-29"
task "[M2.5] Build real-time chat screen" "1:1 per delivery. Firestore onSnapshot sync. Delivery header. Phone shortcut. Keyboard handling. Timestamps." 4 10 $M2 $S4 feature "2026-03-29"
task "[M2.5] Implement system messages in chat" "Auto messages for each status change. Format: description + timestamp + actor. Visual distinction. Hebrew templates." 4 4 $M2 $S4 feature "2026-03-30"
task "[M2.5] Implement chat image upload" "Camera + gallery in chat. Compress. Cloud Storage. Image preview bubble. Upload progress." 3 4 $M2 $S4 feature "2026-03-31"
task "[M2.5] Implement proof system" "Mandatory photo for picked_up and delivered. Cannot complete without. Payment proof optional. Metadata. Non-deletable." 4 6 $M2 $S4 feature "2026-03-31"
task "[M2.6] Implement Cloud Functions push triggers" "All 8 notification events. Firestore triggers on status change + chat. FCM construction. Geo-targeted for new listings." 4 10 $M2 $S4 feature "2026-04-01"
task "[M2.6] Implement FCM client integration" "Permission request, token in user doc. Foreground + background handling. Tap → deep link. Badge count." 4 6 $M2 $S4 feature "2026-04-01"
task "[M2.6] Implement in-app notification fallback" "In-app badge when push blocked by OS. Notification state from Firestore. Updates on foreground." 3 4 $M2 $S4 feature "2026-04-02"
task "[M2.7] Build payment confirmation UI" "Payment section in delivery details. Deep links: Bit/PayBox/bank. Sender: Sent. Driver: Received. Status flow." 4 6 $M2 $S4 feature "2026-04-02"
task "[M2.7] Implement payment confirmation backend" "confirmPayment CF. Validates actor. Stores confirmation. Both confirm → completed_paid. Chat msg + push." 4 4 $M2 $S4 feature "2026-04-03"

# Sprint 5 — M2.8 + M3.1
task "[M2.8] Build admin panel authentication" "React/Vite web app. Firebase Auth. Admin role check. Redirect non-admin. Session management." 4 4 $M2 $S5 feature "2026-04-04"
task "[M2.8] Build admin dashboard" "Metrics: total users, active deliveries, weekly trend, acceptance rate, active reports. Real-time. Charts." 3 4 $M2 $S5 feature "2026-04-04"
task "[M2.8] Build admin user management" "User table: pagination, search, filter (role/KYC/status). Detail: profile, rating, deliveries, KYC doc. Actions: suspend/block/verify. Audit." 4 8 $M2 $S5 feature "2026-04-05"
task "[M2.8] Build admin delivery management" "Delivery table: filters. Detail: timeline, status/payment logs, proof viewer. Override: status, force cancel. Audit." 4 8 $M2 $S5 feature "2026-04-06"
task "[M2.8] Build admin report and moderation" "Report list: filters, 5+ types. Admin notes. Remove abusive content. Moderation history. Audit trail." 3 6 $M2 $S5 feature "2026-04-07"
task "[M3.1] Build rating prompt and submission UI" "After Delivered: 1-5 stars + comment (300 chars). Push trigger. Rate later option. One-time submission." 3 6 $M3 $S5 feature "2026-04-08"
task "[M3.1] Implement rating backend and display" "createRating CF. One per user per delivery. Aggregate: average + count updated. Display on profiles." 3 4 $M3 $S5 feature "2026-04-09"

# Sprint 6 — M3.2-M3.7
task "[M3.2] Implement cancellation logic (complete)" "Cancel: both parties, pre-pickup only. Revert to new. Return to feed. Push + chat message. Blocked after picked_up." 4 6 $M3 $S6 feature "2026-04-10"
task "[M3.3] Build interstitial ad infrastructure" "Configurable: image/video. Server targeting. Admin toggle. Skip button. Click-through. DISABLED for launch." 2 6 $M3 $S6 feature "2026-04-10"
task "[M3.4] Integrate analytics events (11)" "GA4/Amplitude SDK. 11 events: sign_up, login, create/publish/view/accept listing, chat, message, delivery_done, rate, share." 2 4 $M3 $S6 task "2026-04-10"
task "[M3.5] Implement loading states" "Loading spinner/skeleton for all screens. Disabled buttons during critical operations." 3 4 $M3 $S6 task "2026-04-11"
task "[M3.5] Implement empty states" "Feed: No deliveries nearby. Trips/Deliveries: No active + CTA. Chat: empty. Icons/illustrations." 3 3 $M3 $S6 task "2026-04-11"
task "[M3.5] Implement offline and error handling" "Network detection, offline banner. Block critical actions. Error screens + retry. Idempotent requests." 4 6 $M3 $S6 feature "2026-04-11"
task "[M3.5] GPS/location permission handling" "Permission request + explanation. Denied: manual city. Tracking: unavailable fallback. Re-prompt in settings." 3 4 $M3 $S6 task "2026-04-12"
task "[M3.6] P0/P1 bug triage and fixing" "Dedicated bug sprint. All P0 critical + P1 high. No crashes on core flows. E2E validation." 4 16 $M3 $S6 bug "2026-04-12"
task "[M3.6] Performance optimization" "Startup < 2s, feed 60fps, lazy images, optimized Firestore reads. Firebase usage check." 3 4 $M3 $S6 task "2026-04-13"
task "[M3.7] Migrate existing Glide users" "Export Glide data. Transform to Firestore schema. Import script + validation. Reconciliation. User comms." 3 6 $M3 $S6 task "2026-04-13"

# Sprint 7 — M4
task "[M4.1] Production environment configuration" "Production Firebase/GCP: security rules, backup schedule, monitoring dashboards, billing alerts." 4 4 $M4 $S7 task "2026-04-15"
task "[M4.1] Production build configuration" "iOS cert + provisioning. Android keystore. Env → production. Debug disabled. Version set." 4 4 $M4 $S7 task "2026-04-15"
task "[M4.2] Submit to Apple App Store" "App Store Connect: screenshots, description (Hebrew+English), privacy labels, test account, review notes." 4 4 $M4 $S7 task "2026-04-16"
task "[M4.3] Submit to Google Play Store" "Play Console: screenshots, feature graphic, description, content rating, test account. AAB submitted." 4 4 $M4 $S7 task "2026-04-16"
task "[M4.4] Prepare store compliance materials" "Privacy Policy, ToS (hosted URLs). Permission descriptions. iOS 13+ / Android 7+ compatibility." 4 4 $M4 $S7 task "2026-04-15"
task "[M4.5] Production handover and documentation" "GitHub access to client. Firebase/GCP access. Architecture docs, deployment runbook, operations guide. Sign-off." 3 6 $M4 $S7 task "2026-04-17"

echo ""
echo "=== IMPORT COMPLETE ==="
echo "  Milestones: 5 (M0=$M0, M1=$M1, M2=$M2, M3=$M3, M4=$M4)"
echo "  Sprints: 8 (S0=$S0..S7=$S7)"
echo "  Tasks: $TASK_COUNT"
echo ""
