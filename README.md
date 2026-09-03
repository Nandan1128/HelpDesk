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

### 4. API Auth & User Management Endpoints

* **Better Auth Router (`/api/auth/*`):**
  * `POST /api/auth/sign-in/email` — Authenticates credentials and issues session cookie.
  * `POST /api/auth/sign-out` — Destroys active session and clears client cookie.
  * `GET /api/auth/get-session` — Returns active session and user profile.
* **User Management Router (`/api/users`):**
  * `POST /api/users` — Creates a new user (Admin only; validates name ≥ 3 chars, email, password ≥ 8 chars).
  * `GET /api/users` — Lists active (non-deleted: `deletedAt: null`) users with search, role, status filtering, sorting, and pagination (Admin only).
  * `GET /api/users/:id` — Retrieves user details by ID (Admin only).
  * `PATCH /api/users/:id` / `PUT /api/users/:id` — Updates user profile details (`name`, `email`, `role`, `isActive`) and optionally updates password if provided (min 8 chars) (Admin only).
  * `DELETE /api/users/:id` — Soft deletes user account (`deletedAt: timestamp`, `isActive: false`), removing them from user listings and terminating active sessions; administrator accounts cannot be deleted (Admin only).
* **Inbound Email Ingestion Router (`/api/emails`):**
  * `POST /api/emails/inbound` — Ingests an incoming support email (from, to, subject, body/html, messageId, inReplyTo). Automatically resolves conversation threads via `inReplyTo` header or subject ticket tag (e.g. `[#123]`). Appends messages to existing tickets (reopening if resolved or closed), or creates a new ticket with initial status `OPEN`, category `GENERAL_QUESTION`, and priority `MEDIUM`.
  * `GET /api/emails/inbound/info` — Returns metadata and payload specification for email webhook integration.
* **Express Middleware (`backend/src/middleware/auth.middleware.ts`):**
  * `requireAuth`: Validates session cookie headers; attaches `req.user` and `req.session`.
  * `requireRole('ADMIN' | 'AGENT')`: Enforces RBAC permissions on protected endpoints.
* **Express 5 Async Error Handling:**
  * Async route handlers do not require redundant `try/catch` boilerplate for unhandled errors because Express 5 natively catches rejected promises and routes them automatically to the error-handling middleware.
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

## 📡 Frontend API & Data Fetching Guidelines (Axios & React Query)

All frontend data fetching and mutations should follow these standardized guidelines using **Axios** and **TanStack React Query**:

### 1. Centralized Axios API Client (`frontend/src/lib/api.ts`)
* Always import and use the pre-configured `api` instance from `@/lib/api` rather than native `fetch()` or raw unconfigured `axios`.
* **Automatic Cookie Transmission:** `withCredentials: true` is enabled by default so Better Auth session cookies are sent on every request.
* **Unified Error Normalization:** Axios response interceptors extract server error messages (`response.data.error` or `response.data.message`) automatically.

```typescript
import { api } from '@/lib/api';

// GET request
const { data } = await api.get<UserListResponse>('/api/users', { params });

// POST request
const { data } = await api.post('/api/tickets', newTicketData);
```

### 2. State Management with TanStack React Query
Use `@tanstack/react-query` hooks (`useQuery`, `useMutation`, `useQueryClient`) for managing all server state, caching, pagination, and optimistic updates.

#### Querying Data (`useQuery`):
```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useUsers(filters: { search?: string; role?: string; status?: string }) {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: async () => {
      const response = await api.get<UserListResponse>('/api/users', { params: filters });
      return response.data;
    },
    staleTime: 1000 * 60, // 1 minute
  });
}
```

#### Mutating Data (`useMutation`):
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketData: CreateTicketInput) => {
      const response = await api.post('/api/tickets', ticketData);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch ticket queries
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}
```

### 3. Core Principles
* **No Raw `fetch()`:** Avoid `fetch()` for backend API requests to ensure consistent auth headers, credentials, base URL proxying, and error handling.
* **Declarative Loading & Error States:** Utilize React Query's `isLoading`, `isError`, `error`, and `refetch` properties to drive shadcn skeleton and alert states.
* **Cache Invalidation:** Always invalidate related query keys after successful mutations (`POST`, `PUT`, `PATCH`, `DELETE`) to keep UI in sync.

---

## 🧪 Component Testing with React Testing Library & Vitest

The frontend includes a component testing suite powered by **Vitest**, **React Testing Library (`@testing-library/react`)**, **`@testing-library/jest-dom`**, and **`@testing-library/user-event`** in a **JSDOM** headless environment.

### 1. Executing Component Tests

Run tests directly from the root repository or within the `frontend/` directory:

```bash
# Run all frontend component tests from project root
bun run test:frontend

