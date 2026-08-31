# Technology Stack Specification

This document details the selected technology stack and architectural choices for the **AI-Powered Ticket Management System**.

---

## 1. Overview & Architecture

The system follows a decoupled Client-Server architecture:
* **Frontend:** Single-page application (SPA) built with **React**, **TypeScript**, and styled with **Tailwind CSS**.
* **Backend:** REST API service built with **Node.js**, **Express**, and **TypeScript**.
* **Database & ORM:** **PostgreSQL** (with `pgvector` for semantic search) managed via **Prisma ORM**.
* **AI Engine:** **Google Gemini** for ticket classification, thread summarization, and RAG-grounded reply suggestions.
* **Email Provider:** **SendGrid** or **Mailgun** (inbound webhook processing and outbound email dispatch).
* **Authentication:** **Database-backed Sessions** stored in PostgreSQL.
* **Deployment & Containerization:** **Docker** and **Railway** (cloud hosting).

---

## 2. Technology Choices & Responsibilities

### 2.1 Frontend
* **Core Framework:** React 18 (Vite-powered SPA) with TypeScript
* **Styling & UI Components:** Tailwind CSS v3 with **shadcn/ui** (default theme, neutral base color, CSS variables, `@/components/ui/` primitives)
* **UI Primitives:** Card, Input, Label, Button, Alert, Badge, Separator, and Lucide React icons
* **State Management & Data Fetching:** TanStack Query (React Query) for server state caching, pagination, and polling
* **Form Validation:** React Hook Form + Zod resolvers
* **Routing:** React Router (v6+)

### 2.2 Backend
* **Runtime & Framework:** Node.js + Express.js with TypeScript
* **API Paradigm:** RESTful JSON API
* **Email Webhooks:** Express body parsers for multipart/urlencoded payloads from SendGrid/Mailgun
* **Validation:** Zod for runtime schema validation on API request payloads and AI structured outputs
* **Error Handling & Logging:** Centralized Express error-handling middleware and structured logger (e.g., Winston or Pino)

### 2.3 Database & ORM
* **Database:** PostgreSQL (v15+)
* **Vector Extension:** `pgvector` extension in PostgreSQL to store and query Knowledge Base document embeddings directly without an external vector database
* **ORM:** Prisma ORM
  * Declarative data models and automated migrations
  * Type-safe queries across Users, Tickets, Messages, Knowledge Base, and Sessions
  * Automated database seeding script for the initial **Admin** user

### 2.4 AI & LLM (Google Gemini)
* **SDK:** Google Gen AI SDK (`@google/genai` or `@google/generative-ai`)
* **Core Models:**
  * **Gemini 1.5 Flash / Pro:** Used for:
    * **Ticket Classification:** Analyzing incoming emails to assign exactly one category (`general question`, `technical question`, `refund request`) and priority.
    * **Conversation Summarization:** Condensing long customer threads into brief bullet points.
    * **RAG-Grounded Suggested Replies:** Generating context-aware drafts based on relevant Knowledge Base articles.
  * **Text Embedding Model:** `text-embedding-004` for vectorizing Knowledge Base articles and customer queries.

### 2.5 Email Ingestion & Dispatch (SendGrid / Mailgun)
* **Inbound (Email-to-Ticket):**
  * Webhook listener (`POST /api/webhooks/email`) receives parsed emails.
  * Extracts sender, recipient, subject, body text, and threading headers (`Message-ID`, `In-Reply-To`, `References`).
  * Creates a new ticket or appends a new message to an existing ticket.
  
* **Outbound (Agent-to-Customer):**
  * Dispatches replies via SendGrid/Mailgun SMTP or REST API.
  * Appends reference identifiers (`[#TICKET-<id>]` and headers) to maintain email client threading.

### 2.6 Authentication & Authorization (Database Sessions)
* **Session Management:** `express-session` with a PostgreSQL session store (e.g., `connect-pg-simple` or Prisma session store).
* **Password Hashing:** `bcryptjs` / `argon2` for secure credential storage.
* **Access Control:**
  * **Admin:** Full access (User management, Knowledge Base CRUD, metrics, all ticket queues).
  * **Agent:** Ticket queue management, detail viewing, status changes, sending replies.
  * Initial seed script provides the first default Admin credentials on deployment.

### 2.7 Deployment & Infrastructure
* **Containerization:** Docker multi-stage builds:
  * Dockerfile for Backend (Node.js/Express)
  * Dockerfile for Frontend (Nginx serving static React build)
  * `docker-compose.yml` for local development (PostgreSQL with `pgvector`, Backend, Frontend)
* **Cloud Hosting:** **Railway** for production hosting:
  * Managed PostgreSQL service with `pgvector`
  * Deployed Backend web service and Frontend static service
  * Environment variable management (Database URLs, Gemini API keys, Email credentials)

### 2.8 Testing, Test Database Isolation & Rate Limiting Strategy
* **End-to-End Testing Framework:** **Playwright** (`@playwright/test`)
  * Multi-server orchestration: Automatically manages isolated backend (port `5001` with `NODE_ENV=test`) and frontend (port `5173` proxying to test backend).
  * Global setup & teardown lifecycle: Automated database creation, schema sync via Prisma, and test data seeding.
* **Test Database Isolation:**
  * Dedicated PostgreSQL database: `helpdesk_test` (completely isolated from development and production databases).
  * Environment configuration: `.env.test` loaded dynamically in test environments.
  * DB utilities: Automated reset and seeding scripts (`setup-test-db.ts`, `e2e/support/db.ts`).
* **Rate Limiting Policy:**
  * Active **strictly in production** (`NODE_ENV === 'production'`).
  * Express API limiters and Better Auth authentication rate limits are bypassed during development and automated E2E testing to ensure fast, unblocked execution.

---

## 3. High-Level Data Flow

```
+------------------+         Inbound Email Webhook          +-------------------------+
|  Customer Email  | -------------------------------------> |  Node.js / Express API  |
+------------------+                                        +-------------------------+
                                                                     |       |
                                  ┌──────────────────────────────────┘       |
                                  ▼                                          ▼
                       +----------------------+                   +--------------------+
                       |  Google Gemini AI    |                   | PostgreSQL DB      |
                       |  - Classification    |                   | - Users & Sessions |
                       |  - Embeddings / RAG  |                   | - Tickets & Threads|
                       |  - Suggested Replies |                   | - KB & pgvector    |
                       +----------------------+                   +--------------------+
                                  │                                          │
                                  └──────────────────┬───────────────────────┘
                                                     ▼
                                      +-----------------------------+
                                      |  React + Tailwind Frontend  |
                                      |  (Agent / Admin Dashboard)  |
                                      +-----------------------------+
                                                     │
                                                     │ Outbound Email (SendGrid / Mailgun)
                                                     ▼
                                            +------------------+
                                            |  Customer Inbox  |
                                            +------------------+
```
