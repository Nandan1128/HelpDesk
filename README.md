# 🎫 AI-Powered Ticket Management System (HelpDesk)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg?logo=react)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-black.svg?logo=express)](https://expressjs.com/)
[![Bun](https://img.shields.io/badge/Bun-1.2-fbf0df.svg?logo=bun)](https://bun.sh/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748.svg?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg?logo=postgresql)](https://www.postgresql.org/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-AI-8E75B2.svg?logo=google)](https://aistudio.google.com/)
[![Better Auth](https://img.shields.io/badge/Better_Auth-1.7-indigo.svg)](https://better-auth.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![Railway](https://img.shields.io/badge/Deploy_on-Railway-0B0D0E.svg?logo=railway)](https://railway.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An intelligent, fullstack, multi-tenant **AI-Powered HelpDesk and Ticket Management System**. Built with a high-performance **Bun/Express** backend, modern **React 18 + shadcn/ui** frontend, **Prisma ORM with PostgreSQL**, and integrated with **Google Gemini AI** for automated ticket classification, sentiment triage, smart thread summarization, and RAG-grounded draft reply suggestions.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Quick Start Guide](#-quick-start-guide)
  - [Prerequisites](#prerequisites)
  - [1. Clone and Install Dependencies](#1-clone-and-install-dependencies)
  - [2. Start Local Database](#2-start-local-database)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
  - [4. Run Migrations & Seed Sample Data](#4-run-migrations--seed-sample-data)
  - [5. Launch Development Servers](#5-launch-development-servers)
- [Demo Credentials](#-demo-credentials)
- [Two-Way Email Support (Gmail SMTP & IMAP)](#-two-way-email-support)
- [Background Queue & AI Workers (pg-boss)](#-background-queue--ai-workers)
- [Production Deployment (Railway & Docker)](#-production-deployment-railway--docker)
- [API Reference](#-api-reference)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [License](#-license)

---

## ✨ Key Features

### 🤖 1. Google Gemini AI Engine
* **Automated Ticket Classification:** Automatically triages incoming tickets into categories (`TECHNICAL_QUESTION`, `REFUND_REQUEST`, `GENERAL_QUESTION`) and computes priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
* **AI Thread Summarization:** Condenses multi-message customer threads into concise bullet-point executive summaries for support agents.
* **RAG-Grounded Suggested Replies:** Leverages embedded Knowledge Base articles to generate accurate, context-aware draft replies with a single click.
* **Confidence Scoring & Auto-Resolution:** Automatically applies responses for standard queries when AI confidence exceeds predefined thresholds.

### 📧 2. Two-Way Smart Email Ingestion & Threading
* **Direct Gmail SMTP & IMAP Integration:** Out-of-the-box support for Gmail with 16-character Google App Passwords, custom SMTP, SendGrid, and Mailgun.
* **Silent Ticket Ingestion:** Polls your inbox and converts incoming customer emails into tickets without sending disruptive confirmation spam.
* **In-Reply-To Conversation Threading:** Uses standard RFC headers (`In-Reply-To`, `References`, subject ticket codes like `[#102]`) so outbound agent replies land cleanly inside the customer's email conversation.
* **Quote & Signature Stripping:** Intelligently strips previous email quote blocks (`On ... wrote:`, `-----Original Message-----`, `>`) before saving messages to the database.
* **Spam & Daemon Filtering:** Skips automated newsletters, mailing lists (`List-Unsubscribe`), and system bounce messages.

### ⚡ 3. Asynchronous Job Processing (`pg-boss`)
* **Background AI Workers:** Offloads heavy Gemini AI classification tasks to PostgreSQL-backed background worker threads, keeping API responses instantaneous (<50ms).
* **Job Deduplication & Resilience:** Uses `singletonKey` per ticket ID to prevent duplicate concurrent classifications, with automatic retry and exponential backoff (`retryLimit: 3`, `expireInSeconds: 120s`).

### 🔐 4. Enterprise Authentication & Role-Based Access Control (RBAC)
* **Better Auth Integration:** Secure database-backed sessions stored in PostgreSQL with HTTP-only cookies and automatic rolling token updates.
* **Role Hierarchy:**
  * **`ADMIN`:** Full administrative control (User & Agent management, Knowledge Base article curation, all ticket queues, system diagnostics).
  * **`AGENT`:** Support queue triage (View ticket details, claim assignments, update status/priority, trigger AI summaries, send email replies).
* **User Management:** Complete CRUD with soft delete (`deletedAt`), automatic unassignment of orphaned tickets, and protected administrative accounts.

### 🎨 5. Modern, Accessible UI & Design System
* **React 18 & Vite:** Fast client-side rendering with hot module reloading.
* **shadcn/ui & Tailwind CSS:** Clean, accessible component library based on Radix UI primitives.
* **TanStack Query & TanStack Table:** High-performance server-state management, client caching, multi-criteria filtering, sorting, and pagination.
* **Rich Micro-Interactions:** Quick-fill login buttons for demo accounts, real-time ticket search, badge indicators, and responsive mobile layout.

### 📦 6. Shared Monorepo Architecture (`@ticket-system/core`)
* Shared package containing Zod schemas, TypeScript interfaces, and validation utilities used across both frontend and backend for end-to-end type safety.

---

## 🏛️ System Architecture

```mermaid
graph TD
    subgraph Inbound Channels
        CustomerEmail[Customer Email] -->|IMAP Polling / SMTP| BackendAPI
        AgentWeb[Support Agent / Admin UI] -->|HTTPS REST API| BackendAPI
    end

    subgraph Backend Services [Express.js on Bun Runtime]
        BackendAPI[Express API Router]
        AuthModule[Better Auth - Session & RBAC]
        QueueService[pg-boss Background Queue]
        AIService[Google Gemini AI Engine]
        EmailService[Nodemailer / ImapFlow]

        BackendAPI --> AuthModule
        BackendAPI --> QueueService
        QueueService -->|classify-ticket worker| AIService
        BackendAPI --> EmailService
    end

    subgraph Data Layer [PostgreSQL 16]
        PG[(PostgreSQL DB)]
        PG -->|Tables| Users[Users & Sessions]
        PG -->|Tables| Tickets[Tickets & Messages]
        PG -->|Tables| KB[Knowledge Base Articles]
        PG -->|pg-boss| JobQueue[Job Queues & State]
    end

    BackendAPI -->|Prisma ORM| PG
    QueueService -->|pg Connection| PG
    EmailService -->|Outbound SMTP| CustomerEmail
```

---

## 🛠️ Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Runtime** | [Bun](https://bun.sh/) (v1.2+) | Blazing fast JavaScript/TypeScript runtime & package manager |
| **Backend API** | [Express.js](https://expressjs.com/) (v4.21+) | REST API framework with asynchronous error handling |
| **Frontend SPA** | [React 18](https://reactjs.org/) + [Vite](https://vitejs.dev/) | High-speed frontend build tool and React framework |
| **UI Components** | [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/) | Accessible, modern component primitives & utility CSS |
| **State & Data** | [TanStack React Query](https://tanstack.com/query) + [Axios](https://axios-http.com/) | Declarative server-state caching, mutations, and interceptors |
| **Database & ORM** | [PostgreSQL 16](https://www.postgresql.org/) + [Prisma ORM](https://www.prisma.io/) | Relational database with Prisma client & schema migrations |
| **AI Engine** | [Google Gemini](https://ai.google.dev/) (`@google/genai`) | LLM for ticket classification, summarization, and suggested replies |
| **Job Queue** | [pg-boss](https://github.com/timgit/pg-boss) (v12+) | PostgreSQL-based background job queue and worker system |
| **Authentication** | [Better Auth](https://better-auth.com/) (v1.7+) | Database-backed auth, session cookies, and password hashing |
| **Email Ingestion** | [ImapFlow](https://imapflow.com/) & [Nodemailer](https://nodemailer.com/) | Two-way email handling with IMAP background listener |
| **Observability** | [Sentry](https://sentry.io/) (`@sentry/node`, `@sentry/react`) | Distributed error tracking & performance monitoring |
| **Testing** | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) | Unit/component tests (JSDOM) & isolated E2E browser tests |
| **Deployment** | [Docker](https://www.docker.com/) & [Railway](https://railway.app/) | Multi-stage Dockerfile and 1-click Railway production deploy |

---

## 📁 Project Structure

```
helpdesk/
├── Dockerfile                  # Production multi-stage Bun container
├── railway.json                # Railway deployment and healthcheck configuration
├── nixpacks.toml               # Nixpacks buildpack configuration
├── RAILWAY_DEPLOYMENT.md       # Step-by-step production Railway guide
├── package.json                # Root workspaces (backend, frontend, core)
│
├── core/                       # Shared Library (@ticket-system/core)
│   ├── src/
│   │   ├── constants/          # Role, Status, Priority, Category enums
│   │   ├── schemas/            # Zod validation schemas (user, ticket, auth)
│   │   ├── types/              # Shared TypeScript definitions
│   │   └── utils/              # Text formatting, quote stripping helpers
│   └── package.json
│
├── backend/                    # Express Backend API & Services
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (User, Ticket, Message, KB)
│   │   ├── migrations/         # Prisma migration history
│   │   └── seed.ts             # Default database seeder
│   ├── scripts/
│   │   ├── start-production.ts # Production entrypoint (runs migrations & seeds admin)
│   │   ├── test-email.ts       # SMTP delivery diagnostic script
│   │   └── poll-emails.ts      # IMAP polling diagnostic script
│   ├── src/
│   │   ├── config/             # Environment validation (Zod) & Sentry setup
│   │   ├── db/                 # Prisma client singleton
│   │   ├── lib/                # Better Auth server configuration
│   │   ├── middleware/         # Auth, RBAC, and error-handling middleware
│   │   ├── routes/             # API routes (/users, /tickets, /emails, /auth)
│   │   ├── services/           # AI, Email, Queue (pg-boss), and IMAP services
│   │   └── index.ts            # Server entrypoint with static SPA serving
│   └── package.json
│
├── frontend/                   # React 18 SPA
│   ├── src/
│   │   ├── components/         # shadcn UI components, Navbar, Layout, Route Guards
│   │   ├── pages/              # LoginPage, HomePage, UsersPage, Ticket Views
│   │   ├── lib/                # Axios instance (api.ts) & Better Auth client
│   │   └── App.tsx             # React Router routing configuration
│   ├── vite.config.ts          # Vite build config with Vitest JSDOM setup
│   └── package.json
│
└── e2e/                        # Playwright End-to-End Tests
    ├── support/                # Isolated test database helpers
    └── playwright.config.ts    # Multi-server E2E orchestration
```

---

## 🚀 Quick Start Guide

### Prerequisites
* [Bun](https://bun.sh/) (v1.1+) installed
* [Docker Desktop](https://www.docker.com/) (for running PostgreSQL)
* [Node.js](https://nodejs.org/) (v20+ optional, for tooling compatibility)

---

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/Nandan1128/HelpDesk.git
cd HelpDesk

# Install dependencies across all workspaces (core, backend, frontend)
bun install
```

---

### 2. Start Local Database

Start the PostgreSQL database container (or use your own local PostgreSQL instance):

```bash
docker compose -f docker/docker-compose.yml up -d
```

---

### 3. Configure Environment Variables

Create your local `.env` file in the `backend/` directory:

```bash
cp backend/.env.example backend/.env
```

Review and adjust the following key variables in `backend/.env`:

```ini
# Server & Database
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/helpdesk?schema=public"

# Better Auth Secret (32+ characters)
BETTER_AUTH_SECRET="development-secret-key-32-chars-minimum-ticket-ai"
BETTER_AUTH_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:5173"
TRUSTED_ORIGINS="http://localhost:5173,http://localhost:5000"

# Google Gemini API Key (from https://aistudio.google.com/)
GEMINI_API_KEY="your-gemini-api-key-here"

# Email Configuration (Optional - set to "mock" for local testing)
EMAIL_PROVIDER="mock"
```

---

### 4. Run Migrations & Seed Sample Data

Push the Prisma schema to PostgreSQL and seed initial demo accounts, Knowledge Base articles, and sample tickets:

```bash
# Generate Prisma Client
bun run db:generate

# Apply migrations
bun run db:migrate

# Seed demo users, knowledge base, and real-life tickets
bun run db:seed
```

---

### 5. Launch Development Servers

Start both the backend API and frontend Vite dev server concurrently:

```bash
bun run dev
```

* **Frontend Application:** [http://localhost:5173](http://localhost:5173)
* **Backend API:** [http://localhost:5000](http://localhost:5000)
* **API Healthcheck:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 👥 Demo Credentials

The database seeder (`bun run db:seed`) creates the following demo accounts. You can also click the **Quick Fill** buttons directly on the Login page:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@ticketai.local` | `AdminPassword123!` | Full admin access (User Management, KB, all queues) |
| **Support Agent** | `sarah.agent@ticketai.local` | `AgentPassword123!` | Ticket triage, queue management, AI replies |
| **Support Agent** | `alex.agent@ticketai.local` | `AgentPassword123!` | Ticket triage, queue management, AI replies |

---

## 📧 Two-Way Email Support

TicketAI can act as a fully automated email helpdesk using your Gmail account or custom SMTP:

1. Enable **2-Step Verification** on your Google Account and create a 16-character **App Password** under Security settings.
2. Update `backend/.env`:
   ```ini
   EMAIL_PROVIDER="gmail"
   EMAIL_USER="support.yourname@gmail.com"
   EMAIL_PASS="xxxx xxxx xxxx xxxx"
   SUPPORT_EMAIL="support.yourname@gmail.com"
   IMAP_ENABLED=true
   IMAP_POLL_INTERVAL_SEC=30
   ```
3. Test your email setup with the built-in diagnostic commands:
   ```bash
   # Test outbound delivery (SMTP)
   bun run email:test recipient@example.com

   # Test inbound polling (IMAP)
   bun run email:poll
   ```

---

## ⚡ Background Queue & AI Workers

TicketAI uses **pg-boss** for non-blocking asynchronous processing:

* When a customer sends an email or submits a ticket, the API stores the ticket and enqueues a job (`classify-ticket`) in PostgreSQL within **<20ms**.
* The background worker picks up the job, retrieves the conversation history, calls **Google Gemini AI** to classify category and priority, drafts a suggested reply using the **Knowledge Base**, and updates the ticket record.
* Graceful startup and shutdown are tied to Express process signals (`SIGTERM`, `SIGINT`), guaranteeing zero dropped jobs during deployments.

---

## 🚢 Production Deployment (Railway & Docker)

### Option A: 1-Click Unified Container on Railway (Recommended)

TicketAI includes a multi-stage [Dockerfile](file:///d:/codewithmosh/AI-Powered%20Ticket%20Management%20System/Dockerfile) that compiles the React frontend and serves both API and static assets from a single container:

1. Push this repository to **GitHub**.
2. Log in to [Railway](https://railway.app), click **+ New Project** -> **Provision PostgreSQL**.
3. Click **+ Create** -> **GitHub Repo** -> select your repository.
4. Under **Variables**, add:
   ```ini
   NODE_ENV=production
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   BETTER_AUTH_SECRET=your-random-32-char-secret
   BETTER_AUTH_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
   FRONTEND_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
   TRUSTED_ORIGINS=https://${{RAILWAY_PUBLIC_DOMAIN}}
   GEMINI_API_KEY=your-gemini-api-key
   ADMIN_EMAIL=admin@yourcompany.com
   ADMIN_PASSWORD=StrongPassword123!
   ```
5. Under **Networking**, click **Generate Domain**.
6. Railway builds the container, applies migrations, seeds your initial admin account, and exposes your live application.

> For complete details and troubleshooting, see the [Railway Deployment Guide](file:///d:/codewithmosh/AI-Powered%20Ticket%20Management%20System/RAILWAY_DEPLOYMENT.md).

### Option B: Build & Run Locally with Docker

```bash
# Build production Docker image
docker build -t ticket-ai:latest .

# Run container locally
docker run -d --name ticket-ai-app -p 5000:5000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/helpdesk?schema=public" \
  -e NODE_ENV="production" \
  -e BETTER_AUTH_SECRET="your-32-character-random-secret-key" \
  -e BETTER_AUTH_URL="http://localhost:5000" \
  -e FRONTEND_URL="http://localhost:5000" \
  -e TRUSTED_ORIGINS="http://localhost:5000" \
  -e GEMINI_API_KEY="your-gemini-api-key" \
  ticket-ai:latest
```

---

## 📡 API Reference

### Authentication (`/api/auth/*`)
* `POST /api/auth/sign-in/email` — Authenticate with email/password and issue session cookie.
* `POST /api/auth/sign-out` — Terminate active session.
* `GET /api/auth/get-session` — Retrieve active session and user data.
* `GET /api/me` — Return authenticated user profile and permissions.

### Tickets (`/api/tickets`)
* `GET /api/tickets` — List tickets with search, filtering (`status`, `priority`, `category`), sorting, pagination, and KPI metrics.
* `GET /api/tickets/:id` — Retrieve ticket conversation thread, customer details, and AI suggestions.
* `POST /api/tickets` — Create a new support ticket (enqueues AI classification).
* `PATCH /api/tickets/:id` — Update ticket status, priority, or assigned agent.
* `POST /api/tickets/:id/messages` — Send agent reply (triggers outbound email delivery).

### User Management (`/api/users` - Admin Only)
* `GET /api/users` — List active support agents and administrators with filtering and search.
* `POST /api/users` — Provision new user account.
* `PATCH /api/users/:id` — Update user name, role, status, or reset password.
* `DELETE /api/users/:id` — Soft-delete user and unassign active tickets.

### System & Health (`/api/health`)
* `GET /api/health` — Returns system status, PostgreSQL connectivity, and version.

---

## 🧪 Testing & Quality Assurance

```bash
# Run all frontend component tests (Vitest + React Testing Library)
bun run test:frontend

# Run component tests in interactive watch mode
cd frontend && bun run test:watch

# Run Playwright End-to-End tests (with isolated test database)
bun run test:e2e

# Run Playwright E2E tests in interactive UI mode
bun run test:e2e:ui
```

---

## 📄 License

This project is licensed under the **MIT License**. Feel free to use and modify it for your own personal or commercial projects.
