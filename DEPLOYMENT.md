# RecipeSnap — Production Deployment Guide

## What you need before starting

| Requirement | Where to get it | Cost |
|-------------|-----------------|------|
| **Anthropic API key** | [console.anthropic.com](https://console.anthropic.com) | ~$0.003/extraction |
| **Railway account** (recommended) | [railway.app](https://railway.app) | From $5/month |
| **Domain name** (optional) | Namecheap, Google Domains, Cloudflare | ~$10–15/year |

---

## Option A — Railway (Recommended, ~10 minutes)

Railway auto-detects the `Dockerfile` and handles everything.

### 1. Push your code to GitHub

```bash
cd recipe-snap
git init
git add .
git commit -m "Initial commit"
# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/recipe-snap.git
git push -u origin main
```

### 2. Create a Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Select **Deploy from GitHub repo** → choose `recipe-snap`
3. Railway will detect the `Dockerfile` automatically

### 3. Add a persistent volume (for the database)

1. In your Railway project → click your service → **Volumes** tab
2. Add volume: mount path `/app/data`, size `1 GB`

### 4. Set environment variables

In Railway → your service → **Variables** tab, add:

```
ANTHROPIC_API_KEY   = sk-ant-xxxxxxxxxxxxx
SESSION_SECRET      = (generate with: openssl rand -base64 32)
NODE_ENV            = production
DATA_DIR            = /app/data
```

### 5. Deploy

Click **Deploy** — Railway builds the Docker image and launches it.
Your app will be live at `https://recipe-snap-xxx.railway.app`.

### 6. Custom domain (optional)

Railway → your service → **Settings** → **Domains** → add your domain.
Then point your domain's DNS CNAME to the Railway-provided URL.

---

## Option B — Render (Free tier available)

Render uses the `render.yaml` file already included in the repo.

### Steps

1. Push code to GitHub (same as Railway step 1)
2. Go to [render.com](https://render.com) → **New** → **Blueprint**
3. Connect your repo — Render reads `render.yaml` automatically
4. Set your secret environment variables in the Render dashboard:
   - `ANTHROPIC_API_KEY` = your key
   - `SESSION_SECRET` = random string
5. Click **Apply** — Render builds and deploys

> ⚠️ **Free tier note**: Render's free web services spin down after 15 minutes of inactivity. The first request after a sleep takes ~30 seconds. Upgrade to a Starter instance ($7/month) to avoid this.

---

## Option C — VPS (DigitalOcean / Hetzner / Linode)

For maximum control. A $6/month Hetzner CX22 (2 vCPU, 4GB RAM) is more than enough.

```bash
# On your VPS
curl -fsSL https://get.docker.com | sh
git clone https://github.com/YOUR_USERNAME/recipe-snap.git
cd recipe-snap
cp .env.example .env
nano .env   # Fill in ANTHROPIC_API_KEY and SESSION_SECRET

# Build and run
docker build -t recipesnap .
docker run -d \
  --name recipesnap \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  -v /opt/recipesnap-data:/app/data \
  recipesnap

# (Optional) NGINX reverse proxy + Let's Encrypt SSL
apt install nginx certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

---

## Environment variables reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | Powers AI extraction (image, URL, text) |
| `SESSION_SECRET` | ✅ Yes | Encrypts user sessions. Use 32+ random chars |
| `NODE_ENV` | ✅ Yes | Set to `production` |
| `DATA_DIR` | ✅ Yes | Where SQLite database file is stored |
| `PORT` | No | Server port. Defaults to 3000 |
| `TRUST_PROXY` | No | Set `false` to disable if not behind a proxy |

---

## Anthropic API cost estimate

| Action | Model | Cost |
|--------|-------|------|
| Extract recipe from photo | Claude Haiku | ~$0.003 |
| Extract recipe from URL (no AI) | JSON-LD fast path | $0.00 |
| Extract recipe from URL (AI fallback) | Claude Haiku | ~$0.002 |
| Extract from Instagram caption | Claude Haiku | ~$0.001 |

At 100 extractions/day, expect **~$9/month** in API costs.

---

## After deployment: checklist

- [ ] Visit `/api/health` — should return `{"status":"ok"}`
- [ ] Register a test account
- [ ] Upload a recipe photo — verify extraction works
- [ ] Try a BBC Good Food URL
- [ ] Paste an Instagram caption
- [ ] Check the profile page shows the correct plan
- [ ] Test on mobile

---

## Upgrading the database (optional)

For larger scale (1000+ users), swap SQLite for PostgreSQL:

1. Provision a PostgreSQL database on Railway (add a service → PostgreSQL)
2. Replace `better-sqlite3` + `drizzle-orm/better-sqlite3` with `pg` + `drizzle-orm/node-postgres`
3. Update `server/db.ts` to use `DATABASE_URL` from env

For an MVP with under 1,000 users, SQLite on a persistent volume is perfectly fine.
