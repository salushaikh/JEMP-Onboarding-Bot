# ⚔️ JOBLESS EMPIRE — BOT SETUP & HOSTING MASTER GUIDE

> **"JOBLESS DOESN'T MEAN USELESS."**  
> **"NO JOB. STILL BUILDING."**  
> **"YOUR WORK SHOULD LEAVE A TRAIL."**  
> Reference: [despair.us](https://despair.us)

Welcome! This guide is written specifically to be clear, jargon-free, and beginner-friendly. Follow it step-by-step to get your Discord Onboarding & Membership Bot live.

---

## 1. QUICK CONFUSION CLEARER (TIMELINE, SECRET & ENCRYPTION KEY)

### Q: What is `TIMELINE_SERVICE_URL` and how do I get it?
* **Plain English:** In the Jobless Empire ecosystem, there is a companion bot called the **Timeline Bot** (which logs proof-of-work achievements). `TIMELINE_SERVICE_URL` is the web address of that bot (for example `http://localhost:3001` or `https://timeline.yourserver.com`).
* **How do you get it?** You don't "get" it from any website.
* **Do you need it right now?** **NO! Leave it blank.** If this is left empty, this Onboarding bot will automatically record all timeline events, status changes, and achievements locally in its own local database (`timelineEvents` table) without needing any external server.

### Q: What is `TIMELINE_SERVICE_SECRET` and how do I get it?
* **Plain English:** It is simply a shared password between this bot and your Timeline bot so strangers can't forge timeline events.
* **How do you get it?** You invent any secret password you want (e.g. `jemp-secret-timeline-token-2026`) and write that exact same string in both bots' `.env` files. If you don't have the Timeline bot running, **leave it blank**.

### Q: What should I input for `ENCRYPTION_KEY`?
* **Plain English:** This is a 32-character secret key used by the bot to encrypt sensitive data (like emails and hashes) using AES-256 encryption.
* **What to input?** Any 32-character text string. For example:
  ```env
  ENCRYPTION_KEY=jemp_master_key_default_32_bytes_len
  ```
  *(Or click the "Generate Key" button in the web dashboard under "🚀 Beginner Setup Guide" tab).*

---

## 2. PERMANENT MEMBER ID (ADMIN SETUP & AUTO-ASSIGNMENT)

Admins have full control over the Permanent Member ID format:
1. **Precedence / Prefix:** Choose any prefix you want (e.g., `JEMP`, `JOBLESS`, `BUILDER`, `EMPIRE`). Default is `JEMP`.
2. **Consecutive Digits:** Choose between **3 to 5 digits** (e.g., 3 digits &rarr; `JEMP#001`, 4 digits &rarr; `JEMP#0001`, 5 digits &rarr; `JEMP#00001`). Default is `3`.
3. **One-Time Admin Setup:**
   - In the web dashboard, click the **Setup** button in the header or in the **System of Record (Local DB)** tab.
   - Enter your chosen prefix and number of digits, then save.
   - From that moment on, every newly onboarded member is **automatically assigned the next consecutive ID** (e.g. `JEMP#001`, `JEMP#002`, `JEMP#003`...) and bound to their Discord ID.

---

## 3. LOCAL DATABASE & LOCAL RESUME STORAGE

* **No AWS S3 or Cloudflare R2 bucket needed!**
* **Local Database:** The bot includes an embedded, atomic database (`.jemp_data.json`) that works out of the box with zero configuration.
* **Optional Local PostgreSQL:** If you have PostgreSQL installed on your computer or VPS, you can fill in the granular database credentials in `.env`:
  ```env
  DB_HOST=localhost
  DB_PORT=5432
  DB_USER=postgres
  DB_PASSWORD=your_postgres_password
  DB_NAME=jobless_empire
  DB_SSL=false
  ```
* **Resume Storage:** Resumes are validated (PDF, DOC, DOCX up to 10MB), checked for SHA-256 integrity, and saved directly inside the database record. Admins can view or download resumes anytime via `/api/resumes/:id/download` or from the **Stored Resumes** tab.

---

## 4. DISCORD DEVELOPER PORTAL SETUP (STEP-BY-STEP)

### Step 1: Create Your Discord Application
1. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications).
2. Log in with your Discord account.
3. Click the **New Application** button (top right).
4. Give it a name (e.g. `Jobless Empire Onboarding`) and click **Create**.

