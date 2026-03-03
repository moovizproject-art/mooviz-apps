# ADR-002: Firebase / GCP Serverless Backend

## Status
Accepted

## Context
MOOVIZ is a community delivery platform that needs real-time data sync, user
authentication, file storage, push notifications, and serverless compute. The team
is small and wants to minimize infrastructure management.

## Decision
Use Firebase as the primary backend platform:

- **Authentication** — Firebase Auth (email/password, Google, Apple sign-in)
- **Database** — Cloud Firestore (real-time sync, offline support)
- **Storage** — Firebase Storage (profile photos, delivery proof, KYC docs)
- **Functions** — Cloud Functions for Firebase (delivery status machine, notifications)
- **Hosting** — Firebase Hosting (admin panel SPA)
- **Messaging** — Firebase Cloud Messaging (push notifications)

## Rationale
1. **Real-time sync**: Firestore provides real-time listeners out of the box, critical
   for live delivery tracking and chat.
2. **Offline support**: Firestore SDK handles offline caching, essential for drivers
   with intermittent connectivity.
3. **Zero server management**: No servers to provision, patch, or scale.
4. **Integrated security**: Firestore and Storage rules provide declarative access
   control tied to Firebase Auth.
5. **Cost efficiency**: Pay-per-use pricing suits early-stage traffic patterns.

## Consequences
- Vendor lock-in to Google Cloud Platform
- Firestore query capabilities are limited compared to SQL databases
- Complex aggregations require Cloud Functions or BigQuery export
- Cold start latency on Cloud Functions (mitigated by min-instances in production)
