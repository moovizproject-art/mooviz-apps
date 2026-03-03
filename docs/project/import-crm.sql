-- ============================================================
-- MOOVIZ CRM Import Script
-- Project ID: 1 (Mooviz Application)
-- ============================================================

SET @project_id = 1;
SET @staff_id = 1;  -- Tamir

-- ============================================================
-- 1. MILESTONES
-- ============================================================
INSERT INTO tblmilestones (name, description, due_date, project_id, color, milestone_order, datecreated) VALUES
('M0 — Project Setup & Kickoff', 'Pre-development: repo, Firebase/GCP, design system scaffold. No payment milestone.', '2026-03-06', @project_id, '#607d8b', 0, CURDATE()),
('M1 — Backend + Auth + Base Mobile', '15% payment = 13,500 NIS + VAT. Auth, users, data models, initial mobile flows.', '2026-03-20', @project_id, '#2196f3', 1, CURDATE()),
('M2 — Delivery Lifecycle + GPS + Chat + Admin', '10% payment = 9,000 NIS + VAT. Delivery CRUD, state machine, GPS, chat, push, payments, admin panel.', '2026-04-06', @project_id, '#ff9800', 2, CURDATE()),
('M3 — Feature Completion + Stabilization', '5% payment = 4,500 NIS + VAT. Ratings, cancellation, analytics, edge cases, bug fixing, migration.', '2026-04-11', @project_id, '#9c27b0', 3, CURDATE()),
('M4 — Final Delivery + Store Submission', '20% payment = 18,000 NIS + VAT. Production build, App Store, Play Store, compliance, handover.', '2026-04-14', @project_id, '#4caf50', 4, CURDATE());

-- Get milestone IDs
SET @m0 = (SELECT id FROM tblmilestones WHERE project_id = @project_id AND name LIKE 'M0%' ORDER BY id DESC LIMIT 1);
SET @m1 = (SELECT id FROM tblmilestones WHERE project_id = @project_id AND name LIKE 'M1%' ORDER BY id DESC LIMIT 1);
SET @m2 = (SELECT id FROM tblmilestones WHERE project_id = @project_id AND name LIKE 'M2%' ORDER BY id DESC LIMIT 1);
SET @m3 = (SELECT id FROM tblmilestones WHERE project_id = @project_id AND name LIKE 'M3%' ORDER BY id DESC LIMIT 1);
SET @m4 = (SELECT id FROM tblmilestones WHERE project_id = @project_id AND name LIKE 'M4%' ORDER BY id DESC LIMIT 1);

-- ============================================================
-- 2. SPRINTS (8 sprints, 45 days)
-- ============================================================
INSERT INTO tblsprints (project_id, name, goal, status, start_date, end_date, created_by, created_at) VALUES
(@project_id, 'Sprint 0 — Setup & Scaffold',        'Repo, Firebase, RN project, component library, Maps SDK',         'planning', '2026-03-04', '2026-03-06', @staff_id, NOW()),
(@project_id, 'Sprint 1 — Auth + Users + Models',    'OTP auth, registration, profiles, Firestore data models, security rules', 'planning', '2026-03-07', '2026-03-13', @staff_id, NOW()),
(@project_id, 'Sprint 2 — Mobile Scaffold + Home',   'Auth screens, state management, Firebase service layer, home screen, create listing', 'planning', '2026-03-14', '2026-03-20', @staff_id, NOW()),
(@project_id, 'Sprint 3 — Delivery CRUD + Feed + FSM', 'Listing backend, driver feed, geohash search, status state machine', 'planning', '2026-03-21', '2026-03-27', @staff_id, NOW()),
(@project_id, 'Sprint 4 — GPS + Chat + Push + Pay',  'Location broadcasting, live map, chat, proof system, push notifications, payment flow', 'planning', '2026-03-28', '2026-04-03', @staff_id, NOW()),
(@project_id, 'Sprint 5 — Admin Panel + Ratings',    'Admin auth/dashboard/users/deliveries/reports, rating system', 'planning', '2026-04-04', '2026-04-09', @staff_id, NOW()),
(@project_id, 'Sprint 6 — Polish + Edge Cases',      'Cancellation, ads infra, analytics, loading/empty/error states, GPS handling, bug fixing, migration', 'planning', '2026-04-10', '2026-04-14', @staff_id, NOW()),
(@project_id, 'Sprint 7 — Store Submission',         'Production config, builds, App Store + Play Store submission, compliance, handover', 'planning', '2026-04-15', '2026-04-17', @staff_id, NOW());