### Step 2: Get Your Application ID
1. In the left menu, click **General Information**.
2. Find **Application ID** and click **Copy**.
3. Paste this into your `.env` file as:
   ```env
   DISCORD_CLIENT_ID=your_copied_application_id
   ```

### Step 3: Create the Bot and Get Token
1. In the left menu, click **Bot**.
2. Click **Reset Token** (confirm with your 2FA if enabled).
3. Click **Copy** immediately.
4. Paste this into your `.env` file as:
   ```env
   DISCORD_TOKEN=your_copied_bot_token
   ```

### Step 4: Turn On Gateway Intents (CRITICAL!)
Still on the **Bot** tab, scroll down to **Privileged Gateway Intents**:
* ✅ Enable **SERVER MEMBERS INTENT** (Allows bot to see who joins and assign roles).
* ✅ Enable **MESSAGE CONTENT INTENT** (Allows bot to read verification messages).
* Click **Save Changes** at the bottom!

### Step 5: Invite Bot to Your Discord Server
1. In the left menu, click **OAuth2** &rarr; **URL Generator**.
2. Under **SCOPES**, check:
   * ✅ `bot`
   * ✅ `applications.commands`
3. Under **BOT PERMISSIONS**, select:
   * ✅ `Administrator` (easiest for testing)  
   * *(Or manually select: Manage Roles, Manage Channels, Send Messages, Attach Files, Read Message History, Use Slash Commands)*
4. Scroll to the bottom and copy the **Generated URL**.
5. Paste that URL into a new browser tab, select your Discord server, and click **Authorize**.

### Step 6: Fix Role Hierarchy in Discord (THE #1 BEGINNER TRAP!)
Discord security rules state that a bot **cannot give a role that is higher than the bot's own role**.
1. Open your Discord server.
2. Go to **Server Settings** &rarr; **Roles**.
3. Locate the role created for your bot (usually named `Jobless Empire Onboarding`).
4. **Drag and drop the bot's role so it is ABOVE the `Member` and `Unverified` roles.**
5. Save changes.

---

## 5. RUNNING LOCALLY ON WINDOWS USING DOCKER & POSTGRESQL

This is the recommended setup for running the Onboarding Bot and the shared PostgreSQL database together on your Windows laptop.

### Prerequisites for Windows
1. **Install Docker Desktop for Windows**:
   - Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop).
   - During installation, make sure **"Use WSL 2 instead of Hyper-V"** is checked (default on modern Windows 10/11).
   - Once installed, launch **Docker Desktop** and wait until the whale icon in your system tray indicates "Docker Desktop is running".

---

### Step 1: Open Terminal in the Project Folder
Open **PowerShell**, **Windows Terminal**, or **Command Prompt** (CMD) and navigate into your project directory:
```powershell
cd C:\path\to\your\jobless-empire-onboarding-bot
```

### Step 2: Configure Your `.env` File
Copy `.env.example` to `.env`:
```powershell
copy .env.example .env
```
Open `.env` in Notepad or VS Code:
```powershell
notepad .env
```
Fill in your credentials:
```env
# 1. Your Discord Bot credentials
DISCORD_TOKEN=your_bot_token_from_step_3
DISCORD_CLIENT_ID=your_application_id_from_step_2
DISCORD_GUILD_ID=your_server_id

# 2. Database Password (defaults to jemp_secret_password_2026)
DB_PASSWORD=jemp_secret_password_2026
```
*(Save and close the file).*

---

### Step 3: Launch PostgreSQL & Bot via Docker Compose
Run the following single command in PowerShell:
```powershell
docker compose up -d --build
```
> *Note: If you have an older version of Docker, use `docker-compose up -d --build`.*

**What this does automatically:**
1. Spawns an official `postgres:16-alpine` database container named `jemp-postgres`.
2. Automatically creates the database `jobless_empire` and user `postgres`.
3. Auto-executes `src/database/schema.sql` to pre-create all canonical tables (`applications`, `members`, `onboarding_sessions`, `resume_files`, `timeline_events`, `outbox_events`, `audit_log`, `settings`, sequence `jemp_member_seq`, and `uuid-ossp` extension).
4. Persists your database to a Windows volume (`jemp_postgres_data`) so data is never lost when restarting.
5. Builds and launches the Node.js application container named `jemp-onboarding-bot`, waits for Postgres to pass healthchecks, and connects over the private `jemp_shared_network`!

