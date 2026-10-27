# WorkSync — Backend API

REST API for Work, a multi-workspace project and task management application built with **Node.js, Express, MongoDB, and Mongoose**.

## Features

- User registration, login, logout, profile, and refresh-token rotation
- JWT access/refresh tokens in HTTP-only cookies; refresh sessions stored in MongoDB
- Workspaces, membership management, and role-based permissions
- Projects, project memberships, and project archiving
- Tasks: create, list/filter/paginate, read, edit, update status, and soft-delete
- Task activity history
- In-app notifications and read status
- Workspace dashboard counts
- Request validation with Zod and security headers with Helmet

## Tech stack

Node.js (ES modules), Express, MongoDB, Mongoose, Zod, JSON Web Tokens, Argon2, cookie-parser, Helmet, Nodemailer.
Tested with Vitest and Supertest

## Folder structure

```text
src/
├── config/         # Database and email setup
├── controller/     # HTTP request handlers and business rules
├── middleware/     # JWT cookie authentication
├── models/         # Mongoose models
├── routes/         # Express route definitions
├── schema/         # Zod request validation
├── utils/          # Task activity and notification helpers
└── server.js       # Express entry point
```

## Getting started

### Requirements

- A compatible Node.js LTS release
- MongoDB database (local or hosted)
- npm
- SMTP credentials if you want registration emails

### Installation

From the backend project root (the folder containing `package.json`):

```bash
npm install
```

Create `.env` in the backend root:

```dotenv
NODE_ENV=development
PORT=3000
MONGO_URL=mongodb://127.0.0.1:27017/WorkSync
ACCESS_TOKEN_SECRET=replace-with-a-long-random-secret
REFRESH_TOKEN_SECRET=replace-with-a-different-long-random-secret
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-email-app-password
```

Never commit `.env`, credentials, or real JWT secrets. If using Gmail SMTP, use an appropriate Google app password where supported.

Start the backend with your `package.json` development script (if configured), for example:

```bash
npm run dev
```

Alternatively, run the entry point directly:

```bash
node src/server.js
```

Default server address: `http://localhost:3000` (unless `PORT` is set differently). `GET /` currently responds with `Hello, World!`.

## Authentication

Authentication uses the `accessToken` and `refreshToken` cookies. Protected routes use the `authenticateUser` middleware, which validates the access token and loads the active user. The browser must send credentials on authenticated requests.

Frontend request example:

```javascript
const response = await fetch("http://localhost:3000/api/users/me", {
  credentials: "include",
});
const result = await response.json();
```

**Cross-origin frontend note:** The current `src/server.js` does **not** configure CORS. If your React dev server runs on a different origin (such as `http://localhost:5173`), configure Express CORS with the exact frontend origin and `credentials: true`, before connecting the frontend. Do not use a wildcard origin with credentials.

## API reference

All paths below are relative to `http://localhost:3000`. Replace placeholders with real MongoDB ObjectIds. Except for registration, login, and refresh, assume routes require authentication unless the source specifies otherwise. Logout is mounted without the authentication middleware but uses the refresh cookie.

### Authentication — `/api/users`

| Method | Path                  | Description                      |
| ------ | --------------------- | -------------------------------- |
| POST   | `/api/users/register` | Register a user                  |
| POST   | `/api/users/login`    | Log in                           |
| POST   | `/api/users/logout`   | Log out / revoke refresh session |
| POST   | `/api/users/refresh`  | Refresh access/refresh cookies   |
| GET    | `/api/users/me`       | Current user profile             |

Registration body:

```json
{
  "name": "Example User",
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

Login body:

```json
{ "email": "user@example.com", "password": "StrongPassword123!" }
```

### Workspaces — `/api/workspaces`

| Method | Path                                           | Description                                                 |
| ------ | ---------------------------------------------- | ----------------------------------------------------------- |
| POST   | `/api/workspaces/create-workspace`             | Create workspace                                            |
| GET    | `/api/workspaces/my-workspaces`                | List joined workspaces                                      |
| DELETE | `/api/workspaces/:workspaceId`                 | Archive workspace                                           |
| POST   | `/api/workspaces/:workspaceId/members`         | Add workspace member                                        |
| GET    | `/api/workspaces/:workspaceId/members`         | List workspace members                                      |
| DELETE | `/api/workspaces/:workspaceId/members/:userId` | Suspend member access and remove active project memberships |

Create workspace body:

```json
{ "name": "Acme Team", "slug": "acme-team", "description": "Team workspace" }
```

Add member body (user must already exist):

```json
{ "email": "employee@example.com", "role": "employee" }
```

### Projects and tasks — `/api/projects`

**Important:** The project router is mounted at `/api/projects`, and its paths start with `/:workspaceId/projects`. The repeated word `projects` in the complete URL is intentional in the current source.

| Method | Path                                                                    | Description             |
| ------ | ----------------------------------------------------------------------- | ----------------------- |
| POST   | `/api/projects/:workspaceId/projects`                                   | Create project          |
| GET    | `/api/projects/:workspaceId/projects`                                   | List workspace projects |
| DELETE | `/api/projects/:workspaceId/projects/:projectId`                        | Archive project         |
| POST   | `/api/projects/:workspaceId/projects/:projectId/members`                | Add project member      |
| GET    | `/api/projects/:workspaceId/projects/:projectId/members`                | List project members    |
| DELETE | `/api/projects/:workspaceId/projects/:projectId/members/:userId`        | Remove project member   |
| POST   | `/api/projects/:workspaceId/projects/:projectId/tasks`                  | Create task             |
| GET    | `/api/projects/:workspaceId/projects/:projectId/tasks`                  | List project tasks      |
| GET    | `/api/projects/:workspaceId/projects/:projectId/tasks/:taskId`          | Get task details        |
| PATCH  | `/api/projects/:workspaceId/projects/:projectId/tasks/:taskId`          | Edit task details       |
| PATCH  | `/api/projects/:workspaceId/projects/:projectId/tasks/:taskId/status`   | Update task status      |
| DELETE | `/api/projects/:workspaceId/projects/:projectId/tasks/:taskId`          | Soft-delete task        |
| GET    | `/api/projects/:workspaceId/projects/:projectId/tasks/:taskId/activity` | Task activity history   |

Create project body:

```json
{
  "name": "Website Redesign",
  "description": "Refresh the website",
  "priority": "high",
  "startDate": "2026-11-01T00:00:00.000Z",
  "dueDate": "2026-12-01T00:00:00.000Z"
}
```

Add project member body:

```json
{ "userId": "REPLACE_WITH_USER_OBJECT_ID", "role": "member" }
```

Create task body:

```json
{
  "title": "Build login page",
  "description": "Implement the responsive login screen",
  "assignedTo": null,
  "priority": "high",
  "dueDate": "2026-11-15T00:00:00.000Z"
}
```

Task list supports `page`, `limit`, `status`, and `priority` query parameters. Example:

```text
GET /api/projects/:workspaceId/projects/:projectId/tasks?page=1&limit=10&status=todo&priority=high
```

Update task status body:

```json
{ "status": "in-progress" }
```

Valid task statuses: `todo`, `in-progress`, `in-review`, `completed`. Valid priorities: `low`, `medium`, `high`, `urgent`.

### Notifications — `/api/notifications`

| Method | Path                                      | Description                                                            |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------- |
| GET    | `/api/notifications`                      | Current user's notifications (`page`, `limit`, optional `workspaceId`) |
| PATCH  | `/api/notifications/read-all`             | Mark all current user's notifications read                             |
| PATCH  | `/api/notifications/:notificationId/read` | Mark one notification read                                             |

### Dashboard — `/api/dashboard`

| Method | Path                                     | Description                 |
| ------ | ---------------------------------------- | --------------------------- |
| GET    | `/api/dashboard/workspaces/:workspaceId` | Workspace dashboard summary |

## Authorization model

- Workspace memberships use roles: `owner`, `admin`, `manager`, `employee`.
- Project memberships use roles: `lead`, `member`.
- Managers/admins/owners can manage tasks according to the controller checks.
- Employees can access their own assigned tasks only where membership checks permit.
- Removing a workspace member suspends workspace access and marks active project memberships removed.
- Workspace and project deletion currently archive records; task deletion uses `deletedAt`.

For full permission behavior, consult the controller source; these are a summary, not a substitute for authorization tests.

## Testing recommendation

Recommended tools:

- **Vitest** — unit tests for Zod schemas, helpers, and business rules
- **Supertest** — Express HTTP integration tests
- **React Testing Library** — frontend component tests (later)
- **Playwright** — end-to-end browser tests (later)

Prioritize tests for authentication, cross-workspace isolation, role permissions, task assignment, deleted/archived resources, and refresh-token rotation. Use a dedicated test MongoDB database and isolate test data. No automated test suite is included in the uploaded `src/` snapshot.

## Frontend integration notes

- The current route prefix is `/api`, **not** `/api/v1`.
- The current project URLs begin `/api/projects/:workspaceId/projects/...`.
- Use `credentials: "include"` in browser `fetch` or `withCredentials: true` in Axios.
- Configure explicit-origin credentialed CORS on Express before connecting React across origins.
- Handle `401` responses by refreshing the session once and retrying the request, then redirecting to login if refresh fails.
- Do not store access or refresh JWTs in localStorage; the backend uses HTTP-only cookies.

## Before production

- Add centralized Express error-handling middleware (the uploaded `server.js` does not currently register one).
- Add CORS for trusted frontend origins.
- Add request logging, rate limiting, and secure environment configuration.
- Verify archived projects are consistently excluded from task/dashboard queries.
- Ensure task activity and notifications are reliable if secondary database writes fail.
- Review concurrent membership changes and use transactions where your MongoDB deployment supports them.
- Add automated tests and CI checks.

## License

Add your chosen license before publishing or distributing the repository.
