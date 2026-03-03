# Mooviz — Credentials & Access Registry

> This file tracks all accounts, API keys, and project IDs used in the Mooviz project.
> NEVER commit actual secrets — only reference IDs and where to find them.

## Firebase Projects

| Environment | Project ID | Project Number | Console URL |
|-------------|-----------|----------------|-------------|
| Dev/Staging | mooviz-app-9b766 | 797576157589 | https://console.firebase.google.com/project/mooviz-app-9b766 |
| Production | mooviz-prod | 987192365576 | https://console.firebase.google.com/project/mooviz-prod |

## Firebase Apps

### Dev (mooviz-app-9b766)
| Platform | App ID | Bundle/Package |
|----------|--------|----------------|
| iOS | 1:797576157589:ios:0c0d43c29a8fd58f32fe9c | com.mooviz.app |
| Android | 1:797576157589:android:a00841106882289a32fe9c | com.mooviz.app |
| Web (Admin) | 1:797576157589:web:fe2f0c45960eda5332fe9c | — |

### Production (mooviz-prod)
| Platform | App ID | Bundle/Package |
|----------|--------|----------------|
| iOS | 1:987192365576:ios:606f36444f03662c0877bd | com.mooviz.app |
| Android | 1:987192365576:android:717553e467fd938e0877bd | com.mooviz.app |
| Web (Admin) | 1:987192365576:web:22ae7a7e97ad81220877bd | — |

## Accounts

| Service | Account | Purpose |
|---------|---------|---------|
| Firebase/GCP | tamir@k-a-l.solutions | Project owner, CLI access |
| GitHub (origin) | tamirkonor | KAL Solutions dev repo |
| GitHub (client) | moovizproject-art | Client delivery repo (post-milestone) |
| KAL CRM API | .env.crm-api | Task management, sprint tracking |

## API Keys

| Key | Location | Notes |
|-----|----------|-------|
| Firebase Dev API Key | apps/mobile/.env.dev | Web API key for dev project |
| Firebase Prod API Key | apps/mobile/.env.prod | Web API key for prod project |
| Google Maps API Key | TODO | Needs creation in GCP Console |

## Environment Files (gitignored)

| File | Purpose |
|------|---------|
| apps/mobile/.env.dev | Dev Firebase config |
| apps/mobile/.env.staging | Staging Firebase config (points to dev) |
| apps/mobile/.env.prod | Production Firebase config |
| .env.crm-api | KAL CRM API credentials |
