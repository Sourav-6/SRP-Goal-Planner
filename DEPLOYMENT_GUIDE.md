# 🚀 Production Deployment Guide: Supabase + Netlify

This guide walks you through deploying the **SRP Prime Wealth Financial Freedom Planner & Advisor Intelligence Desk** to the cloud with **Supabase (Managed PostgreSQL)** and **Netlify (Hosting & Serverless Functions)**.

---

## 🏗️ Architecture & Benefits

| Component | Technology | Free Tier Inclusions | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend PWA** | Netlify Edge CDN | 100 GB Bandwidth / mo | Ultra-fast global delivery of PWA UI, assets, and service worker |
| **Serverless API** | Netlify Functions (Express) | 125,000 requests / mo | Handles auth, plan calculations, multi-scenario saving & advisor intelligence |
| **Cloud Database** | Supabase (PostgreSQL 15) | 500 MB DB + 50,000 MAU | 24/7 cloud persistence, relational integrity, zero data loss |

---

## ⚡ Step 1: Create Free Supabase Database (2 Minutes)

1. **Sign Up / Log In:** Go to [supabase.com](https://supabase.com) and sign in (using GitHub or email).
2. **Create New Project:**
   - Click **"New project"**.
   - **Name:** `srp-wealth-planner`
   - **Database Password:** Choose a strong password and save it safely.
   - **Region:** Select **Mumbai (ap-south-1)** for lowest latency in India (or nearest to your clients).
   - Click **"Create new project"** (takes ~45 seconds to provision).
3. **Execute Database Schema:**
   - In your Supabase project dashboard, click **"SQL Editor"** in the left navigation bar (icon `>_`).
   - Click **"New query"**.
   - Open [supabase_setup.sql](supabase_setup.sql) from this repository, copy the **entire content**, paste it into the SQL Editor, and click **"Run"** (or press `Ctrl + Enter`).
   - You should see: `Success. No rows returned.`
   - All 4 tables (`users`, `plans`, `milestone_goals`, `plan_snapshots`), security policies, indexes, and default Advisor credentials are now initialized!
4. **Copy Your API Credentials:**
   - Go to **Project Settings** (gear icon at the bottom of the left sidebar) -> **API**.
   - Under **Project URL**, copy the **URL** (e.g. `https://xyzcompany.supabase.co`).
   - Under **Project API keys**, find the **`service_role` (secret)** key and click **Copy**.  
     *(Note: The service_role key allows the Netlify backend to securely read/write client data).*

---

## 🌐 Step 2: Deploy to Netlify (2 Minutes)

1. **Log in to Netlify:** Go to [netlify.com](https://netlify.com) and log in with GitHub.
2. **Import Repository:**
   - Click **"Add new site"** -> **"Import an existing project"**.
   - Select **GitHub** and authorize access.
   - Choose your repository: `Sourav-6/SRP-Goal-Planner`.
3. **Build Settings:**
   - Netlify will automatically detect [netlify.toml](netlify.toml).
   - **Base directory:** *(leave blank)*
   - **Build command:** *(leave blank)*
   - **Publish directory:** `.`
   - **Functions directory:** `netlify/functions`
4. **Configure Environment Variables:**
   - In the Netlify setup screen, click **"Add environment variables"** (or go to **Site configuration** -> **Environment variables**):
     - `SUPABASE_URL`: Paste your Supabase Project URL (`https://xyzcompany.supabase.co`)
     - `SUPABASE_SERVICE_ROLE_KEY`: Paste your Supabase `service_role` secret key
     - `JWT_SECRET`: Any secure random string (e.g. `srp_prime_wealth_2026_super_secret`)
5. **Deploy:**
   - Click **"Deploy site"**.
   - Within 30 seconds, Netlify will publish your site and assign a live HTTPS URL (e.g. `https://srp-goal-planner.netlify.app`)!

---

## 🔒 Step 3: Verify Your Live Cloud Deployment

1. **Open Your Netlify App URL:**
   - Visit `https://your-site-name.netlify.app`.
2. **Test Client Sign Up & Multi-Scenario Save:**
   - On the onboarding tab, enter any 10-digit mobile number and a 4-digit PIN.
   - Adjust retirement age, SIP, or milestone goals.
   - Check the top header: you will see the **"🟢 Synced"** cloud pill.
   - Refresh your browser or open it on another device (phone/tablet): your plan loads instantly from Supabase!
3. **Test Advisor Intelligence Desk:**
   - In the header, click the secret icon next to the theme toggle (`#btn-advisor-desk`).
   - Enter Phone: `9999999999` and PIN: `7777`.
   - The Institutional Advisor Intelligence Desk will load live analytics, client distribution metrics, and the full client roster directly from Supabase!

---

## 💻 Local Development with Supabase (Optional)

If you want your local `npm start` server to connect to Supabase instead of local SQLite:

1. Create a `.env` file in the root folder:
   ```env
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   JWT_SECRET=srp_prime_wealth_2026_super_secret
   ```
2. Start the development server:
   ```bash
   npm start
   ```
3. The console will display:
   ```
   ✔ Connected to Supabase Cloud Database: your-project-ref.supabase.co
   💾 Database Engine: Supabase Cloud (PostgreSQL)
   ```
4. If the `.env` file does not contain Supabase credentials, the app automatically runs on the zero-config local SQLite engine (`better-sqlite3`).
