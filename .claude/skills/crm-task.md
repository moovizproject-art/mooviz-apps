---
name: crm-task
description: Create, update, list, and manage MOOVIZ project tasks, sprints, milestones, subtasks, and notifications in KAL CRM via the REST API.
---

# CRM Task Management Skill — MOOVIZ Project

You interact with the KAL Solutions CRM Projects Extended REST API to manage tasks, sprints, milestones, subtasks, assignees, and notifications for the MOOVIZ project.

## Connection

| Key | Value |
|-----|-------|
| **Base URL** | `https://crm-app.kal-trade.com/projects_extended/projects_api` |
| **MOOVIZ Project ID** | `1` |
| **Auth** | `X-API-Key` + `X-API-Secret` headers |

Load credentials before making requests:
```bash
if [ -f .env.crm-api ]; then
  source .env.crm-api
else
  echo "ERROR: .env.crm-api not found. Create it with CRM_API_URL, CRM_API_KEY, CRM_API_SECRET, CRM_PROJECT_ID"
  exit 1
fi
```

**IMPORTANT**: `.env.crm-api` is gitignored. Never commit credentials. Keys must be loaded from `.env.crm-api` only.

## Quick Reference — All Endpoints

### Projects & Lookup
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List all accessible projects |
| GET | `/project/{id}` | Project details with stats, milestones, members |
| POST | `/projects` | Create a new project |
| POST | `/clients` | Create client company + primary contact |
| POST | `/project_members` | Add members to a project |
| GET | `/staff?project_id=X` | List project staff |
| GET | `/statuses?project_id=X` | Standard + custom statuses |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks?project_id=X&page=1&per_page=50` | List tasks (paginated, filters: `sprint_id`, `status`) |
| GET | `/task/{id}` | Task detail with assignees, counts |
| POST | `/tasks` | Create task |
| POST | `/tasks_batch` | Batch create (max 50) |
| PATCH | `/task/{id}` | Update task fields |
| PATCH | `/task_status/{id}` | Quick status update |
| DELETE | `/task_delete/{id}` | Delete task |

### Subtasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/subtasks?task_id=X` | List subtasks |
| POST | `/subtasks` | Create subtask (`parent_task_id`, `name`) |

### Sprints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sprints?project_id=X` | List sprints |
| POST | `/sprints` | Create sprint |
| GET | `/sprint/{id}` | Sprint details + stats |
| PATCH | `/sprint/{id}` | Update sprint fields |
| DELETE | `/sprint/{id}` | Delete sprint |
| POST | `/sprint_start/{id}` | Start sprint (planning → active) |
| POST | `/sprint_close/{id}` | Close sprint (→ completed) |
| POST | `/sprint_assign` | Assign tasks (`sprint_id`, `task_ids[]`) |
| GET | `/sprint_tasks/{id}` | Sprint tasks + stats (use `id=0&project_id=X` for backlog) |

### Milestones
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/milestones?project_id=X` | List with task counts |
| POST | `/milestones` | Create milestone |
| GET | `/milestone/{id}` | Detail with task counts |
| PATCH | `/milestone/{id}` | Update milestone |
| DELETE | `/milestone/{id}` | Delete (unlinks tasks) |

### Assignees & Followers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/task_assignees?task_id=X` | List staff assignees |
| POST | `/task_assignees` | Assign staff (`task_id`, `staff_id`) |
| DELETE | `/task_assignee/{task_id}/{staff_id}` | Remove staff assignee |
| POST | `/task_followers` | Add watcher (`task_id`, `staff_id`) |

### External Assignees (Contacts, Partners, Affiliates)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/task_external_assignees?task_id=X` | List external assignees with name/email |
| POST | `/task_external_assignees` | Add external assignee (`task_id`, `assignee_type`, `assignee_id`) |
| DELETE | `/task_external_assignee/{task_id}/{id}` | Remove external assignee by record ID |

### Comments & Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/task_comments?task_id=X` | List comments |
| POST | `/task_comments` | Add comment (`task_id`, `content`) |
| POST | `/task_attachments` | Upload file to task (multipart `file`) |
| POST | `/project_files` | Upload file to project (multipart `file`) |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/notify` | Send notification to staff |
| POST | `/notify_task` | Task notification with direct link |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/timesheets` | Log time (`task_id`, `hours`, `note`) |
| GET | `/export/{project_id}` | Full JSON export |

---

## Key Examples

### Create Task
```bash
curl -s -X POST "$CRM_API_URL/tasks" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1, "name": "Implement Firebase OTP", "priority": 3, "task_type": "feature", "milestone": 12}'
```