# Run component tests inside frontend directory
cd frontend && bun run test

# Run component tests in interactive watch mode
cd frontend && bun run test:watch

# Run a specific component test file
cd frontend && bun x vitest run src/pages/__tests__/UsersPage.test.tsx
```

---

### 2. Test File Organization & Setup

* **File Location:** Place test files adjacent to their components in a `__tests__` directory (e.g., `frontend/src/pages/__tests__/<PageName>.test.tsx` or `frontend/src/components/__tests__/<ComponentName>.test.tsx`).
* **Environment Configuration (`frontend/vite.config.ts`):**
  * `environment: 'jsdom'` — Provides the DOM API in Node.
  * `globals: true` — Enables global test methods (`describe`, `it`, `expect`, `vi`).
  * `setupFiles: ['./src/test/setup.ts']` — Automatically imports `@testing-library/jest-dom/vitest` matchers and triggers React `cleanup()` after each test.

---

### 3. Guidelines for Writing Component Tests

When writing tests for new UI pages or components, follow these standard practices:

#### A. Mocking API Requests (`api` client):
Mock API endpoints using `vi.spyOn(api, 'get')`, `vi.spyOn(api, 'post')`, etc., or `mockImplementation` for conditional dynamic responses:

```typescript
import { api } from '@/lib/api';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      users: mockUsers,
      pagination: { total: 3, page: 1, limit: 50, totalPages: 1 },
    },
  } as any);
});
```

#### B. Accessible, User-Centric Queries:
* Prioritize semantic accessibility queries: `screen.getByRole('button', { name: /save/i })`, `screen.getByRole('textbox', { name: /search/i })`.
* Use `screen.getAllByText(...)` when components render responsive variants (e.g., desktop `<Table>` alongside mobile card list `<div className="md:hidden">`).
* Avoid querying by internal CSS class names, test IDs, or DOM structure.

#### C. User Event Simulation:
* Use `userEvent.setup()` for user interactions like typing (`user.type()`), clearing inputs, or tab switching.
* Use `fireEvent.click()` when testing immediate toggle switches or table header sort clicks.

#### D. Asynchronous Assertions:
* Always wrap state transitions and API-dependent assertions inside `await waitFor(() => { ... })`.

---

### 4. Component Test Reference Pattern

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersPage } from '../UsersPage';
import { api } from '@/lib/api';

describe('UsersPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        users: [
          {
            id: '1',
            name: 'Jane Doe',
            email: 'jane@example.com',
            role: 'AGENT',
            isActive: true,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
    } as any);
  });

  it('renders user directory and responds to search', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    // Wait for initial API resolution
    await waitFor(() => {
      expect(screen.getAllByText('Jane Doe').length).toBeGreaterThanOrEqual(1);
    });

    // Simulate search input
    const searchInput = screen.getByRole('textbox', { name: /search users/i });
    await user.type(searchInput, 'Jane');

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/users', {
        params: expect.objectContaining({ search: 'Jane' }),
      });
    });
  });
});
```

---

## 🤖 E2E Testing with `playwright-tester` Subagent

This repository includes a dedicated Antigravity subagent, **[`playwright-tester`](.agents/agents/playwright-tester/agent.md)**, specialized in authoring, organizing, running, and debugging Playwright end-to-end tests against the isolated `helpdesk_test` PostgreSQL database.

---

### 1. How to Use `playwright-tester` to Write Tests

You can delegate any test-writing task directly in your chat prompt by asking `playwright-tester` to create tests for specific features or user journeys.

#### Example Prompts:
* **Authentication Flows:**
  > *"Use `playwright-tester` to write an E2E test in `e2e/auth.spec.ts` covering valid login, invalid credentials with error banner, and sign-out."*
* **Role-Based Access Control (RBAC):**
  > *"Use `playwright-tester` to write tests verifying that support agents cannot access `/users` (admin-only) and get redirected to the dashboard."*
* **Page Object Model (POM) Scaffolding:**
  > *"Use `playwright-tester` to create a `LoginPage` Page Object under `e2e/pages/LoginPage.ts` and refactor the auth tests to use it."*
* **CRUD & Ticket Workflows:**
  > *"Use `playwright-tester` to write tests for creating and filtering tickets, seeding custom test fixtures before each test."*
