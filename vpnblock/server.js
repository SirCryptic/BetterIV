"use strict";

// Configuration
const APIS = [
    { url: "http://check.getipintel.net/check.php?ip=%s&format=json&flags=m", threshold: 0.3, key: 'result' }, // GetIPIntel.net (score >= 0.3 = VPN)
    { url: "http://ip-api.com/json/%s?fields=status,proxy,hosting", key: ['proxy', 'hosting'] }, // ip-api.com (proxy or hosting = true)
    { url: "https://blackbox.ipinfo.app/lookup/%s", key: 'Y' }, // BlackBox IPInfo ('Y' = VPN)
    { url: "http://proxycheck.io/v2/%s?key=free&vpn=1&asn=1", key: 'proxy' }, // ProxyCheck.io ('yes' = VPN)
    { url: "https://ip.teoh.io/api/vpn/%s", key: 'vpn_or_proxy' }, // IP Teoh ('yes' = VPN)
    { url: "https://api.ipapi.is?q=%s", key: ['is_vpn', 'is_proxy', 'is_hosting'] } // ipapi.is (any true = VPN)
];
const CACHE = {}; // In-memory cache { ip: { isVPN: bool, timestamp: number } }
const CACHE_TIMEOUT = 3600 * 1000; // 1 hour in ms
const PLAYER_MESSAGE = "You have been kicked for using a VPN. Please disable it and reconnect.";
const LOG_PREFIX = "[VPNBLOCK] ";
const DISCONNECT_DELAY = 5000; // 5 seconds delay for message display

// Log script loading
console.log(LOG_PREFIX + "VPN blocking script loaded");

// Function to convert ArrayBuffer to string
function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
}

// Promise-based wrapper for httpGet
function httpGetPromise(url) {
    return new Promise((resolve, reject) => {
        let fullBody = "";
        try {
            httpGet(url, "", (receivedData) => {
                fullBody += ab2str(receivedData);
            }, (curlErrorCode, httpResponseCode) => {
                if (curlErrorCode === 0 && httpResponseCode === 200) {
                    resolve({ statusCode: httpResponseCode, body: fullBody });
                } else {
                    reject(new Error("HTTP error: CURL " + curlErrorCode + ", HTTP " + httpResponseCode));
                }
            });
        } catch (e) {
            reject(new Error("httpGet failed: " + e.message));
        }
    });
}

// Async function to check if IP is VPN
async function checkVPN(ip) {
    // Check cache
    if (CACHE[ip] && Date.now() - CACHE[ip].timestamp < CACHE_TIMEOUT) {
        return CACHE[ip].isVPN;
    }

    let isVPNDetected = false;

    for (const api of APIS) {
        if (isVPNDetected) break;

        const url = api.url.replace("%s", ip);
        try {
            const response = await httpGetPromise(url);
            const data = api.key === 'Y' ? response.body.trim() : JSON.parse(response.body);
            if (api.key === 'result') { // GetIPIntel.net
                if (parseFloat(data.result) >= api.threshold) isVPNDetected = true;
            } else if (Array.isArray(api.key)) { // ip-api.com or ipapi.is
                if (api.key.some(k => data[k])) isVPNDetected = true;
            } else if (data[ip] && data[ip][api.key] === 'yes') { // ProxyCheck.io
                isVPNDetected = true;
            } else if (data[api.key] === 'yes') { 
                isVPNDetected = true;
            } else if (data === api.key) { // BlackBox
                isVPNDetected = true;
            }
        } catch (e) {
            // Silent error handling to prevent crashes
        }
    }

    // Cache result
    CACHE[ip] = { isVPN: isVPNDetected, timestamp: Date.now() };
    return isVPNDetected;
}

// Event handler for player joining
addEventHandler("OnPlayerJoined", async function(event, client) {
    const ip = client.ip;
    const playerName = client.name || "Unknown";
    console.log(LOG_PREFIX + "Checking IP: " + ip);

    try {
        const isVPNFlag = await checkVPN(ip);
        if (isVPNFlag) {
            messageClient(PLAYER_MESSAGE, client, COLOUR_RED);
            setTimeout(() => {
                client.disconnect();
                console.log(LOG_PREFIX + "Kicked " + playerName + " with IP " + ip + " (VPN/PROXY detected)");
            }, DISCONNECT_DELAY);
        } else {
            console.log(LOG_PREFIX + "Allowed " + playerName + " with IP " + ip);
        }
    } catch (e) {
        console.log(LOG_PREFIX + "Error checking IP for VPN/PROXY " + ip + ": " + e.message);
        // Allow connection on error to avoid crashes
    }
});

// Periodic cache cleanup (every 6 hours)
setInterval(() => {
    const now = Date.now();
    for (let ip in CACHE) {
        if (now - CACHE[ip].timestamp > CACHE_TIMEOUT) {
            delete CACHE[ip];
        }
    }
    console.log(LOG_PREFIX + "VPN IP cache cleared");
}, 6 * 3600 * 1000);