# LevelUp PWA

A personal goal-tracking Progressive Web App with email/password auth and full cloud sync. Add it to your iPhone or Android home screen and share the link with friends to compete on the leaderboard.

## Tech Stack
- React + Vite
- Tailwind CSS
- Supabase Auth + Postgres (all personal data stored per-user in the cloud)
- vite-plugin-pwa (service worker, manifest, offline support)

---

## ⚠️ REQUIRED: Disable Email Confirmations

**Without this step users cannot log in after signup.**

1. Go to your [Supabase Dashboard](https://supabase.com)
2. Open your project → **Authentication** → **Settings**
3. Scroll to **Email Auth** and **uncheck "Enable email confirmations"**
4. Click **Save**

The app auto-signs users in immediately after signup — email confirmation would block this flow.

---

## 1 · Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New project**, name it `levelup`, pick a region, set a password.
3. In the left sidebar, open **SQL Editor** and run the full schema (see `supabase/migrations/`).

4. Go to **Project Settings → API**.
   - Copy **Project URL** → this is `VITE_SUPABASE_URL`
   - Copy **anon / public** key → this is `VITE_SUPABASE_ANON_KEY`

---

## 2 · Set up the Claude API key (for AI Goal Assistant)

The Claude API key is stored as a **Supabase secret** and only ever used inside the Edge Function — it is never exposed to the browser or bundled in the frontend.

1. Go to [console.anthropic.com](https://console.anthropic.com), sign in, and create an API key.
2. Set it as a Supabase secret (run this once in your terminal):
   ```bash
   supabase secrets set CLAUDE_API_KEY=sk-ant-your-key-here
   ```
3. Deploy the Edge Function:
   ```bash
   supabase functions deploy goal-chat --no-verify-jwt
   ```

---

## 3 · Deploy to Vercel

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
   - `VITE_VAPID_PUBLIC_KEY` = your VAPID public key (for push notifications)

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

## 4 · Add to Home Screen

Push notifications require the app to be installed as a PWA (iOS 16.4+).

### iPhone (Safari)
1. Open the Vercel URL in Safari.
2. Tap the **Share** button (box with arrow).
3. Tap **Add to Home Screen** → **Add**.

### Android (Chrome)
1. Open the URL in Chrome.
2. Tap **⋮** menu → **Add to Home screen** → **Add**.

---

## 5 · Local development

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

All personal data (goals, todos, planner items, point history, etc.) is stored in your Supabase project under your user account with row-level security — no one else can read your data. Only your **display name** and **consistency score** are shared on the public leaderboard.
