# Deploying PM-SETU Saathi on Render

_Last updated: 2026-10-13_

One Render **web service** (Express serves `/api/*` and the built SPA) plus one Render **Postgres** database. Everything is declared in `render.yaml`, so the whole stack is created from the repo in one Blueprint step.

## Where the database lives

| Option | Verdict |
|---|---|
| **Render Postgres (recommended)** | Managed, same region as the service, connection string injected as `DATABASE_URL`, daily backups on paid plans. Prisma models are provider-neutral; the Postgres schema is derived from `schema.prisma` at build time. |
| SQLite on a Render disk | Works, but needs a paid instance with a persistent disk, single-writer, no backups, and the file is lost if the disk is detached. Keep SQLite for laptops only. |
| External Postgres (Neon, Supabase, RDS) | Fine if you already run one: paste its URL as `DATABASE_URL` and delete the `databases:` block from `render.yaml`. |

Plans in `render.yaml`: web service **Starter** (does not spin down; free instances sleep after 15 minutes idle), database **basic-256mb** (the smallest plan that does not expire; free Postgres is deleted after 30 days). Both can be changed in the dashboard.

## One-time setup

### 1. Push the repo to GitHub

The app folder is already a git repository with an initial commit. Create an empty private repo on GitHub (for example `edityeah/pmsetu-saathi`), then:

```bash
cd /Users/adityeasofficemac/Downloads/PM-SETU/pmsetu-app
git remote add origin git@github-edityeah:edityeah/pmsetu-saathi.git
git push -u origin main
```

### 2. Create the Blueprint

Render dashboard → **New +** → **Blueprint** → connect the repo → **Apply**. Render reads `render.yaml` and creates:

- web service `pmsetu-saathi` (Node 22, Singapore, Starter)
- database `pmsetu-db` (Postgres 16, Singapore)
- env vars, including generated `JWT_SECRET` and `ADMIN_TOKEN`

### 3. Set the secrets

In the service's **Environment** tab set `OPENAI_API_KEY` (Saathi chat, voice, OCR and RAG). The UI, data and workflows run without it; only Saathi replies need it. Optional: `ANAM_API_KEY` (avatar video), `ZEP_API_KEY` (memory), `CARTESIA_API_KEY` (Indian-language TTS).

### 4. First deploy

The build installs both workspaces, derives `prisma/schema.postgres.prisma`, generates the Prisma client and builds the SPA. On start, `start.cjs` runs `prisma db push` against the database and launches Express. Health check: `GET /api/health`.

### 5. Seed the demo data (once)

Copy `ADMIN_TOKEN` from the Environment tab, then:

```bash
curl -X POST https://pmsetu-saathi.onrender.com/api/admin/seed -H "x-admin-token: <ADMIN_TOKEN>"
```

Poll until the job finishes (about 10 seconds on Postgres):

```bash
curl https://pmsetu-saathi.onrender.com/api/admin/status -H "x-admin-token: <ADMIN_TOKEN>"
```

Optional, with an OpenAI key set, embed the knowledge base so Saathi cites the guidelines:

```bash
curl -X POST https://pmsetu-saathi.onrender.com/api/admin/rag -H "x-admin-token: <ADMIN_TOKEN>"
```

Sign in at `https://pmsetu-saathi.onrender.com` with the credentials in `docs/demo-credentials.md`.

## Day to day

- **Deploys**: every push to `main` redeploys (`autoDeploy: true`). Schema changes are applied by `db push` at start; the seed is never re-run automatically.
- **Re-seed** (resets all demo data): `POST /api/admin/seed` as above.
- **Refresh from the workbooks**: run `python3 server/scripts/convert-xlsx.py` locally, commit the JSON in `server/data/delhi/`, push, then re-seed.
- **Logs**: Render → service → Logs. The seed job's output is also returned by `/api/admin/status`.
- **Custom domain**: service → Settings → Custom Domains; Render issues the certificate.

## Local development is unchanged

Laptops keep SQLite (`DATABASE_URL="file:./data/pmsetu.db"`). The Postgres schema file is generated and gitignored; never edit it by hand.
