# 🚀 Deploying TicketAI to Railway

This guide walks you through deploying the **AI-Powered Ticket Management System** to [Railway](https://railway.app) in production with PostgreSQL, pg-boss background queues, Better Auth authentication, Google Gemini AI integration, and the React frontend.

---

## 🏗️ Architecture Options

You can deploy TicketAI using either of the following two deployment architectures:

| Architecture | Description | Best For | Services on Railway |
| :--- | :--- | :--- | :--- |
| **Option A: Unified Fullstack Container** *(Recommended)* | Single Docker container running Express backend, serving Vite React SPA, handling background pg-boss queues, and connecting to PostgreSQL. | Simplest setup, lower cost, no CORS/cookie domain issues. | **1 Web Service + 1 PostgreSQL** |
| **Option B: Multi-Service Architecture** | Backend API deployed as one container/service, and Frontend deployed as a separate static web service (or Nginx container). | Independent scaling of frontend and backend. | **2 Web Services + 1 PostgreSQL** |

---

## 📦 Option A: 1-Click Unified Fullstack Deployment (Recommended)

### Step 1: Push Code to GitHub
Ensure your latest changes are pushed to your GitHub repository:
```bash
git add .
git commit -m "feat: prepare app for Railway deployment"
git push origin main
```

### Step 2: Create a Railway Project & Add PostgreSQL
1. Log in to [Railway](https://railway.app).
2. Click **+ New Project** -> **Provision PostgreSQL**.
3. Railway will create an isolated PostgreSQL database with persistent storage.

### Step 3: Deploy the Web Service from GitHub
1. Inside your Railway project canvas, click **+ Create** -> **GitHub Repo**.
2. Select your `AI-Powered Ticket Management System` repository.
3. Railway will automatically detect the root [Dockerfile](file:///d:/codewithmosh/AI-Powered%20Ticket%20Management%20System/Dockerfile) and [railway.json](file:///d:/codewithmosh/AI-Powered%20Ticket%20Management%20System/railway.json).

### Step 4: Configure Environment Variables
In your web service on Railway, navigate to the **Variables** tab and click **New Variable** (or **RAW Editor**). Copy and configure the following variables:

```ini
# Core Configuration
NODE_ENV=production
PORT=5000

# Database (Reference the provisioned PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Authentication & Domain (Better Auth)
# Generate a 32+ char key with: openssl rand -base64 32
BETTER_AUTH_SECRET=your-secure-random-32-char-secret-key-here
BETTER_AUTH_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
FRONTEND_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
TRUSTED_ORIGINS=https://${{RAILWAY_PUBLIC_DOMAIN}}

# Initial Admin Account (Created automatically on initial database migration)
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=YourStrongAdminPassword123!
ADMIN_NAME=System Administrator

# Google Gemini AI
GEMINI_API_KEY=AIzaSy...your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash

# Email Provider Configuration (Optional)
EMAIL_PROVIDER=mock
SUPPORT_EMAIL=support@yourcompany.com
IMAP_ENABLED=false
```

### Step 5: Generate a Public Domain
1. In the Web Service settings, go to **Settings** -> **Networking** -> **Public Networking**.
2. Click **Generate Domain** (e.g. `ticket-system-production.up.railway.app`).
3. If using a custom domain (e.g., `tickets.yourcompany.com`), add it under Custom Domains and update `BETTER_AUTH_URL`, `FRONTEND_URL`, and `TRUSTED_ORIGINS` accordingly.

### Step 6: Verify Deployment & Sign In
1. Watch the **Deployments** tab. The automated startup script will:
   - Apply Prisma migrations (`prisma migrate deploy`).
   - Create the initial Admin user and foundational Knowledge Base articles.
   - Start the Express API server and pg-boss background queue workers.
2. Navigate to your Railway URL (e.g. `https://ticket-system-production.up.railway.app/login`).
3. Sign in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` configured in Step 4.

---

## 💻 CLI Deployment Alternative (Railway CLI)

If you prefer deploying via terminal:

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login to Railway
railway login

# 3. Link or create project
railway init

# 4. Add PostgreSQL database
railway add -d postgres

# 5. Set environment variables
railway variables --set NODE_ENV=production
railway variables --set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
railway variables --set GEMINI_API_KEY="your-gemini-api-key"
railway variables --set ADMIN_EMAIL="admin@yourcompany.com"
railway variables --set ADMIN_PASSWORD="SecurePassword123!"

# 6. Deploy
railway up
```

---

## 🔧 Option B: Multi-Service Deployment (Separate Backend + Frontend)

If you want separate services for Backend and Frontend:

### 1. Backend Service
- **Root Directory**: `/backend` (or use `backend/Dockerfile`)
- **DockerfilePath**: `backend/Dockerfile`
- **Environment Variables**:
  - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
  - `BETTER_AUTH_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}`
  - `FRONTEND_URL=https://your-frontend-domain.railway.app`
  - `TRUSTED_ORIGINS=https://your-frontend-domain.railway.app`
  - `BETTER_AUTH_SECRET`, `GEMINI_API_KEY`, etc.

### 2. Frontend Service
- **Root Directory**: `/frontend` (or use `frontend/Dockerfile`)
- **DockerfilePath**: `frontend/Dockerfile`
- **Build Arguments / Environment Variables**:
  - `VITE_API_URL=https://your-backend-domain.railway.app`

---

## 📋 Complete Environment Variables Reference

| Variable | Required | Default / Example | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Enables production security, rate limiting, and optimizations. |
| `DATABASE_URL` | **Yes** | `${{Postgres.DATABASE_URL}}` | PostgreSQL connection string with schema. |
| `BETTER_AUTH_SECRET`| **Yes** | 32+ char random string | Secret key for signing session tokens and cookies. |
| `BETTER_AUTH_URL` | **Yes** | `https://${{RAILWAY_PUBLIC_DOMAIN}}` | Public canonical base URL for auth redirects. |
| `FRONTEND_URL` | **Yes** | `https://${{RAILWAY_PUBLIC_DOMAIN}}` | Public frontend origin. |
| `TRUSTED_ORIGINS` | **Yes** | `https://${{RAILWAY_PUBLIC_DOMAIN}}` | Comma-delimited list of allowed CORS origins. |
| `GEMINI_API_KEY` | **Yes** | `AIzaSy...` | Google Gemini API key for ticket classification & suggested replies. |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model for AI classification & embeddings. |
| `ADMIN_EMAIL` | **Yes** | `admin@yourcompany.com` | Email for default admin user created on first run. |
| `ADMIN_PASSWORD` | **Yes** | `AdminPassword123!` | Strong password for default admin user. |
| `ADMIN_NAME` | No | `System Administrator` | Display name for default admin user. |
| `EMAIL_PROVIDER` | No | `mock` / `gmail` / `smtp` | Outbound email provider. |
| `EMAIL_USER` | No | `support@yourcompany.com` | SMTP or Gmail account email. |
| `EMAIL_PASS` | No | `app-password` | SMTP password or Google App Password (16 chars). |
| `IMAP_ENABLED` | No | `false` | Set `true` to poll inbox and ingest emails into tickets. |
| `SENTRY_DSN` | No | `https://...` | Sentry DSN for backend and client error tracking. |

---

## 🩺 Healthchecks & Zero-Downtime Deploys

- **Endpoint**: `/api/health`
- **Response**: `{ status: "healthy", database: "connected", timestamp: "..." }`
- **Railway Integration**: Automatically configured in `railway.json` with a 120-second timeout to allow migrations to complete before traffic shifts to the new container.

---

## 🛠️ Troubleshooting

### 1. Database connection failed on startup
- Make sure your service is linked to the PostgreSQL database in Railway canvas or has `DATABASE_URL=${{Postgres.DATABASE_URL}}` set.

### 2. Authentication cookies not saving
- Ensure `BETTER_AUTH_URL`, `FRONTEND_URL`, and `TRUSTED_ORIGINS` use `https://` with the exact Railway domain without trailing slashes.
- Better Auth uses secure `SameSite=Lax` cookies over HTTPS.

### 3. Rate limiting blocking requests
- Express rate limiting is set to 300 requests per 15 minutes per IP in production. `app.set('trust proxy', 1)` is already configured for Railway reverse proxy IP forwarding.

### 4. Running one-off tasks (Manual Seed / Migration)
- You can open the **Railway Service Shell** or run via Railway CLI:
```bash
railway run bun prisma/seed.ts
```