-- Get sprint IDs
SET @s0 = (SELECT id FROM tblsprints WHERE project_id = @project_id AND name LIKE 'Sprint 0%' ORDER BY id DESC LIMIT 1);
SET @s1 = (SELECT id FROM tblsprints WHERE project_id = @project_id AND name LIKE 'Sprint 1%' ORDER BY id DESC LIMIT 1);
SET @s2 = (SELECT id FROM tblsprints WHERE project_id = @project_id AND name LIKE 'Sprint 2%' ORDER BY id DESC LIMIT 1);
SET @s3 = (SELECT id FROM tblsprints WHERE project_id = @project_id AND name LIKE 'Sprint 3%' ORDER BY id DESC LIMIT 1);
SET @s4 = (SELECT id FROM tblsprints WHERE project_id = @project_id AND name LIKE 'Sprint 4%' ORDER BY id DESC LIMIT 1);
SET @s5 = (SELECT id FROM tblsprints WHERE project_id = @project_id AND name LIKE 'Sprint 5%' ORDER BY id DESC LIMIT 1);
SET @s6 = (SELECT id FROM tblsprints WHERE project_id = @project_id AND name LIKE 'Sprint 6%' ORDER BY id DESC LIMIT 1);
SET @s7 = (SELECT id FROM tblsprints WHERE project_id = @project_id AND name LIKE 'Sprint 7%' ORDER BY id DESC LIMIT 1);

-- ============================================================
-- 3. TASKS (73 tasks)
-- Fields: name, description, priority, dateadded, startdate, duedate,
--         addedfrom, status, rel_id, rel_type, milestone, sprint_id,
--         task_type, estimated_hours, kanban_order
-- Status: 1=Not Started, Priority: 1=Low,2=Med,3=High,4=Urgent
-- ============================================================

