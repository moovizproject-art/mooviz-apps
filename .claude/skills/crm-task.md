---
name: crm-task
description: Create, update, list, and manage MOOVIZ project tasks in KAL CRM via the REST API. Use for creating tasks, updating status, managing milestones and sprints, logging time, and exporting project data.
---

# CRM Task Management Skill — MOOVIZ Project

You interact with the KAL Solutions CRM Projects Extended REST API to manage tasks, milestones, sprints, and timesheets for the MOOVIZ project.

## Connection

| Key | Value |
|-----|-------|
| **Base URL** | `https://crm-app.kal-trade.com/projects_extended/projects_api` |
| **MOOVIZ Project ID** | `1` |
| **Auth** | `X-API-Key` + `X-API-Secret` headers |

Load credentials before making requests:
```bash
source .env.crm-api
```

If `.env.crm-api` doesn't exist, ask the user for credentials and create it:
```bash
cat > .env.crm-api << 'EOF'
CRM_API_URL=https://crm-app.kal-trade.com/projects_extended/projects_api
CRM_API_KEY=<ask user>
CRM_API_SECRET=<ask user>
CRM_PROJECT_ID=1
EOF
```

**IMPORTANT**: `.env.crm-api` is gitignored. Never commit it.

## All Endpoints

### 1. List Tasks (GET)
```bash
curl -s "$CRM_API_URL/tasks?project_id=1&page=1&per_page=50" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" | jq .
```
Response: `{ "data": [...], "page": 1, "per_page": 50, "total": 120, "pages": 3 }`

### 2. Create Task (POST)
```bash
curl -s -X POST "$CRM_API_URL/tasks" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "name": "Implement Firebase OTP",
    "description": "Set up phone OTP via Firebase Auth",
    "priority": 3,
    "status": 1,
    "startdate": "2026-03-10",
    "duedate": "2026-03-15",
    "milestone": 12,
    "sprint_id": 18,
    "task_type": "feature",
    "story_points": 5,
    "estimated_hours": 8,
    "parent_task_id": 0
  }'
```
Response: `{ "success": true, "task_id": 150 }`

### 3. Update Task Status (PATCH)
```bash
curl -s -X PATCH "$CRM_API_URL/task_status/42" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"status": 5}'
```
Response: `{ "success": true, "task_id": 42, "status": 5 }`

### 4. Create Milestone (POST)
```bash
curl -s -X POST "$CRM_API_URL/milestones" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1, "name": "M1 — Backend + Auth", "due_date": "2026-04-15"}'
```
Response: `{ "success": true, "milestone_id": 15 }`

### 5. List Sprints (GET)
```bash
curl -s "$CRM_API_URL/sprints?project_id=1" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" | jq .
```

### 6. Create Sprint (POST)
```bash
curl -s -X POST "$CRM_API_URL/sprints" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "name": "Sprint 1",
    "start_date": "2026-03-10",
    "end_date": "2026-03-23",
    "sprint_type": "biweekly",
    "auto_create_next": 1
  }'
```

### 7. Get Sprint with Tasks & Stats (GET)
```bash
curl -s "$CRM_API_URL/sprint_tasks/18" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" | jq .
```
Response: `{ "sprint": {...}, "tasks": [...], "stats": {...} }`

### 8. Log Time (POST)
```bash
curl -s -X POST "$CRM_API_URL/timesheets" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"task_id": 42, "hours": 2.5, "note": "Implemented auth flow"}'
```

### 9. Export Project (GET)
```bash
curl -s "$CRM_API_URL/export/1" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" | jq .
```
Response: `{ "project_id": 1, "exported_at": "...", "total_tasks": 120, "tasks": [...] }`

## Field Reference

### Task Fields (POST /tasks)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_id` | int | Yes | Always `1` for MOOVIZ |
| `name` | string | Yes | Task title |
| `description` | text | No | HTML allowed |
| `priority` | int | No | 1=Low, 2=Medium, 3=High, 4=Urgent (default: 2) |
| `status` | int | No | See status values (default: 1) |
| `startdate` | date | No | YYYY-MM-DD (default: today) |
| `duedate` | date | No | YYYY-MM-DD |
| `milestone` | int | No | Milestone ID |
| `sprint_id` | int | No | Sprint ID (0 = backlog) |
| `task_type` | string | No | task, feature, bug, story, epic, design |
| `story_points` | int | No | Estimation points |
| `estimated_hours` | decimal | No | Hour estimate |
| `parent_task_id` | int | No | Parent task (for subtasks) |

### Status Values
1 = Not Started, 2 = Awaiting Feedback, 3 = Testing, 4 = In Progress, 5 = Complete

### Sprint Types
`manual`, `weekly` (7d), `biweekly` (14d), `monthly` (30d)

## Workflow

1. Load creds: `source .env.crm-api`
2. Check current tasks: `GET /tasks?project_id=1&per_page=100`
3. Check sprints: `GET /sprints?project_id=1`
4. Create tasks: `POST /tasks` (one at a time — no batch endpoint)
5. Update status as work progresses: `PATCH /task_status/{id}`
6. Log time: `POST /timesheets`

## Error Codes

| HTTP | Meaning |
|------|---------|
| 401 | Bad API key/secret |
| 403 | Wrong project scope or missing permission |
| 429 | Rate limited (60 req/min) — wait 60s |
| 503 | API disabled in CRM settings |

## MOOVIZ Context

- **Project**: G.M. Mooviz — real-time community delivery platform
- **Stack**: React Native + Firebase/GCP
- **CRM Project ID**: 1
- **Staff ID 1**: Tamir Konortov (CTO)
- **Milestones**: M0 (Setup), M1 (Backend+Auth), M2 (Delivery+GPS+Chat), M3 (Stabilization), M4 (Store Submission)
