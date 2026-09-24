# 🔵 Bleu the Blue Tooth

A Discord bot companion for the **Bogsy Dice Roll** bot, designed to make TTRPG calculations faster and more fun.

---

## Features

### Right-Click Context Menus (Apps)
Right-click (or long-press) any Bogsy message → **Apps**:
- 🔵 **Math Operation** — Pop-up modal to apply `+`, `-`, `*`, or `/` (e.g. `+5`, `*2`)
- 🔵 **Double Roll** — Double all die results
- 🔵 **Half Roll** — Halve all die results (min 1)
- 🔵 **Rank Up & Re-roll** — Promote die rank (d6→d8, d10→d12) and re-roll
- ⚔️ **Great Weapon Fighting** — Replace any 1 or 2 with 3
- 🪓 **Savage Attacker** — Re-roll all damage dice, keep higher per die
- 🍺 **Tavern Brawler** — Re-roll any die showing a 1

### Slash Commands
| Command | Options | Description |
|---|---|---|
| `/double` | `message_id` (opt) | Doubles die results |
| `/half` | `message_id` (opt) | Halves die results |
| `/rollop` | `operation`, `value`, `message_id` (opt) | Apply `+`, `-`, `*`, `/` to roll total |
| `/rankup` | `message_id` (opt) | Increase die rank and re-roll |
| `/gwf` | `message_id` (opt) | Great Weapon Fighting |
| `/savageattack` | `message_id` (opt) | Savage Attacker |
| `/tavernbrawler` | `message_id` (opt) | Tavern Brawler |
| `/swordordeath` | `ac`, `limit` (opt), `quote` (opt) | **Admin only:** Start Sword or Death gauntlet |
| `/tr` | `message` | **Admin only:** Say a message as Bleu anonymously |

### Auto-Delete
- Bleu automatically deletes any message from **Bogsy** (`812347275698634762`) whenever it mentions Bleu (e.g., when Bleu uses `/tr` to roll).

---

## Permissions Required

**OAuth2 Scopes:**
- `bot`
- `applications.commands`

**Bot Permissions:**
- View Channels
- Send Messages
- Manage Messages *(needed for auto-deleting Bogsy mentions)*
- Embed Links
- Read Message History

**Invite URL:**
```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=93184&scope=bot+applications.commands
```

> **Permission Integer:** `93184` (includes `Manage Messages` for auto-deletion)

---

## Railway Setup

1. Push to GitHub
2. In Railway project → **Variables**, set:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `GUILD_ID` *(optional, for instant server command registration)*
3. Make sure **Message Content Intent** is enabled in the Discord Developer Portal under the **Bot** tab.