-- === SPRINT 0 — M0: Project Setup (12 tasks) ===
INSERT INTO tbltasks (name, description, priority, dateadded, startdate, addedfrom, status, rel_id, rel_type, milestone, sprint_id, task_type, estimated_hours, kanban_order) VALUES
('[M0.1] Create GitHub monorepo', 'Set up GitHub repository under KAL Solutions org with monorepo structure: /apps/mobile, /apps/admin, /functions, /shared. Configure branch protection on main. Add .gitignore for RN/Node/Firebase. Client remote added for post-milestone push.', 3, NOW(), '2026-03-04', @staff_id, 1, @project_id, 'project', @m0, @s0, 'task', 2.00, 1),
('[M0.1] Configure CI/CD pipelines', 'Set up GitHub Actions for Cloud Functions (lint + deploy to dev). EAS Build config for iOS + Android. PR checks: lint + type check. Deploy scripts for staging/production.', 3, NOW(), '2026-03-04', @staff_id, 1, @project_id, 'project', @m0, @s0, 'task', 3.00, 2),
('[M0.1] Set up environment separation', 'Create dev/staging/production env configs. .env templates, Firebase project aliases, EAS build profiles. Secrets stored securely outside repo.', 3, NOW(), '2026-03-04', @staff_id, 1, @project_id, 'project', @m0, @s0, 'task', 2.00, 3),
('[M0.1] Import tasks into KAL CRM', 'Import MOOVIZ tasks into KAL CRM project. Verify milestones, sprints, and task dependencies are correctly mapped.', 4, NOW(), '2026-03-04', @staff_id, 1, @project_id, 'project', @m0, @s0, 'task', 1.00, 4),
('[M0.2] Create Firebase projects (dev + prod)', 'Set up mooviz-dev and mooviz-prod Firebase projects. Enable Auth, Firestore, Functions, Storage, FCM. Configure billing alerts at $50/$100/$200. Firebase CLI project aliases.', 4, NOW(), '2026-03-04', @staff_id, 1, @project_id, 'project', @m0, @s0, 'task', 3.00, 5),
('[M0.2] Configure Firebase Authentication', 'Enable phone (SMS) and email OTP providers. Configure SMS templates (Hebrew + English). Set up authorized domains. Test with Auth emulator.', 4, NOW(), '2026-03-04', @staff_id, 1, @project_id, 'project', @m0, @s0, 'task', 2.00, 6),
('[M0.2] Set up Firestore + Security Rules baseline', 'Initialize Firestore in both projects. Deploy default deny-all security rules. Configure Firestore emulator. Placeholder composite indexes.', 4, NOW(), '2026-03-05', @staff_id, 1, @project_id, 'project', @m0, @s0, 'task', 2.00, 7),
('[M0.2] Set up Cloud Storage and FCM', 'Configure Cloud Storage buckets for images (proofs, profiles, items). Storage security rules (auth uploads only). Enable FCM, upload APNs key for iOS, Android FCM config.', 3, NOW(), '2026-03-05', @staff_id, 1, @project_id, 'project', @m0, @s0, 'task', 2.00, 8),
('[M0.3] Initialize React Native project', 'Create RN project (Expo managed). Configure TypeScript strict, ESLint, Prettier. Set up path aliases and folder structure: screens/, components/, services/, hooks/, utils/, types/.', 3, NOW(), '2026-03-05', @staff_id, 1, @project_id, 'project', @m0, @s0, 'task', 3.00, 9),
('[M0.3] Set up navigation structure', 'Configure React Navigation with bottom tabs (role-based for Sender/Driver) and stack navigators for each flow. Support RTL. Deep linking scaffold.', 3, NOW(), '2026-03-05', @staff_id, 1, @project_id, 'project', @m0, @s0, 'task', 3.00, 10),
('[M0.3] Build base component library', 'Create reusable UI components: Button, TextInput, Card, Modal, Avatar, Badge, RatingStars, StatusBadge, LoadingIndicator, EmptyState, ErrorState. Theme system (colors, typography, spacing). RTL-aware.', 3, NOW(), '2026-03-06', @staff_id, 1, @project_id, 'project', @m0, @s0, 'task', 4.00, 11),
('[M0.3] Integrate Google Maps SDK', 'Add Google Maps to RN project. API keys for iOS + Android. Base MapView component. Marker and region components.', 3, NOW(), '2026-03-06', @staff_id, 1, @project_id, 'project', @m0, @s0, 'task', 3.00, 12);

