# GTA Connected Admin Script

Public admin/moderation script for GTA Connected ( specifically GTA IV). Focused on clear permissions, auditable actions, and simple storage with optional encryption-at-rest.

## Highlights

- Player management: kick, ban, tempban, unban, toggle trainers/weapons.
- Roles & levels: 2 = admin, 1 = moderator, 0 = player (configurable in `config.json`).
- Bans: permanent/temporary with required reasons, auto-expiry handling.
- IP bans: `banip`/`unbanip` plus `lastbanip` to review recent IP actions from `log.json`.
- List privacy: moderators see Name + ID, admins/console can also see IPs.
- Logging: only key admin/mod commands are logged to `log.json` with timestamp, actor, target, and reason.
- Optional encryption-at-rest for `players.json` via `config.json` - `encryption` (please use this, i can not stress enough about it!).

## Authentication

- Token-based admin/mod:On join, the token is checked to grant level/role.

## Commands

### Everyone
- `/emotes` - Show available chat emoticons.

### Moderators (Level 1)
- `/adminhelp` - List available commands and required levels.
- `/adminstatus` - Show your role/level.
- `/listplayers` - See connected players. Level 1 shows `Name [ID]`; Level 2/console also shows IP.
- `/kick [ID:<n>]/name/ip/token` - Kick a player.
- `/tempban [ID:<n>]/name/ip/token <minutes> <reason>` - Temporary ban.
- `/unban name/ip/token <reason>` - Remove a ban (reason required).
- Chat: `/msay`, `/modsay`, `/m` - Moderator broadcast.
- Utilities: `/a <message>`, `/announce <message>`, `/scripts`, `/blockscript <script>`, `/disableweapons`, `/trainers` (GTA IV), `/ip`, `/banlist`, `/reloadplayers`, `/reloadbans`.

### Admins (Level 2) and Console
- `/ban [ID:<n>]/name/ip/token <reason>` - Permanent ban (reason required).
- `/banip <ip> <reason>` - Ban an IP (reason required).
- `/unbanip <ip> <reason>` - Unban an IP (reason required).
- `/lastbanip [ip|count]` - Show recent IP ban/unban entries from `log.json`.
- `/makeadmin <username>` - Grant admin.
- `/makemod <username>` - Grant moderator.
- `/demote <username> [reason]` - Remove admin/mod. Only console can demote an admin; in-game admins can demote moderators.
- Owner chat: `/wsay`, `/ownersay`, `/w`.

## Logging (log.json)

- Audited commands: `kick`, `scripts`, `ban`, `unban`, `blockscript`, `makeadmin`, `makemod`, `trainers`, `ip`, `geoip`, `reloadbans`, `reloadplayers`, `tempban`, `listplayers`, `disableweapons`, `wsay`, `banlist`, `banip`, `unbanip`, `demote`.
- Each entry includes: `timestamp`, `actor`, `action`, `target`, `reason`, `context`, `details`.
- IPs are masked in logs except for `banip`/`unbanip` where they are kept to aid unbanning.

## Storage & Encryption

- Player data is stored in `players.json`.
- Optional encryption-at-rest can fully protect the file using **AES-256-GCM**.
    - Add this in `config.json`:
        ```json
        "encryption": { "enabled": true, "secret": "<your-random-32-char-secret>", "version": 2 }
        ```
    - Use a proper **32+ char random secret** grab one [here](https://www.random.org/strings/?num=1&len=32&digits=on&upperalpha=on&loweralpha=on&unique=on&format=html&rnd=new).
    - If the secret is missing/too short, the file saves as plaintext.
- The system uses **AES-256-GCM + HMAC-SHA512 key/IV derivation** to keep `players.json` private.


## Configuration

- `config.json` contains:
	- `commandLevels` - map commands to required levels (2 admin, 1 moderator, 0 player).
	- `blockedScripts` - per-game blocked client scripts list.
	- `geoip` - GeoIP database paths (if used in your environment).
	- `encryption` - optional encrypted-at-rest settings for `players.json`.

## Console Help

- Run `consolehelp` in server console to see command summaries and usage.

## Credits

- Based on concepts from the original v-admin script by [VortrexFTW](https://github.com/VortrexFTW).
- Enhancements by [SirCryptic](https://github.com/SirCryptic) (missing features from my private version with good reason).
