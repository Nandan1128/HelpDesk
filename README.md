# AI-Powered Ticket Management System

An intelligent, multi-tenant Ticket Management System with AI classification, thread summarization, and RAG-grounded reply suggestions.

---

## 🛠️ Tech Stack

* **Frontend:** React 18, TypeScript, Tailwind CSS v3, **shadcn/ui** (default theme), Vite, TanStack Query, React Hook Form, Zod, Lucide React
* **Backend:** Node.js, Express.js, TypeScript, Bun Runtime
* **Database & ORM:** PostgreSQL 16 (with `pgvector` extension) & Prisma ORM
* **AI Engine:** Google Gemini (`@google/genai`)
* **Session Auth:** Better Auth / Database-backed sessions
* **Email Service:** SendGrid / Mailgun & In-app Webhook Simulator

---

## 🚀 Quick Start Guide

### Prerequisites
* [Bun](https://bun.sh/) (v1.1+)
* [Docker Desktop](https://www.docker.com/) (for PostgreSQL + `pgvector`)

---

### 1. Start the PostgreSQL + `pgvector` Database
From the root directory:
```bash
docker compose -f docker/docker-compose.yml up -d
```

### 2. Configure Environment Variables
Copy and configure environment variables in `backend/.env`:
```bash
cp backend/.env.example backend/.env
```
*(Optionally add your `GEMINI_API_KEY` for live AI generation)*

### 3. Run Database Migrations and Seed Data
```bash
# Push schema to database
bun run db:push

# Seed default Admin, Agents, Knowledge Base, and sample tickets
bun run db:seed
```

Default Admin Credentials:
* **Email:** `admin@ticketai.local`
* **Password:** `AdminPassword123!`

---

### 4. Start Development Servers
Run both backend and frontend concurrently with a single command:
```bash
bun run dev
```

* **Frontend:** http://localhost:5173
* **Backend API:** http://localhost:5000
* **Healthcheck:** http://localhost:5000/api/health

---

## 🔐 Authentication & Access Control

The application implements a robust, database-backed authentication system powered by **Better Auth** with the **Prisma PostgreSQL Adapter**.

### 1. Architecture & Session Management
* **Database-Backed Sessions:** User sessions and credentials are stored securely in PostgreSQL (`User`, `Session`, `Account`, `Verification` tables).
* **HTTP-Only Cookies:** Secure cookie-based session tokens with a 7-day expiration and automatic 1-day rolling updates.
* **CORS & Trusted Origins:** Strict cross-origin verification using configured `TRUSTED_ORIGINS`.
* **Public Sign-ups Disabled:** Self-registration is restricted (`disableSignUp: true`); new support agents are created exclusively through administrative controls.

### 2. Role-Based Access Control (RBAC)

| Role | Scope & Permissions |
|---|---|
| **ADMIN** | Full administrative privileges: User & Agent CRUD, Knowledge Base management, system health metrics, all ticket queues. |
| **AGENT** | Ticket queue operations: View ticket details, update status/priority, trigger AI summaries/replies, send customer email responses. |

### 3. Pre-Seeded Demo Credentials

Run `bun run db:seed` to populate the following default accounts (also accessible via one-click **Quick Fill** buttons on the login screen):

| Role | Email | Password |
|---|---|---|
| **Administrator** | `admin@ticketai.local` | `AdminPassword123!` |
| **Support Agent** | `sarah.agent@ticketai.local` | `AgentPassword123!` |
| **Support Agent** | `alex.agent@ticketai.local` | `AgentPassword123!` |

### 4. API Auth Endpoints & Middleware

* **Better Auth Router (`/api/auth/*`):**
  * `POST /api/auth/sign-in/email` — Authenticates credentials and issues session cookie.
  * `POST /api/auth/sign-out` — Destroys active session and clears client cookie.
  * `GET /api/auth/get-session` — Returns active session and user profile.
* **Express Middleware (`backend/src/middleware/auth.middleware.ts`):**
  * `requireAuth`: Validates session cookie headers; attaches `req.user` and `req.session`.
  * `requireRole('ADMIN' | 'AGENT')`: Enforces RBAC permissions on protected endpoints.
* **Protected Example Endpoints:**
  * `GET /api/me` — Protected endpoint returning current user and session.
  * `GET /api/admin/ping` — Admin-only endpoint requiring `ADMIN` role.

### 5. Frontend Auth & Route Protection

* **Client SDK (`frontend/src/lib/auth-client.ts`):** React integration with Better Auth (`signIn`, `signOut`, `useSession`).
* **Route Guards:**
  * `<ProtectedRoute>` — Guards dashboard/ticket views; redirects unauthenticated users to `/login`.
  * `<AdminRoute>` — Restricts admin-only views (e.g. `/users`); redirects non-admin users to `/` and unauthenticated users to `/login`.
  * `<PublicRoute>` — Prevents logged-in agents from revisiting the login page.
* **Login Form Features (`frontend/src/pages/LoginPage.tsx`):**
  * Built with **shadcn/ui** (`Card`, `Input`, `Label`, `Button`, `Alert`, `Badge`, `Separator`).
  * Real-time client-side validation using **Zod** and **React Hook Form**.
  * Dynamic red border indicators on invalid fields and styled server error banners.
  * Show/Hide password toggle.

### 6. Required Environment Variables

```env
# backend/.env (Development)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/helpdesk?schema=public"
PORT=5000
BETTER_AUTH_SECRET="your-secure-random-secret-key-min-32-chars"
BETTER_AUTH_URL="http://localhost:5000"
TRUSTED_ORIGINS="http://localhost:5173,http://localhost:5000"
ADMIN_EMAIL="admin@ticketai.local"
ADMIN_PASSWORD="AdminPassword123!"
ADMIN_NAME="System Administrator"

# backend/.env.test (Isolated Testing)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/helpdesk_test?schema=public"
PORT=5001
NODE_ENV=test
BETTER_AUTH_SECRET="test-secret-key-32-chars-minimum-ticket-ai-test"
BETTER_AUTH_URL="http://localhost:5001"
TRUSTED_ORIGINS="http://localhost:5173,http://localhost:5001,http://localhost:5000"

# frontend/.env
VITE_API_URL="/api"
```

---

## 🧪 End-to-End Testing (Playwright)

The project includes an end-to-end testing suite configured with **Playwright** and an **isolated PostgreSQL database (`helpdesk_test`)**.

### 1. Key Test Features
* **Isolated Test Database:** All tests run against `helpdesk_test` without touching or polluting development data.
* **Automatic Provisioning & Migration:** Playwright global setup automatically verifies the database exists, runs Prisma schema pushes, and seeds baseline test users.
* **Multi-Server Orchestration:** Playwright automatically starts both the test backend (port `5001`, `NODE_ENV=test`) and the frontend (port `5173` proxying to `5001`).
* **Rate Limiting Exemption:** API and auth rate limiters are active only in production, ensuring fast and unblocked test runs.

### 2. Test Commands

```bash
# Run Playwright tests headlessly
bun run test:e2e

# Run Playwright in Interactive UI mode
bun run test:e2e:ui

# Run Playwright in Debug mode with inspector
bun run test:e2e:debug

# View test report
bun run test:e2e:report

# Standalone test database management
bun run db:test:setup  # Ensure DB exists, sync schema, seed
bun run db:test:reset  # Drop, recreate, sync schema, and re-seed
bun run db:test:seed   # Re-seed test database
```

---

## 📁 Repository Structure

```
├── .env.test                  # Root test environment configuration
├── e2e/                       # Playwright test suite & support utilities
│   └── support/
│       ├── db.ts              # Test DB helpers (cleanDatabase, seedTestDatabase, TEST_USERS)
│       ├── global-setup.ts    # Playwright global lifecycle setup (DB provisioning)
│       └── global-teardown.ts # Playwright global cleanup
├── playwright.config.ts       # Playwright multi-server & browser configuration
├── backend/
│   ├── .env.test              # Backend test environment overrides
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema (User, Session, Ticket, Message, KB)
│   │   └── seed.ts            # Seeder for admin, agents, KB articles, sample tickets
│   ├── scripts/
│   │   └── setup-test-db.ts   # Automated test database creator & schema synchronizer
│   ├── src/
│   │   ├── config/env.ts      # Environment validation (loads .env.test when NODE_ENV=test)
│   │   ├── db/prisma.ts       # Prisma Client singleton
│   │   ├── lib/auth.ts        # Better Auth configuration (production-only rate limiting)
│   │   └── index.ts           # Express server entry point (production-only rate limiting)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/            # shadcn UI primitives (Button, Card, Input, Label, Alert, Badge, Separator)
│   │   │   ├── AdminRoute.tsx # Route guard enforcing ADMIN role
│   │   │   ├── ProtectedRoute.tsx # Route guard enforcing active session
│   │   │   ├── PublicRoute.tsx    # Route guard for unauthenticated users
│   │   │   ├── Layout.tsx     # App shell with Navbar & Footer
│   │   │   └── Navbar.tsx     # App header & role-based session controls
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx  # shadcn-powered login form with validation
│   │   │   ├── HomePage.tsx   # Dashboard overview with live diagnostics
│   │   │   └── UsersPage.tsx  # User management view (admin only)
│   │   ├── lib/
│   │   │   ├── auth-client.ts # Better Auth client instance
│   │   │   └── utils.ts       # cn() class utility
│   │   ├── App.tsx            # Route definitions
│   │   ├── main.tsx           # React entry point
│   │   └── index.css          # Theme tokens & global styles
│   ├── components.json        # shadcn configuration
│   ├── vite.config.ts         # Vite configuration with configurable API proxy target
│   ├── tailwind.config.js
│   └── package.json
├── docker/
│   └── docker-compose.yml     # PostgreSQL 16 with pgvector image
├── project-scope.md           # Product requirements & specifications
├── tech-stack.md              # Technical stack definitions
└── implementation-plan.md     # Multi-phase execution roadmap
```
