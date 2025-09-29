# Full-stack Coding Assessment Platform

A full-stack platform for creating coding problems, assigning them to candidates, running code against testcases via Judge0, and evaluating submissions.

## Tech Stack
- Backend: Node.js, Express, Prisma (PostgreSQL)
- Frontend: React (Vite)
- Code Runner: Judge0 API
- AI Testcase Generation: Google Gemini

## Monorepo Layout
`
backend/
frontend/
`

## Prerequisites
- Node.js >= 18
- PostgreSQL
- Judge0 API (local or hosted)
- Google Gemini API key

## Environment Variables

### Backend (ackend/.env)
`env
DATABASE_URL="postgresql://user:password@localhost:5432/code_assessment?schema=public"
JWT_SECRET="replace-with-strong-secret"
PORT=4000
JUDGE0_URL="http://localhost:2358"
# Optional if your Judge0 requires auth
JUDGE0_KEY=""
JUDGE0_HOST=""

# AI (Gemini)
GOOGLE_API_KEY="your-gemini-api-key"
`

Example committed file: ackend/.env.example

### Frontend (rontend/.env)
`env
VITE_API_BASE_URL="http://localhost:4000"
`

Example committed file: rontend/.env.example

## First-time Setup
1. Install dependencies
`ash
cd backend && npm install
cd ../frontend && npm install
`
2. Generate and apply database
`ash
cd ../backend
npm run prisma:generate
npm run prisma:migrate
`
3. (Optional) Seed data
`ash
npm run seed
`
4. Ensure Judge0 is available
- Default URL is http://localhost:2358. Update JUDGE0_URL if different.

## Running Locally
- Backend
`ash
cd backend
npm run dev
`
- Frontend
`ash
cd frontend
npm run dev
`
Open the app at the URL Vite prints (typically http://localhost:5173).

## Admin & Roles
- Roles: dmin, ecruiter, candidate
- Admin/recruiter can create problems, assign to users, view submissions
- Candidates can solve assigned problems and submit

## Security Notes
- Do not commit real .env files. Only commit .env.example.
- JWT and database URL are required at startup.
- The Google API key was externalized to GOOGLE_API_KEY. Rotate any previously exposed keys.

## Scripts
- Backend
  - 
pm run dev  start API
  - 
pm run prisma:generate  generate Prisma client
  - 
pm run prisma:migrate  apply dev migrations
  - 
pm run prisma:studio  open Prisma Studio
  - 
pm run seed  seed initial data (if implemented)
- Frontend
  - 
pm run dev  start Vite dev server
  - 
pm run build  production build
  - 
pm run preview  preview build

## Deployment
- Set all backend env vars on your hosting provider (no secrets in code)
- Set VITE_API_BASE_URL for the frontend build
- Ensure network access to your database and Judge0 endpoint

---
Maintained by Hiwot-Tad.