-- === SPRINT 1 — M1: Auth + Users + Data Models (12 tasks) ===
INSERT INTO tbltasks (name, description, priority, dateadded, startdate, addedfrom, status, rel_id, rel_type, milestone, sprint_id, task_type, estimated_hours, kanban_order) VALUES
('[M1.1] Implement OTP login flow (SMS)', 'Core authentication: phone input with country code → SMS OTP → 6-digit verification → authenticated. Loading states, error handling (invalid number, wrong code, expired, rate limit).', 4, NOW(), '2026-03-07', @staff_id, 1, @project_id, 'project', @m1, @s1, 'feature', 6.00, 13),
('[M1.1] Implement OTP login flow (Email)', 'Alternative auth: email input → magic link or OTP → verified. Fallback when SMS unavailable.', 3, NOW(), '2026-03-07', @staff_id, 1, @project_id, 'project', @m1, @s1, 'feature', 4.00, 14),
('[M1.1] Implement auth state persistence', 'Persist auth state across app restarts. Token auto-refresh. Logout clears session. Deep link to login on expiry.', 4, NOW(), '2026-03-08', @staff_id, 1, @project_id, 'project', @m1, @s1, 'feature', 3.00, 15),
('[M1.2] Build registration form screen', 'Multi-step registration: name, phone, email, city, role (sender/driver), profile photo, ID/license photo. Validation per spec (name 2-60 chars, phone E.164, etc.). Terms consent required.', 4, NOW(), '2026-03-08', @staff_id, 1, @project_id, 'project', @m1, @s1, 'feature', 8.00, 16),
('[M1.2] Implement profile photo upload', 'Camera capture + gallery selection. Resize/compress before upload. Upload to Cloud Storage. Default avatar fallback.', 3, NOW(), '2026-03-09', @staff_id, 1, @project_id, 'project', @m1, @s1, 'feature', 4.00, 17),
('[M1.2] Implement KYC-Light (ID/license upload)', 'Upload ID card or driver license photo for admin verification. Camera/gallery import. Stored in Cloud Storage with user reference. KYC status: pending/approved/rejected.', 3, NOW(), '2026-03-09', @staff_id, 1, @project_id, 'project', @m1, @s1, 'feature', 4.00, 18),
('[M1.2] Build profile view and edit screens', 'Profile screen: all user data, average rating (stars), completed count, join date. Edit screen for modifiable fields (name, city, photo).', 3, NOW(), '2026-03-10', @staff_id, 1, @project_id, 'project', @m1, @s1, 'feature', 4.00, 19),
('[M1.3] Design and implement Firestore data models', 'Define all Firestore collections: users, deliveries, chats (with messages subcollection), ratings, reports, adminActions. TypeScript interfaces. Firestore indexes for common queries.', 4, NOW(), '2026-03-10', @staff_id, 1, @project_id, 'project', @m1, @s1, 'feature', 8.00, 20),
('[M1.3] Set up Firestore composite indexes', 'Create composite indexes: deliveries by status+geohash, user deliveries by userId+status, chat messages by deliveryId+timestamp.', 3, NOW(), '2026-03-11', @staff_id, 1, @project_id, 'project', @m1, @s1, 'task', 2.00, 21),
('[M1.4] Implement Firestore security rules', 'Security rules for all collections. Users: read own, write own, admin read all. Deliveries: read by participants + available drivers. Chats: participants only. Ratings: create by participants.', 4, NOW(), '2026-03-11', @staff_id, 1, @project_id, 'project', @m1, @s1, 'feature', 6.00, 22),
('[M1.4] Build Cloud Functions scaffold', 'Cloud Functions project with TypeScript. Function groups: auth/, delivery/, chat/, notification/, admin/. Shared utils. Local emulator. Deploy to dev.', 3, NOW(), '2026-03-12', @staff_id, 1, @project_id, 'project', @m1, @s1, 'task', 4.00, 23),
('[M1.4] Implement RBAC utility functions', 'Role-based access control for Cloud Functions. getRoleFromToken(), requireRole() middleware, isAdmin() check. Role validation in Firestore triggers.', 4, NOW(), '2026-03-12', @staff_id, 1, @project_id, 'project', @m1, @s1, 'feature', 3.00, 24);

-- === SPRINT 2 — M1.5/M1.6 + M2.1 start (7 tasks) ===
INSERT INTO tbltasks (name, description, priority, dateadded, startdate, addedfrom, status, rel_id, rel_type, milestone, sprint_id, task_type, estimated_hours, kanban_order) VALUES
('[M1.5] Build auth flow screens (complete)', 'Polish: splash screen, welcome/onboarding slides, phone/email selection, OTP entry with auto-fill, route to registration (new) or home (returning).', 3, NOW(), '2026-03-14', @staff_id, 1, @project_id, 'project', @m1, @s2, 'feature', 6.00, 25),
('[M1.5] Implement global state management', 'Auth context, user profile context, active deliveries state, notification badge count. Persistent storage for offline cache. React Context or Zustand.', 3, NOW(), '2026-03-14', @staff_id, 1, @project_id, 'project', @m1, @s2, 'feature', 4.00, 26),
('[M1.5] Build Firebase service layer', 'Service abstraction: AuthService (login/logout/getUser/onAuthChange), FirestoreService (typed CRUD), StorageService (upload/getURL/delete), FCMService (getToken/onMessage).', 3, NOW(), '2026-03-15', @staff_id, 1, @project_id, 'project', @m1, @s2, 'feature', 6.00, 27),
('[M1.5] Implement error boundary and crash handling', 'Global error boundary wrapping app. Fallback error screen with retry. Unhandled promise rejection handling. Console logging (dev) / crash reporting (prod).', 3, NOW(), '2026-03-16', @staff_id, 1, @project_id, 'project', @m1, @s2, 'task', 3.00, 28),
('[M1.6] Build home screen (role-based)', 'Home adapts to user role. Sender: ''Create new delivery'' CTA. Driver: ''Find nearby deliveries'' CTA. Greeting with name, tagline, social links (FB, IG, TikTok).', 3, NOW(), '2026-03-17', @staff_id, 1, @project_id, 'project', @m1, @s2, 'feature', 4.00, 29),
('[M1.6] Build onboarding flow (first-time)', 'First-time user onboarding: 2-3 slides explaining the app. Skip button, dot nav. Shown only once (persisted flag).', 2, NOW(), '2026-03-18', @staff_id, 1, @project_id, 'project', @m1, @s2, 'feature', 3.00, 30),
('[M2.1] Build create listing form', 'Full listing creation form. Google Places autocomplete for addresses. Item photo upload. Date picker (ASAP/future). Item type dropdown, size selector, price (NIS), notes. Field validation per spec.', 4, NOW(), '2026-03-18', @staff_id, 1, @project_id, 'project', @m2, @s2, 'feature', 10.00, 31);

