# GTA Connected Discord Chat Relay Proxy

This resource provides a relay in-game chat from a GTA Connected server to a Discord channel via a webhook. The resource is reliant on `IV-PROXY` [HERE](https://github.com/sircryptic/iv-proxy) to work with the resource in a GTA Connected server, addressing limitations in the server's `httpGet` function for sending JSON POST requests. The proxy is deployed on [Render](https://render.com) (free tier) and forwards chat messages to a Discord webhook.

This is useful for server owners who want to mirror in-game chat (e.g., `[WizzWow]: test`) to a Discord channel with emoji support (e.g., `:)` → 😊).

## Prerequisites

- **GTA Connected Server**: A running server with the `b-discord` resource installed.
- **Discord Webhook**: A webhook URL for the target Discord channel (created via Channel → Edit → Integrations → Create Webhook).
- **Render Account**: A free Render account for hosting the proxy (one-time sign-up required).
- **GitHub Repository Access**: Access to this repository (`https://github.com/SirCryptic/iv-proxy`) to deploy the proxy.

## Setup Instructions

### 1. Create a Discord Webhook
1. In your Discord server, go to the desired channel → Edit Channel → Integrations → Create Webhook.
2. Copy the webhook URL (e.g., `https://discord.com/api/webhooks/123456789/abcdefg`).

### 2. Deploy the Proxy on Render
1. **Sign Up on Render**:
   - Create a free account at [Render](https://render.com).
2. **Create a Web Service**:
   - In the Render dashboard, click "New" → "Web Service".
   - Connect to this repository: `https://github.com/SirCryptic/iv-proxy`.
   - Configure:

     <img width="1828" height="601" alt="image" src="https://github.com/user-attachments/assets/a9ef76d5-4795-4f8b-be5e-d2730c8f1261" />

   - Deploy the service.
3. **Get the Proxy URL**:
   - After deployment, copy the public URL (e.g., `https://your-proxy.onrender.com`).

### 3. Configure the GTA Connected `b-discord` Resource
1. **Update `server.js`**:
   - In your GTA Connected server, locate the `b-discord` resource (`/home/container/resources/b-discord/server.js`).
   - Update the `PROXY_URL` variable with your Render proxy URL:
     ```javascript
     const PROXY_URL = "https://your-proxy.onrender.com"; // Your Render proxy URL
     ```
   - Ensure the `WEBHOOK_URL` matches your Discord webhook URL:
     ```javascript
     const WEBHOOK_URL = "<YOUR_WEBHOOK_URL>";
     ```

3. Test the Chat Relay

Restart the GTA Connected Server


Send a Chat Message:
In-game, send a message (e.g: test) 
Expected result: [PlayerName]: test appears in the Discord channel.

Rate Limits:
Discord webhooks: 30 requests/minute. The script’s queue (2-second delay) prevents hitting this limit.

Notes

Enhancements: For custom Discord formatting (e.g., embeds), make a bot and use a bot token check out [DISFRAME HERE](https://github.com/sircryptic/disframe).
