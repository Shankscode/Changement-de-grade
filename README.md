# brawl-grade-bot

Discord bot that assigns grade roles based on Brawl Stars highest trophy record.

---

## Launch with Docker (recommended)

### 1. Configure environment

```bash
cp .env.example .env
```

Fill in the required values in `.env`:

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application ID from Discord Developer Portal |
| `DISCORD_GUILD_ID` | Your server's ID |
| `VERIFY_CHANNEL_ID` | Channel where `/verify` is allowed (default: `523634607845801995`) |
| `DISCORD_LOG_CHANNEL_ID` | Optional — channel for bot logs |
| `RNT_API_KEY` | Optional — only needed for restricted API endpoints |
| `LOG_LEVEL` | `info` recommended |
| `REFRESH_INTERVAL_HOURS` | Auto-refresh interval in hours, `0` to disable (default: `24`) |

> `DATABASE_URL` is automatically set by Docker Compose — leave the default value from `.env.example`.

### 2. Start everything

```bash
docker compose up --build
```

This starts three services in order:
1. **postgres** — waits until healthy
2. **migrate** — applies database migrations, then exits
3. **bot** — starts once migrations succeed

### 3. Deploy slash commands (first run only)

```bash
docker compose run --rm bot node dist/app/registerCommands.js
```

---

## Local development

### Requirements

- Node.js 22+
- Docker (for PostgreSQL)

### 1. Clone and install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in all values (including `DATABASE_URL` for local use).

### 3. Start PostgreSQL only

```bash
docker compose up postgres -d
```

### 4. Apply database migrations

```bash
npm run db:migrate
```

### 5. Deploy slash commands (first run only)

```bash
npm run commands:deploy
```

### 6. Start the bot

```bash
npm run dev
```

---

## Discord Developer Portal configuration

1. Go to https://discord.com/developers/applications
2. Create a new application
3. Under **Bot**, enable:
   - `SERVER MEMBERS INTENT` (required to fetch members)
4. Under **OAuth2 → URL Generator**, select:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Manage Roles`, `Send Messages`, `Read Message History`, `Use Slash Commands`
5. Use the generated URL to invite the bot to your server
6. Make sure the bot's role is **above** all grade roles in the server hierarchy

---

## Configure grade roles

Before users can get grade roles, you must configure them:

```
/admin set-grade-role threshold:10000 role:@YourRole10k
/admin set-grade-role threshold:20000 role:@YourRole20k
...
/admin set-grade-role threshold:150000 role:@YourRole150k
```

View current configuration:
```
/admin list-grade-roles
```

---

## `/verify` flow

1. User runs `/verify` in <#523634607845801995>
2. A modal opens asking for their Brawl Stars tag (e.g. `#ABC123`)
3. The bot fetches their profile and picks a random brawler they own
4. The user is told: *"Set [Brawler] as your favourite brawler in Brawl Stars, then click the button"*
5. The user sets the brawler in-game and clicks **"I've set my favourite brawler"**
6. The bot re-fetches the profile and checks the favourite brawler
7. If it matches:
   - The account is linked in the database
   - The correct grade role is assigned (based on highest trophies)
   - If the tag was previously linked to another Discord account, it is **automatically transferred** (old link deactivated, old member's role removed)
8. The challenge expires after **15 minutes**

---

## Trophy thresholds

| Trophies | Grade |
|---|---|
| < 10 000 | No role |
| 10 000 | Grade 10 000 |
| 20 000 | Grade 20 000 |
| … | … |
| 150 000 | Grade 150 000 (max) |

**Grade never decreases:** once a player reaches a threshold, they keep it even if their current trophies drop.

---

## Admin commands

| Command | Description |
|---|---|
| `/admin check-user @member` | View linked account details |
| `/admin force-refresh @member` | Re-fetch profile and reapply role |
| `/admin unlink @member` | Deactivate link and remove role |
| `/admin refresh-all [dry_run]` | Batch refresh all members (dry run by default) |
| `/admin set-grade-role threshold role` | Configure a grade role |
| `/admin list-grade-roles` | List configured grade roles |

---

## Tests

```bash
npm test
```

---

## Architecture

```
src/
  app/              # Entry points (bot start, command deploy, env)
  discord/          # Discord layer (commands, events, interactions, logs)
  modules/          # Business logic (brawlstars, grades, verification, roles, audit)
  db/               # Drizzle schema, client, migrations
  shared/           # Logger, errors, result type, time utils
tests/
  unit/             # Vitest unit tests
  integration/      # (future) integration tests against real DB
```

The Discord layer only calls services — no business logic in command handlers.
Services do not depend on Discord.js (except `RoleAssignmentService` and `DiscordLogService`).
