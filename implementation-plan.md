# Implementation Plan

## Phase 1: Project Setup

- [x] Initialize monorepo structure (`/backend`, `/frontend`, `/docker`)
- [x] Set up Express server with TypeScript, Bun, and health check API
- [x] Set up React app with TypeScript, Tailwind CSS v3, and Vite
- [x] Install and configure **shadcn/ui** with default theme tokens, CSS variables, and components (`Card`, `Input`, `Label`, `Button`, `Alert`, `Badge`, `Separator`)
- [x] Set up PostgreSQL database with Prisma ORM and pgvector
- [x] Create database schema, migrations, and seed script
- [x] Configure Playwright E2E testing framework with multi-server orchestration
- [x] Set up isolated test database (`helpdesk_test`) with automated provisioning, schema sync, and test seeding
- [x] Configure production-only rate limiting policy across Express API and Better Auth

## Phase 2: Authentication & Design System

- [x] Create shadcn-powered login page with Zod validation and reactive error states
- [x] Configure Better Auth client and session integration
- [x] Implement session-based authentication middleware & route protection
- [x] Add global WebKit/Chrome autofill style normalization
- [x] Adopt shadcn default theme tokens consistently across Layout, Navbar, and Home pages

## Phase 3: User Management

- [x] Create user management page (admin only)
- [ ] Implement create agent API endpoint
- [x] Implement list users API endpoint
- [ ] Implement edit user API endpoint
- [ ] Implement delete user API endpoint
- [ ] Add role-based access control (admin vs agent)

## Phase 4: Ticket CRUD

- [ ] Implement create ticket API endpoint
- [ ] Implement list tickets API endpoint (with filtering by status and category, sorting)
- [ ] Implement get ticket API endpoint
- [ ] Implement update ticket API endpoint (change status, assign agent)
- [ ] Create ticket list page with filtering and sorting
- [ ] Create ticket detail page

## Phase 5: AI Features

- [ ] Set up Google Gemini API integration (`@google/genai`)
- [ ] Implement auto-classification endpoint (categorize incoming tickets)
- [ ] Implement AI summary endpoint (generate ticket summary)
- [ ] Implement AI suggested reply endpoint with RAG
- [ ] Build knowledge base structure and seed with initial content

- [ ] Integrate AI features into ticket detail page UI

## Phase 6: Email Integration

- [ ] Set up email provider (SendGrid/Mailgun)
- [ ] Implement inbound email webhook to create tickets
- [ ] Implement outbound email sending when an agent replies
- [ ] Handle email threading (replies linked to existing tickets)

## Phase 7: Dashboard

- [ ] Create dashboard page with ticket overview stats (open, resolved, closed counts)
- [ ] Add tickets by category breakdown
- [ ] Add recent tickets list
- [ ] Add quick filters to navigate to filtered ticket list

## Phase 8: Polish & Deployment

- [ ] Add input validation and error handling across all endpoints
- [ ] Add loading states and error states on the frontend
- [ ] Write Dockerfile for server and client
- [ ] Set up Docker Compose for local development
- [ ] Write deployment configuration