---

### Step 4: Verify Both Containers Are Running
Check container status:
```powershell
docker compose ps
```
You should see:
* `jemp-postgres` &rarr; `Up (healthy)` on port `0.0.0.0:5432->5432/tcp`
* `jemp-onboarding-bot` &rarr; `Up` on port `0.0.0.0:3000->3000/tcp`

View real-time logs:
```powershell
docker compose logs -f onboarding-bot
```

---

### Step 5: Access the Web Control Panel
Open your browser on Windows:
👉 **[http://localhost:3000](http://localhost:3000)**

In the dashboard:
* Navigate to **System of Record (Local DB)** tab &rarr; you will see **"Canonical PostgreSQL Database (Active Shared System)"** connected!
* You can test slash commands, inspect stored resumes, and review timeline proof-of-work events.

---

### Step 6: Connect to PostgreSQL from Windows (DBeaver / pgAdmin / VS Code)
Because port `5432` is exposed to Windows host, you can connect any database GUI on Windows:
* **Host:** `localhost` (or `127.0.0.1`)
* **Port:** `5432`
* **Database:** `jobless_empire`
* **Username:** `postgres`
* **Password:** `jemp_secret_password_2026` (or whatever you set in `.env`)

To inspect the database directly via command line:
```powershell
docker exec -it jemp-postgres psql -U postgres -d jobless_empire
```
Useful PostgreSQL commands inside psql:
* `\dt` &rarr; Lists all tables (`applications`, `members`, `timeline_events`, etc.)
* `SELECT * FROM members;`
* `SELECT * FROM timeline_events;`
* `\q` &rarr; Exit psql

---

### Step 7: Managing the Docker Containers
* **Stop everything safely:**
  ```powershell
  docker compose stop
  ```
* **Start back up:**
  ```powershell
  docker compose start
  ```
* **Restart after code changes:**
  ```powershell
  docker compose up -d --build
  ```
* **Stop and remove containers (keeps your database data intact):**
  ```powershell
  docker compose down
  ```
* **Stop and completely wipe database (clean slate):**
  ```powershell
  docker compose down -v
  ```

---

### Step 8: How Future JEMP Bots Connect to this Same Database
When you develop your next JEMP bot (Timeline Bot, Tasks Bot, etc.):
* In their `docker-compose.yml`, attach them to the existing network:
  ```yaml
  networks:
    default:
      external:
        name: jemp_shared_network
  ```
* Point their database host to `jemp-postgres` on port `5432`! Both bots will read and write to the exact same canonical database.

---

## 6. RUNNING WITHOUT DOCKER (DIRECT NODE.JS ON WINDOWS)

---

## 6. 24/7 HOSTING OPTIONS FOR BEGINNERS

If you want the bot running even when your laptop is turned off:

### Option A: Railway.app (Easiest Cloud Host)
1. Push this code to your GitHub repository.
2. Go to [railway.app](https://railway.app) and sign up with GitHub.
3. Click **New Project** &rarr; **Deploy from GitHub repo** &rarr; select your repository.
4. In the project dashboard, click **Variables** and paste the variables from your `.env` file.
5. Railway will automatically build and keep your bot online 24/7.

### Option B: Self-Host on Linux VPS (Ubuntu / Debian)
```bash
# Install Node.js 20+ and PM2 process manager
sudo apt update
sudo apt install -y nodejs npm
sudo npm install -g pm2

# Clone repo & start
git clone <your-repo-url>
cd <your-repo-folder>
npm install
cp .env.example .env
npm run build

# Start bot in background with auto-restart on crashes or reboots:
pm2 start dist/server.cjs --name "jemp-bot"
pm2 save
pm2 startup
```

---

## 7. DISCORD BOT COMMANDS CHEAT SHEET

* `/verify` — Opens the private verification and profile gateway modal.
* `/profile` — Displays your permanent JEMP# ID, status, and proof-of-work link.
* `/resume` — Submit, view, or update your active resume (stored locally in DB).
* `/onboard add <discord_id> <name> <email>` — (Admin only) Whitelist an applicant.
* `/onboard status <applicant>` — (Admin only) Check application progression.
* `/reconcile` — (Admin only) Audit role mismatches between Discord and local database.
