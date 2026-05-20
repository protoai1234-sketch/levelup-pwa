# LevelUp PWA

A personal goal-tracking Progressive Web App. Add it to your iPhone or Android home screen and share the link with friends to compete on the leaderboard.

## Tech Stack
- React + Vite
- Tailwind CSS
- localStorage (all personal data — goals, habits, todos, planner)
- Supabase (leaderboard only — display name + consistency score)
- vite-plugin-pwa (service worker, manifest, offline support)

---

## 1 · Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New project**, name it `levelup`, pick a region, set a password.
3. In the left sidebar, open **SQL Editor** and run:

```sql
-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

create table if not exists leaderboard (
  id uuid primary key default uuid_generate_v4(),
  user_id text unique not null,
  display_name text not null,
  consistency_score float default 0,
  updated_at timestamp default now()
);

-- Allow anyone to read; only the row owner can upsert their own row
alter table leaderboard enable row level security;

create policy "Public read"
  on leaderboard for select using (true);

create policy "Upsert own row"
  on leaderboard for insert with check (true);

create policy "Update own row"
  on leaderboard for update using (true);
```

4. Go to **Project Settings → API**.
   - Copy **Project URL** → this is `VITE_SUPABASE_URL`
   - Copy **anon / public** key → this is `VITE_SUPABASE_ANON_KEY`

---

## 2 · Deploy to Vercel

### Option A — GitHub (recommended)

1. Push this folder to a new GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "initial"
   gh repo create levelup-pwa --public --source=. --push
   ```

2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.

3. In the **Environment Variables** section add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key

4. Click **Deploy**. Vercel auto-detects Vite and uses `npm run build` / `dist`.

5. Copy the `*.vercel.app` URL and share it with friends.

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod
```

---

## 3 · Add to Home Screen

### iPhone (Safari)
1. Open the Vercel URL in Safari.
2. Tap the **Share** button (box with arrow).
3. Tap **Add to Home Screen** → **Add**.

### Android (Chrome)
1. Open the URL in Chrome.
2. Tap **⋮** menu → **Add to Home screen** → **Add**.

---

## 4 · Local development

```bash
npm install
npm run dev       # http://localhost:5173
```

To test the PWA / service worker:
```bash
npm run build && npm run preview
```

---

## Privacy

Only your **display name** and **consistency score** (0–100%) are ever sent to Supabase.
All goals, habits, todos, planner items, and point history stay on **your device only** in localStorage.
