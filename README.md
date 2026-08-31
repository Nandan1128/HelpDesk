# AI-Powered Ticket Management System

An intelligent, multi-tenant Ticket Management System with AI classification, thread summarization, and RAG-grounded reply suggestions.

---

## 🛠️ Tech Stack

* **Frontend:** React 18, TypeScript, Tailwind CSS, Vite, TanStack Query, Lucide React
* **Backend:** Node.js, Express.js, TypeScript, Bun Runtime
* **Database & ORM:** PostgreSQL 16 (with `pgvector` extension) & Prisma ORM
* **AI Engine:** Google Gemini (`@google/genai`)
* **Session Auth:** PostgreSQL-backed sessions (`express-session` + `connect-pg-simple`)
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
│   │   ├── App.tsx            # Diagnostics & core view
│   │   ├── main.tsx           # React entry point
│   │   └── index.css          # Tailwind CSS
│   ├── vite.config.ts         # Vite configuration with API proxy
│   ├── tailwind.config.js
│   └── package.json
├── docker/
│   └── docker-compose.yml     # PostgreSQL 16 with pgvector image
├── project-scope.md           # Product requirements & specifications
├── tech-stack.md              # Technical stack definitions
└── implementation-plan.md     # Multi-phase execution roadmap
```