-- === SPRINT 3 — M2.1-M2.3: Delivery CRUD + Feed + State Machine (7 tasks) ===
INSERT INTO tbltasks (name, description, priority, dateadded, startdate, addedfrom, status, rel_id, rel_type, milestone, sprint_id, task_type, estimated_hours, kanban_order) VALUES
('[M2.1] Implement listing backend (CRUD)', 'Cloud Functions for createDelivery (with validation), editDelivery (only if status=New, no driver), deleteDelivery (only if status=New). Initial status = ''new''. Geohash generated from pickup coords.', 4, NOW(), '2026-03-21', @staff_id, 1, @project_id, 'project', @m2, @s3, 'feature', 6.00, 32),
('[M2.1] Build My Deliveries screen (Sender)', 'List view with item photo, addresses, status badge. Drill into delivery details. Cancel (pre-pickup), chat, phone, navigate, report buttons.', 3, NOW(), '2026-03-22', @staff_id, 1, @project_id, 'project', @m2, @s3, 'feature', 6.00, 33),
('[M2.2] Build driver feed screen', 'Scrollable feed of available listings. Each card: item photo, pickup, destination, price. Filter bar: size, city, distance radius. Pull-to-refresh. Empty state.', 4, NOW(), '2026-03-22', @staff_id, 1, @project_id, 'project', @m2, @s3, 'feature', 8.00, 34),
('[M2.2] Implement geohash-based radius search', 'Backend proximity search. Geohash library integration. Query: getDeliveriesInRadius(lat,lng,radiusKm). Haversine exact distance filter. Configurable radius: 1/3/5km.', 4, NOW(), '2026-03-23', @staff_id, 1, @project_id, 'project', @m2, @s3, 'feature', 6.00, 35),
('[M2.2] Implement "I am Interested" action', 'Driver clicks "I''m Interested" → status = pending, removed from feed, push to sender. Concurrency: only one driver per delivery.', 4, NOW(), '2026-03-24', @staff_id, 1, @project_id, 'project', @m2, @s3, 'feature', 4.00, 36),
('[M2.3] Implement delivery status state machine', 'CRITICAL: Cloud Function validating all status transitions. 7 statuses, actor validation, cancellation rules (blocked after picked_up), concurrency locking, 72h timeout auto-revert. Each transition: status update, timestamp, actor log.', 4, NOW(), '2026-03-24', @staff_id, 1, @project_id, 'project', @m2, @s3, 'feature', 12.00, 37),
('[M2.3] Build delivery detail screen with actions', 'Full delivery info, status badge, status-dependent action buttons. Sender: approve driver, cancel, map, chat. Driver: picked up, delivered, cancel, navigate, chat. Status timeline visible.', 4, NOW(), '2026-03-26', @staff_id, 1, @project_id, 'project', @m2, @s3, 'feature', 8.00, 38);