### Add Comment to Task
```bash
curl -s -X POST "$CRM_API_URL/task_comments" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"task_id": 100, "content": "Feature implemented — ready for QA."}'
```

### Upload File to Task
```bash
curl -s -X POST "$CRM_API_URL/task_attachments" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -F "task_id=100" -F "file=@/path/to/screenshot.png"
```

### Create Project
```bash
curl -s -X POST "$CRM_API_URL/projects" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Project", "clientid": 1, "start_date": "2026-03-08", "status": 2, "members": [1]}'
```

### Add Project Members
```bash
curl -s -X POST "$CRM_API_URL/project_members" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1, "staff_ids": [1, 5]}'
```

### Add Task Follower
```bash
curl -s -X POST "$CRM_API_URL/task_followers" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"task_id": 100, "staff_id": 5}'
```

### Sprint Lifecycle
```bash
# Create → Start → Close
curl -s -X POST "$CRM_API_URL/sprints" -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1, "name": "Sprint 19", "start_date": "2026-03-10", "end_date": "2026-03-24", "sprint_type": "biweekly"}'

curl -s -X POST "$CRM_API_URL/sprint_start/19" -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET"

curl -s -X POST "$CRM_API_URL/sprint_assign" -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" -d '{"sprint_id": 19, "task_ids": [101, 102, 103]}'

curl -s -X POST "$CRM_API_URL/sprint_close/19" -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" -d '{"carry_over_sprint_id": 20}'
```

### Assign External User to Task
```bash
# assignee_type: contact | partner | affiliate
curl -s -X POST "$CRM_API_URL/task_external_assignees" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"task_id": 100, "assignee_type": "contact", "assignee_id": 5}'

# List external assignees
curl -s "$CRM_API_URL/task_external_assignees?task_id=100" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET"

# Remove external assignee (use record ID from list response)
curl -s -X DELETE "$CRM_API_URL/task_external_assignee/100/3" \
  -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET"
```

### Send Notification
```bash
curl -s -X POST "$CRM_API_URL/notify" -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1, "subject": "Sprint Done", "message": "Sprint 19 completed", "channels": ["system", "email", "telegram"]}'

curl -s -X POST "$CRM_API_URL/notify_task" -H "X-API-Key: $CRM_API_KEY" -H "X-API-Secret: $CRM_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"task_id": 42, "message": "Need design approval", "type": "question", "channels": ["system", "email"]}'
```

## Field Reference

### Task Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `project_id` | int | Yes | Always `1` for MOOVIZ |
| `name` | string | Yes | Task title |
| `description` | text | No | HTML allowed |
| `priority` | int | No | 1=Low, 2=Medium, 3=High, 4=Urgent |
| `status` | int | No | 1-5 standard, 100+ custom |
| `milestone` | int | No | Milestone ID |
| `sprint_id` | int | No | 0 = backlog |
| `task_type` | string | No | task/feature/bug/story/epic/design |
| `story_points` | int | No | Estimation |
| `parent_task_id` | int | No | For subtasks |

### External Assignee Types
`contact` (client contacts) | `partner` (business partners) | `affiliate`

**Note:** `GET /task/{id}` now includes `external_assignees[]` with name/email in the response.

### Notification Types
`question` | `update` | `done` | `blocked`

### Channels
`system` (in-app) | `email` | `telegram`

## Error Codes
| HTTP | Meaning |
|------|---------|
| 401 | Bad credentials |
| 403 | Wrong scope/permission |
| 404 | Not found |
| 409 | Conflict (already assigned) |
| 429 | Rate limited — wait 60s |
| 503 | API disabled |

## SOW → Project Setup Workflow

When turning a SOW or project plan into CRM tasks:

1. **Create client** (if needed): `POST /clients`
2. **Create project**: `POST /projects` with client ID and members
3. **Create milestones**: `POST /milestones` for each deliverable phase
4. **Create sprint**: `POST /sprints` for current iteration
5. **Batch create tasks**: `POST /tasks_batch`
6. **Assign sprint**: `POST /sprint_assign`
7. **Start sprint**: `POST /sprint_start/{id}`
8. **Notify team**: `POST /notify`

## MOOVIZ Context
- **Project**: G.M. Mooviz — real-time community delivery platform
- **Stack**: React Native + Firebase/GCP
- **CRM Project ID**: 1
- **Milestones**: M0 (Setup), M1 (Backend+Auth), M2 (Delivery+GPS+Chat), M3 (Stabilization), M4 (Store Submission)
