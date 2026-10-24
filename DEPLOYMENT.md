# Vercel & Neon DB Deployment Guide

This project consists of two components:
1. **Frontend**: Vite + React 19 (`frontend`)
2. **Backend**: Express + Prisma + PostgreSQL (`backend`)
3. **Database**: Neon DB (Serverless PostgreSQL)

---

## 1. Neon DB Setup & Migrations

### A. Create Neon Database
1. Go to [Neon.tech](https://neon.tech) and create a project (e.g. `salonos-db`).
2. Copy the connection string. It looks like:
   ```
   postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require
   ```

### B. Run Migrations & Seed
You can provide the connection string in chat and I will run it directly, or run:
```bash
cd backend

# Run Prisma migrations
npx prisma migrate deploy

# (Optional) Seed demo branches, users, tax rules, and catalogue
npm run db:seed
```

---

## 2. Deploying to Vercel

### Option A: Separate Vercel Projects (Recommended)

#### Project 1: Backend API
1. On [Vercel Dashboard](https://vercel.com), click **Add New...** -> **Project**.
2. Select your repository.
3. In **Project Settings**:
   - **Root Directory**: `backend`
   - **Framework Preset**: `Other`
   - **Build Command**: `npm run build` (runs `prisma generate`)
   - **Output Directory**: Leave empty
4. In **Environment Variables**, add:
   - `DATABASE_URL`: Your Neon DB connection string
   - `JWT_ACCESS_SECRET`: `your_secure_random_jwt_secret_here`
   - `JWT_REFRESH_SECRET`: `your_secure_random_refresh_secret_here`
   - `JWT_ACCESS_EXPIRES`: `15m`
   - `JWT_REFRESH_EXPIRES`: `7d`
   - `CORS_ORIGIN`: Your Frontend Vercel URL (e.g. `https://salonos-frontend.vercel.app`) or `*`
   - `NODE_ENV`: `production`
   - `TZ`: `Asia/Karachi`
5. Click **Deploy**. Note your Backend URL (e.g. `https://salonos-backend.vercel.app`).

#### Project 2: Frontend SPA
1. On Vercel Dashboard, click **Add New...** -> **Project**.
2. Select the same repository.
3. In **Project Settings**:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. In **Environment Variables**, add:
   - `VITE_USE_MOCK`: `false`
   - `VITE_API_URL`: `https://salonos-backend.vercel.app/api/v1` (your backend URL + `/api/v1`)
5. Click **Deploy**.
6. (After deploying, update `CORS_ORIGIN` in the backend project with this frontend URL if not using `*`).

---

## 3. Configuration Files Added
- `frontend/vercel.json`: Handles client-side routing (SPA rewrites to `/index.html`).
- `backend/vercel.json`: Serverless entry routing to `api/index.js`.
- `backend/api/index.js`: Serverless handler exporting Express app.
- `backend/package.json`: Added `build: "prisma generate"` and `postinstall: "prisma generate"`.
- `backend/src/app.js`: Root health ping `/` + dynamic CORS supporting `*.vercel.app` domains.
- `backend/prisma/schema.prisma`: Configured `binaryTargets` for Vercel/AWS Lambda serverless environments.
