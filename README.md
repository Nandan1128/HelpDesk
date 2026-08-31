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
  * `<PublicRoute>` — Prevents logged-in agents from revisiting the login page.
* **Login Form Features (`frontend/src/pages/LoginPage.tsx`):**
  * Built with **shadcn/ui** (`Card`, `Input`, `Label`, `Button`, `Alert`, `Badge`, `Separator`).
  * Real-time client-side validation using **Zod** and **React Hook Form**.
  * Dynamic red border indicators on invalid fields and styled server error banners.
  * Show/Hide password toggle.

### 6. Required Environment Variables

```env
# backend/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ticket_system?schema=public"
PORT=5000
BETTER_AUTH_SECRET="your-secure-random-secret-key-min-32-chars"
BETTER_AUTH_URL="http://localhost:5000"
TRUSTED_ORIGINS="http://localhost:5173,http://localhost:5000"
ADMIN_EMAIL="admin@ticketai.local"
ADMIN_PASSWORD="AdminPassword123!"
ADMIN_NAME="System Administrator"

# frontend/.env
VITE_API_URL="http://localhost:5000"
```

---

## 📁 Repository Structure

```
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema (User, Session, Ticket, Message, KB)
│   │   └── seed.ts            # Seeder for admin, agents, KB articles, sample tickets
│   ├── src/
│   │   ├── config/env.ts      # Environment validation with Zod
│   │   ├── db/prisma.ts       # Prisma Client singleton
│   │   └── index.ts           # Express server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/            # shadcn UI primitives (Button, Card, Input, Label, Alert, Badge, Separator)
│   │   │   ├── Layout.tsx     # App shell with Navbar & Footer
│   │   │   └── Navbar.tsx     # App header & session controls
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx  # shadcn-powered login form with validation
│   │   │   └── HomePage.tsx   # Dashboard overview with live diagnostics
│   │   ├── lib/
│   │   │   ├── auth-client.ts # Better Auth client instance
│   │   │   └── utils.ts       # cn() class utility
│   │   ├── App.tsx            # Route definitions
│   │   ├── main.tsx           # React entry point
│   │   └── index.css          # Theme tokens & global styles
│   ├── components.json        # shadcn configuration
│   ├── vite.config.ts         # Vite configuration with API proxy
│   ├── tailwind.config.js
│   └── package.json
├── docker/
│   └── docker-compose.yml     # PostgreSQL 16 with pgvector image
├── project-scope.md           # Product requirements & specifications
├── tech-stack.md              # Technical stack definitions
└── implementation-plan.md     # Multi-phase execution roadmap
```