* **Full Verification:**
  > *"Use `playwright-tester` to write tests for the User Management page and execute `bun run test:e2e` to verify everything passes."*

---

### 2. Test Authoring Workflow Followed by the Agent

When you ask `playwright-tester` to write tests, it automatically follows these best practices:

1. **Page Object Model (POM):**
   * Encapsulates UI elements and reusable actions inside `e2e/pages/<PageName>.ts`.
2. **Database Isolation & State Seeding:**
   * Uses `seedTestDatabase()` from `e2e/support/db.ts` in `test.beforeEach()` to ensure every test runs against a clean, known state in `helpdesk_test`.
   * Leverages pre-configured credentials in `TEST_USERS` (`admin`, `agent1`, `agent2`).
3. **Resilient, User-Centric Locators:**
   * Prioritizes accessible selectors: `page.getByRole()`, `page.getByLabel()`, `page.getByPlaceholder()`, `page.getByText()`.
   * Avoids brittle XPath, deep CSS selectors, and hardcoded sleep timers (`page.waitForTimeout`).
4. **Web-First Assertions:**
   * Uses auto-waiting assertions like `await expect(locator).toBeVisible()` and `await expect(page).toHaveURL()`.
5. **Autonomous Verification:**
   * Executes the newly created tests (`bun x playwright test <file>`) and inspects traces/screenshots if any test needs adjustments.

---

### 3. Test Structure Reference

When `playwright-tester` generates a new test file in `e2e/`, it structures it as follows:

```typescript
import { test, expect } from '@playwright/test';
import { seedTestDatabase, TEST_USERS } from './support/db';

test.describe('Admin User Management', () => {
  test.beforeEach(async () => {
    // Reset and seed the isolated helpdesk_test database
    await seedTestDatabase();
  });

  test('should allow admin to sign in and view user management', async ({ page }) => {
    // 1. Navigate to login
    await page.goto('/login');

    // 2. Fill credentials using pre-seeded test admin
    await page.getByLabel('Email').fill(TEST_USERS.admin.email);
    await page.getByLabel('Password').fill(TEST_USERS.admin.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // 3. Verify successful authentication
    await expect(page).toHaveURL('/');

    // 4. Navigate to admin-only user management
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: /user management/i })).toBeVisible();
  });
});
```

Full agent configuration and extended runbooks are maintained in [`.agents/agents/playwright-tester/agent.md`](.agents/agents/playwright-tester/agent.md).

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
│   │   ├── middleware/        # Auth & RBAC Express middleware
│   │   ├── routes/            # API Route handlers (user.routes.ts)
│   │   └── index.ts           # Express server entry point (production-only rate limiting)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/            # shadcn UI primitives (Button, Card, Input, Label, Alert, Badge, Separator, Table)
│   │   │   ├── AdminRoute.tsx # Route guard enforcing ADMIN role
│   │   │   ├── ProtectedRoute.tsx # Route guard enforcing active session
│   │   │   ├── PublicRoute.tsx    # Route guard for unauthenticated users
│   │   │   ├── Layout.tsx     # App shell with Navbar & Footer
│   │   │   └── Navbar.tsx     # App header & role-based session controls
│   │   ├── pages/
│   │   │   ├── __tests__/     # React Testing Library component test suites (UsersPage.test.tsx)
│   │   │   ├── LoginPage.tsx  # shadcn-powered login form with validation
│   │   │   ├── HomePage.tsx   # Dashboard overview with live diagnostics
│   │   │   └── UsersPage.tsx  # User management view (admin only)
│   │   ├── lib/
│   │   │   ├── api.ts         # Pre-configured Axios instance with credentials & interceptors
│   │   │   ├── auth-client.ts # Better Auth client instance
│   │   │   └── utils.ts       # cn() class utility
│   │   ├── test/
│   │   │   └── setup.ts       # Vitest global test setup (jest-dom & cleanup)
│   │   ├── App.tsx            # Route definitions
│   │   ├── main.tsx           # React entry point
│   │   └── index.css          # Theme tokens & global styles
│   ├── components.json        # shadcn configuration
│   ├── vite.config.ts         # Vite configuration with Vitest jsdom test runner & API proxy
│   ├── tailwind.config.js
│   └── package.json
├── docker/
│   └── docker-compose.yml     # PostgreSQL 16 with pgvector image
├── project-scope.md           # Product requirements & specifications
├── tech-stack.md              # Technical stack definitions
└── implementation-plan.md     # Multi-phase execution roadmap
```

