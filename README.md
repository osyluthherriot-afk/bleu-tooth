# 🔵 Bleu the Blue Tooth

A Discord bot companion for the **Bogsy Dice Roll** bot, designed to make TTRPG calculations faster and more fun.

---

## Features

| Command | What it does |
|---|---|
| `/double` | Doubles all individual die results from the last Bogsy roll |
| `/half` | Halves all die results (rounded down, min 1) |
| `/rollop` | Apply any math operation (`+`, `-`, `*`, `/`) to a roll total |
| `/rankup` | Increase die rank (d6→d8, d10→d12) and re-roll |
| `/gwf` | **Great Weapon Fighting** — replace any 1 or 2 with 3 |
| `/savageattack` | **Savage Attacker** — re-roll all damage dice, keep higher per die |
| `/tavernbrawler` | **Tavern Brawler** — re-roll any die showing a 1 |
| `/swordordeath` | Start a **SWORD OR DEATH** gauntlet challenge |

---

## Setup

### 1. Prerequisites
- Node.js 18+
- A Discord Application with a bot user — [Discord Developer Portal](https://discord.com/developers/applications)

### 2. Configure `.env`

Open `.env` and fill in:

```
DISCORD_TOKEN=<your bot token>
CLIENT_ID=<your application/client ID>
GUILD_ID=<your server ID for instant updates, or leave blank for global>
```

> **Where to find CLIENT_ID:** Developer Portal → Your App → General Information → Application ID
> **Where to find GUILD_ID:** Right-click your server → Copy Server ID (needs Developer Mode on)

### 3. Install dependencies

```bash
npm install
```

### 4. Deploy slash commands

```bash
npm run deploy
```

This registers all slash commands. If `GUILD_ID` is set it's instant. Globally it can take up to 1 hour.

### 5. Start the bot

```bash
npm start
# or for development with auto-restart:
npm run dev
```

---

## How Bogsy Works (Quick Reference)

Bogsy is triggered by a leading `.` on a dice string:

```
.d20 + 2d10
```

Bogsy responds with:
```
@YourName d20 + 2d10  =  1d20 {10} + 2d10 {5 9} = ✨ 24 ✨
```

Bleu reads that output to perform its calculations.

---

## Sword or Death

1. A DM runs `/swordordeath ac:18 limit:10`
2. Bleu posts a dramatic challenge embed showing the target AC
3. Players **reply** to Bleu's message with a Bogsy dice roll (e.g. `.d20+5`)
4. Bogsy posts its result as a reply in the thread
5. Bleu intercepts the Bogsy result and checks it against the AC
6. The round progresses with a visual history (`🟦🟦🟦🟥`) until the player falls below the AC or survives all rounds

---

## Permissions Required

**OAuth2 Scopes** (both required):
- `bot`
- `applications.commands`

**Bot Permissions:**
- `View Channels`
- `Send Messages`
- `Embed Links`
- `Read Message History`

Invite URL (replace `YOUR_CLIENT_ID`):
```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=84992&scope=bot+applications.commands
```

> **Permission integer breakdown:** `84992` = VIEW_CHANNEL (1024) + SEND_MESSAGES (2048) + EMBED_LINKS (16384) + READ_MESSAGE_HISTORY (65536)

---

## Deploying to Railway

1. Push this folder to a GitHub repo (Railway deploys from Git)
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. In your Railway project → **Variables**, add:
   ```
   DISCORD_TOKEN=<your token>
   CLIENT_ID=<your application ID>
   GUILD_ID=<optional, leave blank for global commands>
   ```
4. Railway will auto-detect Node.js and run `node src/index.js`
5. **Run deploy once locally** before pushing to register slash commands:
   ```bash
   npm run deploy
   ```

> **No port / web server needed** — Discord bots use WebSocket, not HTTP. Railway will keep the process alive automatically.

---

## ⚠️ Privileged Intent — Required in Discord Developer Portal

Because Bleu reads message content to parse Bogsy output, you **must** enable the **Message Content Intent** in the Discord Developer Portal:

1. Go to https://discord.com/developers/applications
2. Select your application → **Bot** tab
3. Scroll to **Privileged Gateway Intents**
4. Toggle **MESSAGE CONTENT INTENT** → ON
5. Save changes

Without this, the bot cannot read Bogsy's messages and all features will silently fail.

---

*Made for the TTRPG table — may your rolls be ever in your favour.* 🎲
