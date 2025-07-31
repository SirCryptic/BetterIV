"use strict";
/*
Developed By SirCryptic - Enjoy :)
*/

// Configuration
const WEBHOOK_URL = "your_discord_webhook_url"; // Your Discord webhook URL
const PROXY_URL = "your_render_url"; // Replace with your Render URL
const EMOTES = {
    ":)": "😊",
    ":D": "😃",
    ":(": "😞",
    ":P": "😛",
    ";)": "😉",
    "<3": "❤️",
    ":o": "😮",
    ":|": "😐",
    ":*": "😘",
    ":/": "😕",
    "XD": "😆",
    ":@": "😠",
    ":'(": "😢",
    ":')": "😂",
    "8)": "😎"
};
const CHAT_QUEUE = []; // Queue for rate limit handling
const QUEUE_INTERVAL = 2000; // 2-second delay between requests

// Function to convert ArrayBuffer to string
function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
}

// Promise-based wrapper for httpGet
function httpGetPromise(url) {
    return new Promise(function(resolve, reject) {
        var fullBody = "";
        try {
            httpGet(url, "", function(receivedData) {
                fullBody += ab2str(receivedData);
            }, function(curlErrorCode, httpResponseCode) {
                if (curlErrorCode === 0 && (httpResponseCode === 200 || httpResponseCode === 204)) {
                    resolve({ statusCode: httpResponseCode, body: fullBody });
                } else {
                    reject(new Error("HTTP error"));
                }
            });
        } catch (e) {
            reject(new Error("httpGet failed"));
        }
    });
}

// Function to process emotes (same as admin script)
function processEmotes(messageText) {
    if (!messageText) return messageText;
    var processed = messageText;
    for (var emote in EMOTES) {
        if (processed.includes(emote)) {
            processed = processed.replace(new RegExp(emote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"), EMOTES[emote]);
        }
    }
    return processed;
}

// Function to send queued messages (handles rate limits)
function sendQueuedMessages() {
    if (CHAT_QUEUE.length === 0) return;
    var queueItem = CHAT_QUEUE.shift();
    var url = queueItem.url;
    httpGetPromise(url)
        .then(function(response) {
            setTimeout(sendQueuedMessages, QUEUE_INTERVAL);
        })
        .catch(function(e) {
            setTimeout(sendQueuedMessages, QUEUE_INTERVAL);
        });
}

// Event handler for player chat
addEventHandler("OnPlayerChat", function(event, client, chatMessage) {
    if (!client || !chatMessage) return true;

    var playerName = client.name || "Unknown";
    var processedMessage = processEmotes(chatMessage);
    var discordMessage = "[" + playerName + "]: " + processedMessage;

    // Add to queue with proxy URL
    var url = PROXY_URL + "?webhook=" + encodeURIComponent(WEBHOOK_URL + "?wait=true") + "&postData=" + encodeURIComponent(discordMessage);
    CHAT_QUEUE.push({ url: url });
    sendQueuedMessages();

    return true;
});