-- === SPRINT 4 — M2.4-M2.7: GPS + Chat + Push + Payments (12 tasks) ===
INSERT INTO tbltasks (name, description, priority, dateadded, startdate, addedfrom, status, rel_id, rel_type, milestone, sprint_id, task_type, estimated_hours, kanban_order) VALUES
('[M2.4] Implement driver location broadcasting', 'Driver broadcasts location at 10-30s intervals during active delivery. Stored: lat, lng, geohash, heading, speed, updatedAt. Battery optimized (significant change filter). Stops on completion.', 4, NOW(), '2026-03-28', @staff_id, 1, @project_id, 'project', @m2, @s4, 'feature', 6.00, 39),
('[M2.4] Build live map tracking view', 'Google Maps with both party markers. Real-time driver position updates. Route line between pickup/destination. Status-based markers. ''Location unavailable'' fallback. Auto-center.', 4, NOW(), '2026-03-28', @staff_id, 1, @project_id, 'project', @m2, @s4, 'feature', 8.00, 40),
('[M2.4] Implement navigation deep links', 'Launch Google Maps / Waze / Apple Maps with destination coords. App chooser. Status-dependent: pickup address (waiting) or destination (picked_up).', 2, NOW(), '2026-03-29', @staff_id, 1, @project_id, 'project', @m2, @s4, 'task', 3.00, 41),
('[M2.5] Build real-time chat screen', '1:1 chat per delivery. Firestore onSnapshot real-time sync. Delivery thumbnail + status header. Phone call shortcut. Keyboard handling. Message timestamps.', 4, NOW(), '2026-03-29', @staff_id, 1, @project_id, 'project', @m2, @s4, 'feature', 10.00, 42),
('[M2.5] Implement system messages in chat', 'Auto system messages for every status change. Format: status description + timestamp + actor. Visual distinction from user messages. Hebrew templates.', 4, NOW(), '2026-03-30', @staff_id, 1, @project_id, 'project', @m2, @s4, 'feature', 4.00, 43),
('[M2.5] Implement chat image upload', 'Camera + gallery image upload in chat. Compression before upload. Cloud Storage with delivery reference. Image preview in chat bubble. Upload progress.', 3, NOW(), '2026-03-31', @staff_id, 1, @project_id, 'project', @m2, @s4, 'feature', 4.00, 44),
('[M2.5] Implement proof system (pickup/delivery/payment)', 'Mandatory proof image for picked_up and delivered transitions. Cannot complete without photo. Payment proof optional for sender. Metadata: deliveryId, uploadedBy, proofType, timestamp. Visible in chat timeline. Non-deletable.', 4, NOW(), '2026-03-31', @staff_id, 1, @project_id, 'project', @m2, @s4, 'feature', 6.00, 45),
('[M2.6] Implement Cloud Functions push triggers', 'Server-side triggers for all 8 notification events from push matrix. Firestore triggers on delivery status changes + chat messages. FCM message construction with title/body/deep link. Geo-targeted for new listings.', 4, NOW(), '2026-04-01', @staff_id, 1, @project_id, 'project', @m2, @s4, 'feature', 10.00, 46),
('[M2.6] Implement FCM client integration', 'FCM permission request, token stored in user document. Foreground notification display. Background handling. Tap → deep link to relevant screen. Badge count management.', 4, NOW(), '2026-04-01', @staff_id, 1, @project_id, 'project', @m2, @s4, 'feature', 6.00, 47),
('[M2.6] Implement in-app notification fallback', 'When push not delivered (OS restrictions), update in-app badge/indicator on next app open. Notification state synced from Firestore.', 3, NOW(), '2026-04-02', @staff_id, 1, @project_id, 'project', @m2, @s4, 'feature', 4.00, 48),
('[M2.7] Build payment confirmation UI', 'Payment section in delivery details. Deep links to Bit/PayBox/bank. Sender: ''Payment Sent'' button. Driver: ''Payment Received'' button. Status: Pending → Sent → Confirmed → Completed.', 4, NOW(), '2026-04-02', @staff_id, 1, @project_id, 'project', @m2, @s4, 'feature', 6.00, 49),
('[M2.7] Implement payment confirmation backend', 'confirmPayment Cloud Function. Validates actor (sender sends, driver receives). Stores confirmation with timestamp. Both confirm → auto-transition to completed_paid. Chat system message + push.', 4, NOW(), '2026-04-03', @staff_id, 1, @project_id, 'project', @m2, @s4, 'feature', 4.00, 50);

