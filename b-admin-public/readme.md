# GTA Connected Admin Script

This is a complete rewrite of the [Vortex v-admin script](https://github.com/VortrexFTW/v-essentials/tree/master/v-admin) for GTA Connected (GTA IV), designed for public use with enhanced features and a streamlined codebase. Certain features from my private version, such as making other players dance or killing them, have been stripped to focus on core administrative functionality. This script provides robust server management tools for administrators and moderators, including player management, bans, and chat enhancements.

## Features

- **Player Management**: Manage players with commands to kick, ban, tempban, unban, and toggle trainers or weapons.
- **Admin Roles**: Supports admin and moderator roles with configurable permission levels.
- **Ban System**: Permanent and temporary bans with reasons and expiration times, stored in `players.json`.
- **Chat Enhancements**: Emote support in chat messages (e.g., `:)` becomes 😊) for both client and server.
- **Script Blocking**: Block specific game scripts on GTA Connected to prevent unwanted behavior.
- **Admin Logging**: Logs all admin actions to `log.json` for accountability.
- **Configuration**: Customizable settings via `config.json`, including command levels and blocked scripts.

## Commands

### General Commands
- `/emotes`: Displays a list of available emoticons for use in chat messages (e.g., `:)` for 😊, `:D` for 😃).
- `/listplayers`: Lists all connected players with their IDs, names, and IP addresses (Admin Level 1).

### Admin/Mod Commands (In-Game)
- `/adminhelp`: Lists all available admin commands with their required permission levels (Admin Level 1).
- `/adminstatus`: Displays the admin's name, role, and permission level (Admin Level 1).
- `/kick [ID:<number>]/name/ip/token`: Kicks a player from the server (Admin Level 1).
- `/ban [ID:<number>]/name/ip/token [reason]`: Permanently bans a player (Admin Level 1).
- `/tempban [ID:<number>]/name/ip/token <minutes> [reason]`: Temporarily bans a player for a specified duration (Admin Level 1).
- `/unban name/ip/token`: Removes a ban by name, IP, or token (Admin Level 1).
- `/banlist`: Lists all active bans with details (Admin Level 1).
- `/msay <message>`, `/modsay <message>`, `/m <message>`: Broadcasts a message as a moderator (Admin Level 1, Moderator role).
- `/wsay <message>`, `/ownersay <message>`, `/w <message>`: Broadcasts a message as an owner (Admin Level 2).
- `/a <message>`: Sends a message to all admins (Admin Level 1).
- `/announce <message>`: Broadcasts a message to all players (Admin Level 1).
- `/makeadmin <username>`: Grants admin status to a player (Admin Level 2).
- `/makemod <username>`: Grants moderator status to a player (Admin Level 2).
- `/demote  [ID:<number>]/name/ip`: removes admin/mod status of a player.
- `/trainers name`: Toggles trainers for a player (GTA IV only, Admin Level 1).
- `/disableweapons [ID:<number>]/name/ip/token`: Toggles weapons for a player (GTA Connected only, Admin Level 1).
- `/ip [ID:<number>]/name/ip/token`: Retrieves a player's IP address (Admin Level 1).
- `/scripts [ID:<number>]/name/ip/token`: Requests active game scripts for a player (GTA Connected only, Admin Level 1).
- `/blockscript <script>`: Blocks a specific game script (GTA Connected only, Admin Level 1).
- `/reloadadmins`: Reloads admin permissions from `players.json` (Admin Level 1).
- `/reloadbans`: Reloads bans from `players.json` (Admin Level 1).
- `/reloadplayers`: Reloads all player data from `players.json` (Admin Level 1).

### Console-Only Commands
- `consolehelp`: Displays available console commands (Console only).

## Notes

- This script is tailored for GTA Connected (GTA IV) and may not work on other platforms without modification.
- Some features, like `/trainers` and `/disableweapons`, are specific to GTA Connected.
- Emote support enhances chat interaction

- ⭐ Developed By SirCryptic

- Credits: [VortrexFTW](https://github.com/VortrexFTW) for the original v-admin script.