-- === SPRINT 5 — M2.8 + M3.1: Admin Panel + Ratings (7 tasks) ===
INSERT INTO tbltasks (name, description, priority, dateadded, startdate, addedfrom, status, rel_id, rel_type, milestone, sprint_id, task_type, estimated_hours, kanban_order) VALUES
('[M2.8] Build admin panel authentication', 'Web app (React/Vite). Firebase Auth integration. Admin role check on login. Redirect non-admin. Session management.', 4, NOW(), '2026-04-04', @staff_id, 1, @project_id, 'project', @m2, @s5, 'feature', 4.00, 51),
('[M2.8] Build admin dashboard', 'Key metrics: total users, active deliveries, deliveries/week, acceptance rate, active reports. Real-time Firestore data. Charts. Quick links.', 3, NOW(), '2026-04-04', @staff_id, 1, @project_id, 'project', @m2, @s5, 'feature', 4.00, 52),
('[M2.8] Build admin user management', 'User table with pagination, search (name/phone/email), filter (role/KYC/status). User detail: profile, rating, deliveries, reports, KYC doc. Actions: suspend, block, unblock, verify. Audit trail.', 4, NOW(), '2026-04-05', @staff_id, 1, @project_id, 'project', @m2, @s5, 'feature', 8.00, 53),
('[M2.8] Build admin delivery management', 'Delivery table with filters (status/date/city). Detail: timeline, status logs, payment logs, proof viewer. Admin override: change status, force cancel, resolve. Audit trail.', 4, NOW(), '2026-04-06', @staff_id, 1, @project_id, 'project', @m2, @s5, 'feature', 8.00, 54),
('[M2.8] Build admin report & moderation tools', 'Report list with filters (type/status/date). 5+ report types. Admin notes per user/delivery. Remove abusive ratings/comments. Moderation history audit trail.', 3, NOW(), '2026-04-07', @staff_id, 1, @project_id, 'project', @m2, @s5, 'feature', 6.00, 55),
('[M3.1] Build rating prompt and submission UI', 'After ''Delivered'': 1-5 star selector + optional comment (300 chars). Push notification trigger. Can rate later from My Deliveries/Trips. One-time submission.', 3, NOW(), '2026-04-08', @staff_id, 1, @project_id, 'project', @m3, @s5, 'feature', 6.00, 56),
('[M3.1] Implement rating backend and display', 'createRating Cloud Function. One rating per user per delivery. User aggregate: average + count updated on write. Display on profiles and listings.', 3, NOW(), '2026-04-09', @staff_id, 1, @project_id, 'project', @m3, @s5, 'feature', 4.00, 57);

-- === SPRINT 6 — M3.2-M3.7: Polish + Edge Cases (10 tasks) ===
INSERT INTO tbltasks (name, description, priority, dateadded, startdate, addedfrom, status, rel_id, rel_type, milestone, sprint_id, task_type, estimated_hours, kanban_order) VALUES
('[M3.2] Implement cancellation logic (complete)', 'Full cancellation: both sender and driver (pre-pickup only). Status revert to ''new''. Listing returns to feed. Push to counterpart. System message in chat. Blocked after picked_up.', 4, NOW(), '2026-04-10', @staff_id, 1, @project_id, 'project', @m3, @s6, 'feature', 6.00, 58),
('[M3.3] Build interstitial ad infrastructure', 'Configurable launch screen: image/video. Server-side targeting (role, user flag, group). Admin toggle. Duration + skip button. Click-through link. DISABLED for launch.', 2, NOW(), '2026-04-10', @staff_id, 1, @project_id, 'project', @m3, @s6, 'feature', 6.00, 59),
('[M3.4] Integrate analytics events (11 events)', 'GA4 or Amplitude SDK. All 11 events: sign_up, login_success, create_listing, publish_listing, view_listing, accept_listing, chat_opened, message_sent, delivery_done, rate_sent, share_app. Correct parameters.', 2, NOW(), '2026-04-10', @staff_id, 1, @project_id, 'project', @m3, @s6, 'task', 4.00, 60),
('[M3.5] Implement loading states across all screens', 'Loading spinner/skeleton for feed, details, chat, profile. Disabled buttons during status updates, publish, payment confirmation.', 3, NOW(), '2026-04-11', @staff_id, 1, @project_id, 'project', @m3, @s6, 'task', 4.00, 61),
('[M3.5] Implement empty states across all screens', 'Driver Feed: ''No deliveries nearby'' + change radius. My Trips/Deliveries: ''No active'' + CTA. Chat: empty state. Each with icon/illustration.', 3, NOW(), '2026-04-11', @staff_id, 1, @project_id, 'project', @m3, @s6, 'task', 3.00, 62),
('[M3.5] Implement offline and error handling', 'Network detection, offline banner. Critical actions blocked offline. Error screens with retry. Idempotent requests (prevent double-tap). Retry logic for transient failures.', 4, NOW(), '2026-04-11', @staff_id, 1, @project_id, 'project', @m3, @s6, 'feature', 6.00, 63),
('[M3.5] Implement GPS/location permission handling', 'Location permission request with explanation. GPS denied: manual city selection for driver feed. Publishing: address autocomplete regardless of GPS. Tracking: ''Location unavailable'' fallback. Re-prompt in settings.', 3, NOW(), '2026-04-12', @staff_id, 1, @project_id, 'project', @m3, @s6, 'task', 4.00, 64),
('[M3.6] P0/P1 bug triage and fixing sprint', 'Dedicated bug fixing. All P0 critical and P1 high-severity issues. No crashes on core flows. End-to-end flow validation. Performance check on target devices.', 4, NOW(), '2026-04-12', @staff_id, 1, @project_id, 'project', @m3, @s6, 'bug', 16.00, 65),
('[M3.6] Performance optimization', 'App startup < 2s on 4G. Feed scrolling 60fps. Lazy-loaded images. Optimized Firestore queries (minimize unnecessary reads). Firebase usage dashboard check.', 3, NOW(), '2026-04-13', @staff_id, 1, @project_id, 'project', @m3, @s6, 'task', 4.00, 66),
('[M3.7] Migrate existing Glide users', 'Export user data from existing Glide app (mooviz-app.glide.page). Transform: Glide fields → Firestore schema. Import script with validation. Reconciliation report. User communication plan.', 3, NOW(), '2026-04-13', @staff_id, 1, @project_id, 'project', @m3, @s6, 'task', 6.00, 67);

-- === SPRINT 7 — M4: Store Submission (6 tasks) ===
INSERT INTO tbltasks (name, description, priority, dateadded, startdate, addedfrom, status, rel_id, rel_type, milestone, sprint_id, task_type, estimated_hours, kanban_order) VALUES
('[M4.1] Production environment configuration', 'Production Firebase/GCP project: security rules, Firestore backup schedule, GCP monitoring dashboards, billing alerts, env vars.', 4, NOW(), '2026-04-15', @staff_id, 1, @project_id, 'project', @m4, @s7, 'task', 4.00, 68),
('[M4.1] Production build configuration', 'iOS: production cert + provisioning profile. Android: production keystore + signing. Env → production Firebase. Debug tools disabled. Version + build number set.', 4, NOW(), '2026-04-15', @staff_id, 1, @project_id, 'project', @m4, @s7, 'task', 4.00, 69),
('[M4.2] Submit to Apple App Store', 'App Store Connect listing, screenshots (all sizes), description (Hebrew + English), privacy nutrition labels, test account in review notes, demo video if needed. Build uploaded and submitted.', 4, NOW(), '2026-04-16', @staff_id, 1, @project_id, 'project', @m4, @s7, 'task', 4.00, 70),
('[M4.3] Submit to Google Play Store', 'Play Console listing, screenshots + feature graphic, description (Hebrew + English), content rating questionnaire, test account. AAB uploaded and submitted.', 4, NOW(), '2026-04-16', @staff_id, 1, @project_id, 'project', @m4, @s7, 'task', 4.00, 71),
('[M4.4] Prepare store compliance materials', 'Privacy Policy page (hosted URL), Terms of Service page, permission descriptions (notifications, location, camera, photos). iOS 13+ / Android 7+ compatibility verified.', 4, NOW(), '2026-04-15', @staff_id, 1, @project_id, 'project', @m4, @s7, 'task', 4.00, 72),
('[M4.5] Production handover and documentation', 'GitHub repo access to client. Firebase/GCP project access shared. Architecture docs, deployment runbook, common operations guide, env var docs. Final sign-off meeting.', 3, NOW(), '2026-04-17', @staff_id, 1, @project_id, 'project', @m4, @s7, 'task', 6.00, 73);

-- ============================================================
-- 4. ASSIGN ALL TASKS TO TAMIR (staff_id = 1)
-- ============================================================
INSERT INTO tbltask_assigned (taskid, staffid)
SELECT id, @staff_id FROM tbltasks WHERE rel_id = @project_id AND rel_type = 'project';
