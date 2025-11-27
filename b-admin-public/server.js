"use strict";

// ----------------------------------------------------------------------------

let scriptConfig = null;
let playersData = null;
let logMessagePrefix = "ADMIN:";
let returnScriptsToClient = null;
const errorMessageColour = COLOUR_RED; // Define error message color
const adminLogFile = "log.json"; // File for admin command logs
const playersFile = "players.json"; // File for player data

// ----------------------------------------------------------------------------

bindEventHandler("onResourceStart", thisResource, (event, resource) => {
    loadConfig();
    loadPlayers();
    server.unbanAllIPs();
    applyBansToServer();
    applyPlayerPermissions();
    collectAllGarbage();

    // Start timer to check for expired temp bans
    setInterval(checkExpiredBans, 60000); // Check every minute

    // Initialize admin log file as a JSON array
    let logFileContent = loadTextFile(adminLogFile);
    if (!logFileContent || logFileContent.trim() === "") {
        saveTextFile(adminLogFile, JSON.stringify([{ timestamp: new Date().toISOString(), client: "System", ip: "0.0.0.0", command: "server", params: "", details: "Server started" }], null, '\t'));
    } else {
        try {
            JSON.parse(logFileContent); // Validate JSON
        } catch (e) {
            console.log(`Invalid JSON in ${adminLogFile}. Initializing new log file.`);
            saveTextFile(adminLogFile, JSON.stringify([{ timestamp: new Date().toISOString(), client: "System", ip: "0.0.0.0", command: "server", params: "", details: "Server started" }], null, '\t'));
        }
    }
});

// ----------------------------------------------------------------------------

bindEventHandler("onResourceStop", thisResource, (event, resource) => {
    server.unbanAllIPs();
    saveConfig();
    savePlayers();
    removeBansFromServer();
    collectAllGarbage();

    getClients().forEach((client) => {
        client.removeData("b.admin"); // Remove admin data from all players
        client.removeData("b.weapons"); // Remove weapon data from all players
        client.removeData("b.token"); // Remove token data from all players
    });

    // Append server stop entry to JSON log
    let logFileContent = loadTextFile(adminLogFile);
    let logArray = [];
    try {
        logArray = JSON.parse(logFileContent) || [];
    } catch (e) {
        console.log(`Error parsing ${adminLogFile}: ${e.message}. Starting new log array.`);
        logArray = [];
    }
    logArray.push({
        timestamp: new Date().toISOString(),
        client: "System",
        ip: "0.0.0.0",
        command: "server",
        params: "",
        details: "Server stopped"
    });
    saveTextFile(adminLogFile, JSON.stringify(logArray, null, '\t'));
});

// ----------------------------------------------------------------------------

const serverEmotes = {
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

function processEmotes(messageText) {
    if (!messageText) return messageText;
    let processed = messageText;
    for (const emote in serverEmotes) {
        if (processed.includes(emote)) {
            processed = processed.replace(new RegExp(escapeRegExp(emote), "g"), serverEmotes[emote]);
        }
    }
    return processed;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

addEventHandler("OnPlayerChat", function(event, client, chatMessage) {
    event.preventDefault(); // Prevent default server logging
    const processedMessage = processEmotes(chatMessage);
    const formattedMessage = `${client.name}: ${processedMessage}`;
    console.log(`[CHAT] ${formattedMessage}`); // Log processed message only
    getClients().forEach((otherClient) => {
        messageClient(formattedMessage, otherClient, COLOUR_WHITE); // Send to all clients
    });
    return false; // Prevent original message propagation
});

addCommandHandler("emotes", function(command, params, client) {
    if (getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }
    logAdminAction(client, command, params);
    messageClient("📝 Available Emoticons:", client, COLOUR_YELLOW);
    const emoteEntries = Object.entries(serverEmotes);
    let emoteLines = [];
    for (let i = 0; i < emoteEntries.length; i += 5) {
        const group = emoteEntries.slice(i, i + 5);
        const line = group.map(([text, emoji]) => `${text} ${emoji}`).join("  ");
        emoteLines.push(line);
    }
    emoteLines.forEach(line => {
        messageClient(line, client, COLOUR_WHITE);
    });
    messageClient("Type these in your chat messages! 😊", client, COLOUR_LIME);
    return true;
});

addEventHandler("OnPlayerJoined", function(event, client) {
    console.log(` CONNECT: ${client.name} (${client.ip}) is attempting to connect`);
    if (typeof gta != "undefined") {
        sendClientBlockedScripts(client);
    }
    const playerToken = generateRandomString(128);
    client.setData("b.token", playerToken, true);

    let playerIndex = Array.isArray(playersData) ? playersData.findIndex(p => p.name.toLowerCase() === client.name.toLowerCase() || p.ip === client.ip || p.token === playerToken) : -1;
    if (playerIndex !== -1) {
        playersData[playerIndex].ip = client.ip;
        playersData[playerIndex].token = playerToken;
    } else {
        playersData.push({
            name: escapeJSONString(client.name),
            ip: client.ip,
            token: playerToken,
            bans: null,
            trainers: { status: areTrainersEnabledForEverybody(), addedBy: "System" },
            weapons: { status: true, addedBy: "System" },
            admin: null
        });
    }
    savePlayers();

    const playerData = playersData.find(p => p.token === playerToken);
    if (typeof client.trainers != "undefined") {
        client.trainers = playerData.trainers ? playerData.trainers.status : areTrainersEnabledForEverybody();
    }
    const weaponStatus = playerData.weapons ? playerData.weapons.status : true;
    client.setData("b.weapons", weaponStatus, true);
    triggerNetworkEvent("b.admin.weapons", client, weaponStatus);
    triggerNetworkEvent("b.admin.token", client, scriptConfig.serverToken);
    messageAdmins(`[JOIN] Player ${client.name} connected (IP: ${client.ip})`);
    setTimeout(() => {
        const welcomeMsg = processEmotes(`Welcome ${client.name}! :) Use /emotes to see available emojis :D`);
        messageClient(`${welcomeMsg}`, client, COLOUR_LIME);
    }, 3000);
});

function logAdminAction(client, command, params, details = "") {
    // Audited admin/mod actions to include in log.json
    const audited = [
        "kick","scripts","ban","unban","blockscript","makeadmin","makemod",
        "trainers","ip","geoip","reloadbans","reloadplayers","tempban",
        "listplayers","disableweapons","wsay","banlist","banip","unbanip","demote"
    ];
    const action = String(command).toLowerCase();
    if (!audited.includes(action)) {
        return true; // Ignore non-audited commands
    }

    let logFileContent = loadTextFile(adminLogFile);
    let logArray = [];
    try {
        logArray = JSON.parse(logFileContent) || [];
    } catch (e) {
        console.log(`Error parsing ${adminLogFile}: ${e.message}. Starting new log array.`);
        logArray = [];
    }

    const entry = {
        timestamp: new Date().toISOString(),
        actor: client.name,
        action: action,
        target: extractTarget(action, params, details) || "",
        reason: extractReason(details, params),
        context: params || "",
        details: details || ""
    };
    logArray.push(entry);
    saveTextFile(adminLogFile, JSON.stringify(logArray, null, '\t'));
    return true;
}

function extractReason(details, params) {
    // Try to pull reason from details (e.g., "Reason: ...") else from params after first token
    if (details) {
        const m = String(details).match(/Reason:\s*(.*)$/i);
        if (m && m[1]) return m[1].trim();
    }
    if (params) {
        const parts = String(params).split(" ");
        if (parts.length > 1) return parts.slice(1).join(" ").trim();
    }
    return "";
}

function extractTarget(action, params, details) {
    // Prefer explicit name found in details patterns
    if (details) {
        // Try to match "Kicked NAME" / "Banned NAME" / "Tempbanned NAME" / "Unbanned NAME"
        const patterns = [
            /Kicked\s+([^\[]+)/i,
            /Banned\s+([^\[]]+)/i,
            /Tempbanned\s+([^\[]]+)/i,
            /Unbanned\s+([^\[]]+)/i,
            /makeadmin\s+([^\s]+)/i,
            /makemod\s+([^\s]+)/i,
            /trainers\s+([^\s]+)/i,
            /blockscript\s+([^\s]+)/i
        ];
        for (const re of patterns) {
            const m = String(details).match(re);
            if (m && m[1]) return m[1].trim();
        }
    }
    // Fall back to first token in params (often ID/name/ip or target name)
    if (params) {
        const first = String(params).trim().split(" ")[0];
        if (first) {
            // Try to resolve to a live client for a clean name
            try {
                const c = getClientFromParams(first, false);
                if (c && c.name) return c.name;
            } catch (e) { /* ignore */ }

            // If it's an ID format, normalize it
            const idMatch = first.match(/^\[?ID:(\d+)\]?$/i) || (!isNaN(first) && [{}, first]);
            if (idMatch) {
                const idVal = Array.isArray(idMatch) ? idMatch[1] : first;
                return `ID:${parseInt(idVal)}`;
            }

            // Avoid logging raw IPs by default, but keep IP for banip/unbanip so it can be referenced later
            if (isIPAddress(first) && action !== 'banip' && action !== 'unbanip') {
                return '(IP)';
            }

            return first.trim();
        }
    }
    return "";
}

function isIPAddress(text) {
    const s = String(text).trim();
    // IPv4 simple check
    const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
    // IPv6 very loose
    const ipv6 = /:/;
    return ipv4.test(s) || ipv6.test(s);
}

// ----------------------------------------------------------------------------

addCommandHandler("adminhelp", (command, params, client) => {
    if (getPlayerAdminLevel(client) < 1) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    const commands = Object.keys(scriptConfig.commandLevels).map(cmd => {
        const level = scriptConfig.commandLevels[cmd];
        if (getPlayerAdminLevel(client) >= level) {
            let usage = cmd;
            if (cmd === "kick") usage = "/kick [ID:<number>]/name/ip";
            else if (cmd === "ban") usage = "/ban [ID:<number>]/name/ip <reason>";
            else if (cmd === "tempban") usage = "/tempban [ID:<number>]/name/ip <minutes> <reason>";
            else if (cmd === "unban") usage = "/unban name/ip <reason>";
            else if (cmd === "banip") usage = "/banip <ip> <reason>";
            else if (cmd === "unbanip") usage = "/unbanip <ip> <reason>";
            else if (cmd === "msay" || cmd === "modsay" || cmd === "m") usage = "/msay <message>";
            else if (cmd === "wsay" || cmd === "ownersay" || cmd === "w") usage = "/wsay <message>";
            else if (cmd === "a") usage = "/a <message>";
            else if (cmd === "announce") usage = "/announce <message>";
            else if (cmd === "makeadmin") usage = "/makeadmin <username>";
            else if (cmd === "makemod") usage = "/makemod <username>";
            else if (cmd === "scripts") usage = "/scripts [ID:<number>]/name/ip";
            else if (cmd === "blockscript") usage = "/blockscript <script>";
            else if (cmd === "trainers") usage = "/trainers name";
            else if (cmd === "disableweapons") usage = "/disableweapons [ID:<number>]/name/ip";
            else if (cmd === "ip") usage = "/ip [ID:<number>]/name/ip";
            else if (cmd === "geoip") usage = "/geoip [ID:<number>]/name/ip";
            else if (cmd === "banlist") usage = "/banlist";
            else if (cmd === "lastbanip") usage = "/lastbanip [ip|count]";
            else if (cmd === "demote") usage = "/demote <username> [reason]";
            else if (cmd === "adminstatus") usage = "/adminstatus";
            else if (cmd === "reloadplayers") usage = "/reloadplayers";
            return `${usage} (Level ${level})`;
        }
        return null;
    }).filter(cmd => cmd !== null);

    messageClient(`Available Admin Commands:\n${commands.join("\n")}`, client, COLOUR_YELLOW);
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("adminstatus", (command, params, client) => {
    if (getPlayerAdminLevel(client) < 1) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    const playerData = Array.isArray(playersData) ? playersData.find(p => p.name.toLowerCase() === client.name.toLowerCase()) : null;
    const role = playerData && playerData.admin ? playerData.admin.role : "None";
    const level = getPlayerAdminLevel(client);
    messageClient(`Admin Status:\nName: ${client.name}\nRole: ${role}\nLevel: ${level}`, client, COLOUR_YELLOW);
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("consolehelp", (command, params, client) => {
    if (!client.console) {
        messageClient("This command is only available in the server console!", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params, "Displayed console help menu");
    const commands = [
        { usage: "kick [ID:<number>]/name/ip", description: "Kicks a player from the server" },
        { usage: "ban [ID:<number>]/name/ip <reason>", description: "Permanently bans a player by ID, name, IP, or token (reason required)" },
        { usage: "tempban [ID:<number>]/name/ip <minutes> <reason>", description: "Temporarily bans a player for specified minutes (reason required)" },
        { usage: "unban name/ip <reason>", description: "Removes a ban by player name, IP, or token (reason required)" },
        { usage: "banip <ip> <reason>", description: "Permanently bans an IP (reason required)" },
        { usage: "unbanip <ip> <reason>", description: "Removes an IP ban (reason required)" },
        { usage: "lastbanip [ip|count]", description: "Shows recent IP ban/unban log entries" },
        { usage: "demote <username> [reason]", description: "Removes admin/mod permissions from a player" },
        { usage: "banlist", description: "Lists all active bans with details" },
        { usage: "trainers name", description: "Toggles trainers for a player" },
        { usage: "disableweapons [ID:<number>]/name/ip", description: "Toggles weapons for a player" },
        { usage: "reloadplayers", description: "Reloads player data from players.json" }
    ].map(cmd => `${cmd.usage} - ${cmd.description}`).join("\n");

    const helpMessage = `Available Console Commands:\n${commands}\nNote: Use listplayers to see connected players' names, IDs, and IPs.`;
    console.log(helpMessage);
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("banlist", (command, params, client) => {
    if (!client.console && getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    if (!Array.isArray(playersData) || !playersData.some(p => p.bans)) {
        const noBansMsg = "No active bans found. Use ban or tempban to add bans.";
        client.console ? console.log(noBansMsg) : messageClient(noBansMsg, client, COLOUR_YELLOW);
        return true;
    }

    const banList = playersData
        .filter(p => p.bans)
        .map(p => {
            const expiry = p.bans.expireTime ? ` (Expires: ${new Date(p.bans.expireTime).toLocaleString('en-GB')})` : "";
            return `${p.name} [IP: ${p.ip}] - Reason: ${p.bans.reason || "None"} - By: ${p.bans.admin}${expiry}`;
        }).join("\n");
    const listMsg = `Active Bans (${playersData.filter(p => p.bans).length}):\n${banList}`;
    client.console ? console.log(listMsg) : messageClient(listMsg, client, COLOUR_YELLOW);
    return true;
});

// ----------------------------------------------------------------------------

function handleWsayCommand(command, params, client) {
    if (!client.console && getPlayerAdminLevel(client) < 2) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        messageClient("Usage: /wsay <message>", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    console.log(`wsay cmd executed by ${client.name}: ${params}`);
    message(`[Owner] [#FFFFFF]${client.name}: ${params}`, COLOUR_ORANGE);
    return true;
}

addCommandHandler("wsay", handleWsayCommand);
addCommandHandler("ownersay", handleWsayCommand);
addCommandHandler("w", handleWsayCommand);

// ----------------------------------------------------------------------------

function handleMsayCommand(command, params, client) {
    if (client.console) {
        messageClient("This command is only available in-game!", client, errorMessageColour);
        return false;
    }

    const playerData = Array.isArray(playersData) ? playersData.find(p => p.name.toLowerCase() === client.name.toLowerCase()) : null;
    if (!playerData || !playerData.admin || (playerData.admin.role !== "mod" && playerData.admin.role !== "admin") || getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        messageClient("Usage: /msay <message>", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    console.log(`msay cmd executed by ${client.name}: ${params}`);
    message(`[Moderator] [#FFFFFF]${client.name}: ${params}`, COLOUR_YELLOW);
    return true;
}

addCommandHandler("msay", handleMsayCommand);
addCommandHandler("modsay", handleMsayCommand);
addCommandHandler("m", handleMsayCommand);

// ----------------------------------------------------------------------------

addCommandHandler("kick", (command, params, client) => {
    if (!client.console && getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        const errorMsg = "Usage: kick [ID:<number>]/name/ip - Kicks a player from the server";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    let targetClient = getClientFromParams(params, true);
    if (targetClient == null) {
        const errorMsg = `No player found with ID, name, IP, or token '${params}'. Use /listplayers to see connected players.`;
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    if (!client.console && targetClient.index === client.index) {
        messageClient("You cannot kick yourself!", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params, `Kicked ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}]`);
    const successMsg = `Successfully kicked ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}]`;
    client.console ? console.log(successMsg) : messageClient(successMsg, client, COLOUR_YELLOW);
    messageAdmins(`${targetClient.name} [ID:${targetClient.index}] has been kicked by ${client.name}!`);
    console.log(`kick cmd executed by ${client.name}: Kicked ${targetClient.name} [ID:${targetClient.index}]`);
    targetClient.disconnect();
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("scripts", (command, params, client) => {
    if (typeof gta == "undefined") {
        messageClient(`This command is only available on GTA Connected`, client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        const errorMsg = "Usage: scripts [ID:<number>]/name/ip - Requests game scripts for a player";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    let targetClient = getClientFromParams(params, true);
    if (targetClient == null) {
        const errorMsg = `No player found with ID, name, IP, or token '${params}'. Use /listplayers to see connected players.`;
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    if (client.getData("b.admin") < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    returnScriptsToClient = client;
    requestGameScripts(targetClient);
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("ban", (command, params, client) => {
    if (!client.console && getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        const errorMsg = "Usage: ban [ID:<number>]/name/ip <reason> - Permanently bans a player";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    let splitParams = params.split(" ");
    let targetParams = splitParams[0];
    let reasonParams = splitParams.slice(1).join(" ");
    if (!reasonParams || reasonParams.trim() === "") {
        const errorMsg = "Reason is required. Usage: ban [ID:<number>]/name/ip <reason>";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }
    let targetClient = getClientFromParams(targetParams, true);

    if (targetClient == null) {
        const errorMsg = `No player found with ID, name, IP, or token '${params}'. Use /listplayers to see connected players.`;
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    if (!client.console && targetClient.index === client.index) {
        messageClient("You cannot ban yourself!", client, errorMessageColour);
        return false;
    }

    const playerToken = targetClient.getData("b.token") || generateRandomString(128);
    let playerIndex = playersData.findIndex(p => p.token === playerToken);
    if (playerIndex === -1) {
        playersData.push({
            name: escapeJSONString(targetClient.name),
            ip: targetClient.ip,
            token: playerToken,
            bans: null,
            trainers: { status: areTrainersEnabledForEverybody(), addedBy: "System" },
            weapons: { status: true, addedBy: "System" },
            admin: null
        });
        playerIndex = playersData.length - 1;
    }
    playersData[playerIndex].bans = {
        reason: escapeJSONString(reasonParams),
        admin: escapeJSONString(client.name),
        timeStamp: new Date().toLocaleDateString('en-GB')
    };
    playersData[playerIndex].ip = targetClient.ip;
    savePlayers();
    logAdminAction(client, command, params, `Banned ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}] Reason: ${reasonParams}`);
    const successMsg = `Successfully banned ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}] Reason: ${reasonParams}`;
    client.console ? console.log(successMsg) : messageClient(successMsg, client, COLOUR_YELLOW);
    messageAdmins(`${targetClient.name} [ID:${targetClient.index}] (IP: ${targetClient.ip}) has been banned by ${client.name}! Reason: ${reasonParams || "No reason provided"}`);
    console.log(`ban cmd executed by ${client.name}: Banned ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}] Reason: ${reasonParams || "No reason provided"}`);
    server.banIP(targetClient.ip, 0);
    triggerNetworkEvent("b.admin.token.save", targetClient, playerToken, scriptConfig.serverToken);
    targetClient.disconnect();
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("tempban", (command, params, client) => {
    if (!client.console && getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        const errorMsg = "Usage: tempban [ID:<number>]/name/ip <minutes> <reason> - Temporarily bans a player";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    let splitParams = params.split(" ");
    let targetParams = splitParams[0];
    let duration = parseInt(splitParams[1]);
    let reasonParams = splitParams.slice(2).join(" ");
    let targetClient = getClientFromParams(targetParams, true);

    if (targetClient == null) {
        const errorMsg = `No player found with ID, name, IP, or token '${targetParams}'. Use /listplayers to see connected players.`;
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    if (isNaN(duration) || duration <= 0) {
        const errorMsg = "Duration must be a positive number (in minutes).";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    if (!reasonParams || reasonParams.trim() === "") {
        const errorMsg = "Reason is required. Usage: tempban [ID:<number>]/name/ip <minutes> <reason>";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    if (!client.console && targetClient.index === client.index) {
        messageClient("You cannot tempban yourself!", client, errorMessageColour);
        return false;
    }

    const playerToken = targetClient.getData("b.token") || generateRandomString(128);
    let playerIndex = playersData.findIndex(p => p.token === playerToken);
    if (playerIndex === -1) {
        playersData.push({
            name: escapeJSONString(targetClient.name),
            ip: targetClient.ip,
            token: playerToken,
            bans: null,
            trainers: { status: areTrainersEnabledForEverybody(), addedBy: "System" },
            weapons: { status: true, addedBy: "System" },
            admin: null
        });
        playerIndex = playersData.length - 1;
    }
    let expireTime = Date.now() + (duration * 60 * 1000); // Duration in minutes to milliseconds
    playersData[playerIndex].bans = {
        reason: escapeJSONString(reasonParams),
        admin: escapeJSONString(client.name),
        timeStamp: new Date().toLocaleDateString('en-GB'),
        expireTime: expireTime
    };
    playersData[playerIndex].ip = targetClient.ip;
    savePlayers();
    logAdminAction(client, command, params, `Tempbanned ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}] for ${duration} minutes. Reason: ${reasonParams}`);
    const expiryDate = new Date(expireTime).toLocaleString('en-GB');
    const successMsg = `Successfully tempbanned ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}] for ${duration} minutes until ${expiryDate} Reason: ${reasonParams}`;
    client.console ? console.log(successMsg) : messageClient(successMsg, client, COLOUR_YELLOW);
    messageAdmins(`${targetClient.name} [ID:${targetClient.index}] (IP: ${targetClient.ip}) has been temporarily banned by ${client.name} for ${duration} minutes! Reason: ${reasonParams || "No reason provided"}`);
    console.log(`tempban cmd executed by ${client.name}: Tempbanned ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}] for ${duration} minutes. Reason: ${reasonParams || "No reason provided"}`);
    server.banIP(targetClient.ip, 0);
    triggerNetworkEvent("b.admin.token.save", targetClient, playerToken, scriptConfig.serverToken);
    targetClient.disconnect();
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("unban", (command, params, client) => {
    if (!client.console && getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        const errorMsg = "Usage: unban name/ip <reason> - Removes a ban by player name, IP, or token";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    const split = params.split(" ");
    const targetParam = split[0];
    const reason = split.slice(1).join(" ");
    if (!reason || reason.trim() === "") {
        const errorMsg = "Reason is required. Usage: unban name/ip <reason>";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params, `Unbanned ${targetParam} Reason: ${reason}`);
    let removedBans = [];
    for (let i = playersData.length - 1; i >= 0; i--) {
        if (playersData[i].bans && (playersData[i].ip === targetParam || playersData[i].name.toLowerCase().includes(targetParam.toLowerCase()) || playersData[i].token === targetParam)) {
            server.unbanIP(playersData[i].ip);
            let removedBan = playersData[i].bans;
            playersData[i].bans = null;
            removedBans.push({ name: playersData[i].name, ip: playersData[i].ip, ...removedBan });
        }
    }

    if (removedBans.length === 0) {
        const errorMsg = `No bans found for name, IP, or token '${targetParam}'. Use /banlist to see active bans.`;
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    savePlayers();
    removedBans.forEach(ban => {
        const successMsg = `Successfully unbanned ${ban.name} [IP: ${ban.ip}] Reason: ${reason}`;
        client.console ? console.log(successMsg) : messageClient(successMsg, client, COLOUR_YELLOW);
        messageAdmins(`${ban.name} [IP: ${ban.ip}] has been unbanned by ${client.name}! Reason: ${reason}`);
        logAdminAction(client, command, params, `Unbanned ${ban.name} [IP: ${ban.ip}] Reason: ${reason}`);
    });
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("banip", (command, params, client) => {
    if (!client.console && getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        const errorMsg = "Usage: banip <ip> <reason> - Permanently bans an IP";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    const split = params.split(" ");
    const ip = split[0];
    const reason = split.slice(1).join(" ");
    if (!reason || reason.trim() === "") {
        const errorMsg = "Reason is required. Usage: banip <ip> <reason>";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    // Apply server IP ban only; do not store in playersData
    server.banIP(ip, 0);

    logAdminAction(client, command, params, `Banned IP ${ip} Reason: ${reason}`);
    const successMsg = `Successfully banned IP ${ip} Reason: ${reason}`;
    client.console ? console.log(successMsg) : messageClient(successMsg, client, COLOUR_YELLOW);
    messageAdmins(`IP ${ip} has been banned by ${client.name}! Reason: ${reason}`);
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("unbanip", (command, params, client) => {
    if (!client.console && getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        const errorMsg = "Usage: unbanip <ip> <reason> - Removes an IP ban";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    const split = params.split(" ");
    const ip = split[0];
    const reason = split.slice(1).join(" ");
    if (!reason || reason.trim() === "") {
        const errorMsg = "Reason is required. Usage: unbanip <ip> <reason>";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    server.unbanIP(ip);

    logAdminAction(client, command, params, `Unbanned IP ${ip} Reason: ${reason}`);
    const successMsg = `Successfully unbanned IP ${ip} Reason: ${reason}`;
    client.console ? console.log(successMsg) : messageClient(successMsg, client, COLOUR_YELLOW);
    messageAdmins(`IP ${ip} has been unbanned by ${client.name}! Reason: ${reason}`);
    return true;
});

addCommandHandler("listplayers", (command, params, client) => {
    if (getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    let players = getClients();
    if (players.length === 0) {
        if (client.console) {
            console.log("No players are currently connected.");
        }
        messageClient("No players are currently connected.", client, COLOUR_YELLOW);
        return false;
    }

    const level = getPlayerAdminLevel(client);
    let playerList = "";
    if (client.console || level >= 2) {
        playerList = players.map(p => `${p.name} [ID:${p.index}, IP: ${p.ip}]`).join("\n");
    } else {
        playerList = players.map(p => `${p.name} [ID:${p.index}]`).join("\n");
    }
    if (client.console) {
        console.log(`Connected Players (${players.length}):\n${playerList}`);
    }
    messageClient(`Connected Players (${players.length}):\n${playerList}`, client, COLOUR_YELLOW);
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("lastbanip", (command, params, client) => {
    if (!client.console && getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    const arg = (params || "").trim();
    let filterIP = null;
    let limit = 10;
    if (arg) {
        if (!isNaN(arg)) {
            limit = Math.max(1, parseInt(arg));
        } else if (isIPAddress(arg)) {
            filterIP = arg;
        }
    }

    let logFileContent = loadTextFile(adminLogFile);
    let entries = [];
    try {
        entries = JSON.parse(logFileContent) || [];
    } catch (e) {
        const msg = `No valid log entries found (${e.message}).`;
        client.console ? console.log(msg) : messageClient(msg, client, COLOUR_YELLOW);
        return false;
    }

    // Filter banip/unbanip only
    let filtered = entries.filter(e => e && (e.action === 'banip' || e.action === 'unbanip'));
    if (filterIP) {
        filtered = filtered.filter(e => (e.target && e.target.indexOf(filterIP) !== -1) || (e.details && e.details.indexOf(filterIP) !== -1));
    }
    // Most recent first
    filtered = filtered.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);

    if (filtered.length === 0) {
        const msg = filterIP ? `No IP ban/unban entries found for ${filterIP}.` : `No recent IP ban/unban entries found.`;
        client.console ? console.log(msg) : messageClient(msg, client, COLOUR_YELLOW);
        return true;
    }

    const lines = filtered.map(e => {
        const when = new Date(e.timestamp).toLocaleString('en-GB');
        const tgt = e.target || '(IP)';
        const why = e.reason ? ` Reason: ${e.reason}` : '';
        return `[${when}] ${e.action.toUpperCase()} by ${e.actor} -> ${tgt}${why}`;
    });

    const header = `Recent IP Ban/Unban Entries (${lines.length}${filterIP ? `, IP:${filterIP}` : ''})`;
    if (client.console) {
        console.log(`${header}:\n${lines.join("\n")}`);
    }
    messageClient(`${header}:\n${lines.join("\n")}`, client, COLOUR_YELLOW);
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("a", (command, params, client) => {
    if (client.getData("b.admin") < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        messageClient("Usage: /a <message>", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    messageAdmins(`${client.name}: ${params}`);
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("announce", (command, params, client) => {
    if (client.getData("b.admin") < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        messageClient("Usage: /announce <message>", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    messageAnnounce(params);
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("blockscript", (command, params, client) => {
    if (typeof gta == "undefined") {
        messageClient(`This command is only available on GTA Connected`, client, errorMessageColour);
        return false;
    }

    if (client.getData("b.admin") < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        messageClient("Usage: /blockscript <script>", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    addBlockedScript(params);
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("makeadmin", (command, params, client) => {
    if (getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        messageClient("Usage: /makeadmin <username>", client, errorMessageColour);
        return false;
    }

    let username = params.trim();
    let targetClient = getClients().find(c => c.name.toLowerCase() === username.toLowerCase());
    let token = targetClient ? targetClient.getData("b.token") : generateRandomString(128);
    let ip = targetClient ? targetClient.ip : "0.0.0.0";

    logAdminAction(client, command, params);
    let playerIndex = playersData.findIndex(p => p.name.toLowerCase() === username.toLowerCase());
    if (playerIndex === -1) {
        playersData.push({
            name: escapeJSONString(username),
            ip: ip,
            token: token,
            bans: null,
            trainers: { status: areTrainersEnabledForEverybody(), addedBy: "System" },
            weapons: { status: true, addedBy: "System" },
            admin: { role: "admin", level: 2, addedBy: escapeJSONString(client.name) }
        });
    } else {
        playersData[playerIndex].admin = {
            role: "admin",
            level: 2,
            addedBy: escapeJSONString(client.name)
        };
        playersData[playerIndex].ip = ip;
        playersData[playerIndex].token = token;
    }

    if (targetClient) {
        targetClient.setData("b.admin", 2, true);
        triggerNetworkEvent("b.admin.token.save", targetClient, token, scriptConfig.serverToken);
    }

    messageAdmins(`${client.name} made ${username} an admin!`);
    savePlayers();
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("makemod", (command, params, client) => {
    if (getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        messageClient("Usage: /makemod <username>", client, errorMessageColour);
        return false;
    }

    let username = params.trim();
    let targetClient = getClients().find(c => c.name.toLowerCase() === username.toLowerCase());
    let token = targetClient ? targetClient.getData("b.token") : generateRandomString(128);
    let ip = targetClient ? targetClient.ip : "0.0.0.0";

    logAdminAction(client, command, params);
    let playerIndex = playersData.findIndex(p => p.name.toLowerCase() === username.toLowerCase());
    if (playerIndex === -1) {
        playersData.push({
            name: escapeJSONString(username),
            ip: ip,
            token: token,
            bans: null,
            trainers: { status: areTrainersEnabledForEverybody(), addedBy: "System" },
            weapons: { status: true, addedBy: "System" },
            admin: { role: "mod", level: 1, addedBy: escapeJSONString(client.name) }
        });
    } else {
        playersData[playerIndex].admin = {
            role: "mod",
            level: 1,
            addedBy: escapeJSONString(client.name)
        };
        playersData[playerIndex].ip = ip;
        playersData[playerIndex].token = token;
    }

    if (targetClient) {
        targetClient.setData("b.admin", 1, true);
        triggerNetworkEvent("b.admin.token.save", targetClient, token, scriptConfig.serverToken);
    }

    messageAdmins(`${client.name} made ${username} a moderator!`);
    savePlayers();
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("demote", (command, params, client) => {
    const level = getPlayerAdminLevel(client);
    if (!client.console && level < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        messageClient("Usage: /demote <username> [reason]", client, errorMessageColour);
        return false;
    }

    const split = params.split(" ");
    const username = split[0];
    const reason = split.slice(1).join(" ");

    // Find target in playersData (case-insensitive)
    let idx = Array.isArray(playersData) ? playersData.findIndex(p => p.name.toLowerCase() === username.toLowerCase()) : -1;
    if (idx === -1) {
        // If not found, try to resolve from live clients to capture token/ip
        const targetClient = getClients().find(c => c.name.toLowerCase() === username.toLowerCase());
        if (!targetClient) {
            const msg = `Player '${username}' not found.`;
            client.console ? console.log(msg) : messageClient(msg, client, errorMessageColour);
            return false;
        }
        playersData.push({
            name: escapeJSONString(targetClient.name),
            ip: targetClient.ip,
            token: targetClient.getData("b.token") || generateRandomString(128),
            bans: null,
            trainers: { status: areTrainersEnabledForEverybody(), addedBy: "System" },
            weapons: { status: true, addedBy: "System" },
            admin: null
        });
        idx = playersData.length - 1;
    }

    const target = playersData[idx];
    const targetRole = target.admin ? target.admin.role : null;

    // Permission rule: only console can demote an admin; level 2 can demote a mod
    if (targetRole === 'admin' && !client.console) {
        const msg = "Only the server console can demote an admin.";
        client.console ? console.log(msg) : messageClient(msg, client, errorMessageColour);
        return false;
    }
    if (targetRole === null) {
        const msg = `${target.name} has no admin/mod permissions to remove.`;
        client.console ? console.log(msg) : messageClient(msg, client, COLOUR_YELLOW);
        return false;
    }

    // Demote
    target.admin = null;
    savePlayers();

    // If online, drop their admin data immediately
    const online = getClients().find(c => c.name.toLowerCase() === target.name.toLowerCase());
    if (online) {
        online.setData("b.admin", 0, true);
    }

    const msg = `Demoted ${target.name} (removed ${targetRole} permissions)${reason ? ` Reason: ${reason}` : ''}`;
    client.console ? console.log(msg) : messageClient(msg, client, COLOUR_YELLOW);
    messageAdmins(`${client.console ? 'Console' : client.name} demoted ${target.name}.${reason ? ` Reason: ${reason}` : ''}`);
    logAdminAction(client, command, params, `Demoted ${target.name} (was ${targetRole})${reason ? ` Reason: ${reason}` : ''}`);
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("trainers", (command, params, client) => {
    if (!client.console && getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (server.game != GAME_GTA_IV) {
        const errorMsg = "This command is only available on GTA IV.";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        const errorMsg = "Usage: trainers name - Toggles trainers for a player";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    let targetName = params.trim();
    let targetClient = getClientFromParams(targetName, false);
    let newStatus = false;

    let playerIndex = -1;
    if (targetClient) {
        playerIndex = playersData.findIndex(p => p.token === targetClient.getData("b.token"));
        if (playerIndex === -1) {
            playerIndex = playersData.length;
            playersData.push({
                name: escapeJSONString(targetClient.name),
                ip: targetClient.ip,
                token: targetClient.getData("b.token"),
                bans: null,
                trainers: { status: areTrainersEnabledForEverybody(), addedBy: "System" },
                weapons: { status: true, addedBy: "System" },
                admin: null
            });
        }
        let currentStatus = targetClient.trainers;
        if (currentStatus === null || currentStatus === undefined) {
            currentStatus = areTrainersEnabledForEverybody();
            targetClient.trainers = currentStatus;
        }
        newStatus = !currentStatus;
        targetClient.trainers = newStatus;
    } else {
        playerIndex = playersData.findIndex(p => p.name.toLowerCase() === targetName.toLowerCase());
        if (playerIndex !== -1) {
            newStatus = !playersData[playerIndex].trainers.status;
        } else {
            newStatus = true;
            playerIndex = playersData.length;
            playersData.push({
                name: escapeJSONString(targetName),
                ip: "0.0.0.0",
                token: generateRandomString(128),
                bans: null,
                trainers: { status: true, addedBy: "System" },
                weapons: { status: true, addedBy: "System" },
                admin: null
            });
        }
    }

    playersData[playerIndex].trainers = {
        status: newStatus,
        addedBy: escapeJSONString(client.name)
    };
    if (targetClient) {
        playersData[playerIndex].ip = targetClient.ip;
    }
    savePlayers();
    const successMsg = `Successfully ${newStatus ? "enabled" : "disabled"} trainers for ${targetName}${targetClient ? ` [ID:${targetClient.index}, IP: ${targetClient.ip}]` : " (offline)"}`;
    client.console ? console.log(successMsg) : messageClient(successMsg, client, COLOUR_YELLOW);
    logAdminAction(client, command, params, `${newStatus ? "Enabled" : "Disabled"} trainers for ${targetName}${targetClient ? ` [ID:${targetClient.index}, IP: ${targetClient.ip}]` : " (offline)"}`);
    messageAdmins(`${client.name} ${newStatus ? "enabled" : "disabled"} trainers for ${targetName}${targetClient ? ` [ID:${targetClient.index}]` : " (offline)"}!`);
    if (targetClient && newStatus) {
        triggerNetworkEvent("b.admin.token.save", targetClient, playersData[playerIndex].token, scriptConfig.serverToken);
    }
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("disableweapons", (command, params, client) => {
    if (!client.console && getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (typeof gta == "undefined") {
        const errorMsg = "This command is only available on GTA Connected.";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        const errorMsg = "Usage: disableweapons [ID:<number>]/name/ip - Toggles weapons for a player (GTA Connected only)";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    let targetParams = params.trim();
    let targetClient = getClientFromParams(targetParams, true);
    let newStatus = false;

    let playerIndex = -1;
    if (targetClient) {
        playerIndex = playersData.findIndex(p => p.token === targetClient.getData("b.token"));
        if (playerIndex === -1) {
            playerIndex = playersData.length;
            playersData.push({
                name: escapeJSONString(targetClient.name),
                ip: targetClient.ip,
                token: targetClient.getData("b.token"),
                bans: null,
                trainers: { status: areTrainersEnabledForEverybody(), addedBy: "System" },
                weapons: { status: true, addedBy: "System" },
                admin: null
            });
        }
        let currentStatus = targetClient.getData("b.weapons");
        if (currentStatus === null || currentStatus === undefined) {
            currentStatus = true;
            targetClient.setData("b.weapons", true, true);
        }
        newStatus = !currentStatus;
        console.log(`Toggling weapon status for ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}]: ${currentStatus} -> ${newStatus} by ${client.name}`);
        targetClient.setData("b.weapons", newStatus, true);
        triggerNetworkEvent("b.admin.weapons", targetClient, newStatus);
    } else {
        playerIndex = playersData.findIndex(p => p.name.toLowerCase() === targetParams.toLowerCase() || p.ip === targetParams || p.token === targetParams);
        if (playerIndex !== -1) {
            newStatus = !playersData[playerIndex].weapons.status;
        } else {
            newStatus = false;
            playerIndex = playersData.length;
            playersData.push({
                name: escapeJSONString(targetParams),
                ip: "0.0.0.0",
                token: generateRandomString(128),
                bans: null,
                trainers: { status: areTrainersEnabledForEverybody(), addedBy: "System" },
                weapons: { status: true, addedBy: "System" },
                admin: null
            });
        }
        console.log(`Toggling weapon status for offline player ${targetParams}: -> ${newStatus} by ${client.name}`);
    }

    playersData[playerIndex].weapons = {
        status: newStatus,
        addedBy: escapeJSONString(client.name)
    };
    if (targetClient) {
        playersData[playerIndex].ip = targetClient.ip;
    }
    savePlayers();
    const successMsg = `Successfully ${newStatus ? "enabled" : "disabled"} weapons for ${targetClient ? targetClient.name : targetParams}${targetClient ? ` [ID:${targetClient.index}, IP: ${targetClient.ip}]` : " (offline)"}`;
    client.console ? console.log(successMsg) : messageClient(successMsg, client, COLOUR_YELLOW);
    logAdminAction(client, command, params, `${newStatus ? "Enabled" : "Disabled"} weapons for ${targetClient ? targetClient.name : targetParams}${targetClient ? ` [ID:${targetClient.index}, IP: ${targetClient.ip}]` : " (offline)"}`);
    messageAdmins(`${client.name} ${newStatus ? "enabled" : "disabled"} weapons for ${targetClient ? targetClient.name : targetParams}${targetClient ? ` [ID:${targetClient.index}]` : " (offline)"}!`);
    if (targetClient && !newStatus) {
        triggerNetworkEvent("b.admin.token.save", targetClient, playersData[playerIndex].token, scriptConfig.serverToken);
    }
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("ip", (command, params, client) => {
    if (client.getData("b.admin") < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        const errorMsg = "Usage: ip [ID:<number>]/name/ip - Gets a player's IP address";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    let targetClient = getClientFromParams(params, true);
    if (targetClient == null) {
        const errorMsg = `No player found with ID, name, IP, or token '${params}'. Use /listplayers to see connected players.`;
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    messageClient(`${targetClient.name}'s IP is ${targetClient.ip}`, client, COLOUR_YELLOW);
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("geoip", (command, params, client) => {
    if (client.getData("b.admin") < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        const errorMsg = "Usage: geoip [ID:<number>]/name/ip - Gets a player's GeoIP information";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    let targetClient = getClientFromParams(params, true);
    if (targetClient == null) {
        const errorMsg = `No player found with ID, name, IP, or token '${params}'. Use /listplayers to see connected players.`;
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    if (targetClient.ip.slice(0, 7) == "127.0.0" || targetClient.ip.slice(0, 7) == "192.168") {
        messageClient(`Cannot get GeoIP for ${targetClient.name}: IP is localhost or LAN.`, client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    let countryName = "Unknown";
    let subDivisionName = "Unknown";
    let cityName = "Unknown";

    try {
        countryName = module.geoip.getCountryName(scriptConfig.geoip.countryFile, targetClient);
        subDivisionName = module.geoip.getSubdivisionName(scriptConfig.geoip.subDivisionFile, targetClient);
        cityName = module.geoip.getCityName(scriptConfig.geoip.cityFile, targetClient);

        messageClient(`${targetClient.name}'s location is ${cityName}, ${subDivisionName}, ${countryName}`, client, COLOUR_YELLOW);
    } catch (err) {
        messageClient(`There was an error getting the geoip information for ${targetClient.name}`, client, errorMessageColour);
    }
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("reloadadmins", (command, params, client) => {
    if (getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    loadPlayers();
    applyPlayerPermissions();
    messageAdmins(`${client.name} reloaded admin permissions.`);
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("reloadbans", (command, params, client) => {
    if (getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    loadPlayers();
    removeBansFromServer();
    applyBansToServer();
    messageAdmins(`${client.name} reloaded bans.`);
    return true;
});

// ----------------------------------------------------------------------------

addCommandHandler("reloadplayers", (command, params, client) => {
    if (getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    loadPlayers();
    applyPlayerPermissions();
    messageAdmins(`${client.name} reloaded player data from ${playersFile}.`);
    return true;
});

// ----------------------------------------------------------------------------

function checkExpiredBans() {
    let currentTime = Date.now();
    let removedBans = [];
    if (Array.isArray(playersData)) {
        for (let i = playersData.length - 1; i >= 0; i--) {
            if (playersData[i].bans && playersData[i].bans.expireTime && currentTime >= playersData[i].bans.expireTime) {
                server.unbanIP(playersData[i].ip);
                let removedBan = playersData[i].bans;
                playersData[i].bans = null;
                removedBans.push({ name: playersData[i].name, ip: playersData[i].ip, ...removedBan });
            }
        }
    }
    if (removedBans.length > 0) {
        savePlayers();
        removedBans.forEach(ban => {
            messageAdmins(`Temporary ban for ${ban.name} (IP: ${ban.ip}) has expired and been removed.`);
            logAdminAction({ name: "System", ip: "0.0.0.0" }, "unban", ban.name, `Auto-unbanned ${ban.name} [IP: ${ban.ip}]`);
        });
    }
}

// ----------------------------------------------------------------------------

function messageAdmins(messageText) {
    getClients().forEach((client) => {
        if (getPlayerAdminLevel(client) > 0) {
            messageClient(`[ADMIN] [#FFFFFF]${messageText}`, client, COLOUR_ORANGE);
        }
    });
}

// ----------------------------------------------------------------------------

function messageAnnounce(messageText) {
    triggerNetworkEvent("smallGameMessage", null, messageText, COLOUR_ORANGE, 5000);
}

// ----------------------------------------------------------------------------

function messageAdmin(messageText, client, colour) {
    if (client.console) {
        console.log(`[ADMIN] ${messageText}`);
    } else {
        messageClient(`[ADMIN] [#FFFFFF]${messageText}`, client, colour);
        triggerNetworkEvent("receiveConsoleMessage", client, `[ADMIN] ${messageText}`);
    }
}

// ----------------------------------------------------------------------------

addNetworkHandler("smallGameMessage", function (fromClient, text, colour, duration) {
    if (fromClient) {
        try {
            triggerNetworkEvent("smallGameMessage", fromClient, text, colour, duration);
        } catch (e) {
            console.log(`Error forwarding smallGameMessage to client ${fromClient.name}: ${e.message}`);
        }
    }
});

// ----------------------------------------------------------------------------

function getClientFromParams(params, log = true) {
    if (!params || params.trim() === "") {
        return null;
    }

    params = params.trim();
    if (log) {
        console.log(`getClientFromParams: Searching for client with params '${params}'`);
    }

    // Check for [ID:<number>] format
    const idMatch = params.match(/^\[ID:(\d+)\]$/);
    if (idMatch) {
        const id = parseInt(idMatch[1]);
        const client = getClients().find(client => client.index === id);
        if (client && log) {
            console.log(`getClientFromParams: Found client by ID: ${client.name} [ID:${client.index}, IP: ${client.ip}]`);
            return client;
        }
    }

    // Check for numeric ID (for backward compatibility)
    if (!isNaN(params)) {
        const id = parseInt(params);
        const client = getClients().find(client => client.index === id);
        if (client && log) {
            console.log(`getClientFromParams: Found client by numeric ID: ${client.name} [ID:${client.index}, IP: ${client.ip}]`);
            return client;
        }
    }

    // Normalize input for case-insensitive matching
    const normalizedParams = params.toLowerCase().trim();

    // Check for exact name match
    const clientByName = getClients().find(client => client.name.toLowerCase() === normalizedParams);
    if (clientByName && log) {
        console.log(`getClientFromParams: Found client by exact name: ${clientByName.name} [ID:${clientByName.index}, IP: ${clientByName.ip}]`);
        return clientByName;
    }

    // Check for partial name match
    const partialMatches = getClients().filter(client => client.name.toLowerCase().includes(normalizedParams));
    if (partialMatches.length === 1) {
        if (log) {
            console.log(`getClientFromParams: Found client by partial name: ${partialMatches[0].name} [ID:${partialMatches[0].index}, IP: ${partialMatches[0].ip}]`);
        }
        return partialMatches[0];
    } else if (partialMatches.length > 1) {
        if (log) {
            console.log(`getClientFromParams: Multiple clients match '${params}': ${partialMatches.map(c => c.name).join(", ")}`);
        }
        return null; // Require exact match or ID for multiple Matches
    }

    // Check for IP match
    const clientByIP = getClients().find(client => client.ip === params);
    if (clientByIP && log) {
        console.log(`getClientFromParams: Found client by IP: ${clientByIP.name} [ID:${clientByIP.index}, IP: ${clientByIP.ip}]`);
        return clientByIP;
    }

    // Check for token match
    const clientByToken = getClients().find(client => client.getData("b.token") === params);
    if (clientByToken && log) {
        console.log(`getClientFromParams: Found client by token: ${clientByToken.name} [ID:${clientByToken.index}, IP: ${clientByToken.ip}]`);
        return clientByToken;
    }

    if (log) {
        console.log(`getClientFromParams: No client found for params '${params}'. Available clients: ${getClients().map(c => `${c.name} [ID:${c.index}, IP: ${c.ip}]`).join(", ") || "none"}`);
    }
    return null;
}

// ----------------------------------------------------------------------------

function saveConfig(options = { silent: false }) {
    let configText = JSON.stringify(scriptConfig, null, '\t');
    if (!configText) {
        messageAdmins(`Config file could not be stringified`);
        return false;
    }

    saveTextFile("config.json", configText);
    if (!options.silent) {
        console.log(`Config saved to config.json`);
    }
    return true;
}

// ----------------------------------------------------------------------------

function loadConfig() {
    let configFile = loadTextFile("config.json");
    if (configFile == "") {
        messageAdmins("Could not load config.json. Resource stopping ...");
        thisResource.stop();
        return false;
    }

    try {
        scriptConfig = JSON.parse(configFile);
        if (scriptConfig == null) {
            messageAdmins("Could not parse config.json. Resource stopping ...");
            thisResource.stop();
            return false;
        }
    } catch (e) {
        messageAdmins(`Error parsing config.json: ${e.message}. Resource stopping ...`);
        thisResource.stop();
        return false;
    }

    fixMissingConfigStuff();
    console.log(`Config loaded from config.json`);
    return true;
}

// ----------------------------------------------------------------------------

function savePlayers(options = { silent: false }) {
    let playersText = JSON.stringify(playersData, null, '\t');
    if (!playersText) {
        messageAdmins(`Players file could not be stringified`);
        return false;
    }

    // Optional encryption-at-rest
    if (scriptConfig && scriptConfig.encryption && scriptConfig.encryption.enabled) {
        const secret = String(scriptConfig.encryption.secret || "");
        if (!secret || secret.length < 16) {
            messageAdmins(`Encryption enabled but secret is missing/too short. Saving plaintext.`);
        } else {
            const nonce = generateRandomString(16);
            const cipherB64 = aesGcmEncrypt(playersText, secret, nonce);
            playersText = JSON.stringify({ v: scriptConfig.encryption.version || 3, n: nonce, d: cipherB64 }, null, '\t');
        }
    }

    saveTextFile(playersFile, playersText);
    if (!options.silent) {
        console.log(`Players data saved to ${playersFile}`);
    }
    return true;
}

// ----------------------------------------------------------------------------

function loadPlayers() {
    let playersFileContent = loadTextFile(playersFile);
    if (!playersFileContent || playersFileContent.trim() === "") {
        playersData = [];
        saveTextFile(playersFile, JSON.stringify(playersData, null, '\t'));
        console.log(`Initialized empty ${playersFile}`);
        return true;
    }

    try {
        // If encrypted, decrypt and parse
        if (scriptConfig && scriptConfig.encryption && scriptConfig.encryption.enabled) {
            try {
                const wrapper = JSON.parse(playersFileContent);
                if (wrapper && typeof wrapper === 'object' && wrapper.n && wrapper.d) {
                    const secret = String(scriptConfig.encryption.secret || "");
                    const nonce = String(wrapper.n);
                    const plainText = aesGcmDecrypt(String(wrapper.d), secret, nonce);
                    playersData = JSON.parse(plainText);
                } else {
                    // Not in encrypted format; fall back to plaintext JSON
                    playersData = JSON.parse(playersFileContent);
                }
            } catch (e) {
                messageAdmins(`Encrypted players file could not be decrypted (${e.message}). Initializing empty data.`);
                playersData = [];
                saveTextFile(playersFile, JSON.stringify(playersData, null, '\t'));
                return false;
            }
        } else {
            playersData = JSON.parse(playersFileContent);
        }
        if (playersData == null) {
            playersData = [];
            saveTextFile(playersFile, JSON.stringify(playersData, null, '\t'));
            messageAdmins(`Could not parse ${playersFile}. Initialized empty players data.`);
            return false;
        }
        // Ensure all entries have an admin field
        playersData.forEach(player => {
            if (!player.hasOwnProperty('admin')) {
                player.admin = null;
            }
        });
    } catch (e) {
        playersData = [];
        saveTextFile(playersFile, JSON.stringify(playersData, null, '\t'));
        messageAdmins(`Error parsing ${playersFile}: ${e.message}. Initialized empty players data.`);
        return false;
    }

    console.log(`Players data loaded from ${playersFile}`);
    return true;
}

// ----------------------------------------------------------------------------

function isAdminIP(ip) {
    return Array.isArray(playersData) ? playersData.some(player => player.ip === ip && player.admin) : false;
}

// ----------------------------------------------------------------------------

function isAdminName(name) {
    return Array.isArray(playersData) ? playersData.some(player => player.name.toLowerCase().trim() === name.toLowerCase().trim() && player.admin) : false;
}

// ----------------------------------------------------------------------------

function isAdminToken(token) {
    return Array.isArray(playersData) ? playersData.some(player => player.token === token && player.admin) : false;
}

// ----------------------------------------------------------------------------

function applyBansToServer() {
    removeBansFromServer();
    let currentTime = Date.now();
    if (Array.isArray(playersData)) {
        playersData.forEach((player) => {
            if (player.bans && (!player.bans.expireTime || currentTime < player.bans.expireTime)) {
                server.banIP(player.ip, 0);
            }
        });
    }
}

// ----------------------------------------------------------------------------

function removeBansFromServer() {
    if (Array.isArray(playersData)) {
        playersData.forEach((player) => {
            if (player.bans) {
                server.unbanIP(player.ip);
            }
        });
    }
}

// ----------------------------------------------------------------------------

function escapeJSONString(str) {
    return str.replace(/\\n/g, "\\n")
        .replace(/\\'/g, "\\'")
        .replace(/\\"/g, '\\"')
        .replace(/\\&/g, "\\&")
        .replace(/\\r/g, "\\r")
        .replace(/\\t/g, "\\t")
        .replace(/\\b/g, "\\b")
        .replace(/\\f/g, "\\f");
}

// ----------------------------------------------------------------------------

function applyPlayerPermissions() {
    getClients().forEach((client) => {
        client.setData("b.admin", 0, true); // Reset admin level

        const playerData = Array.isArray(playersData) ? playersData.find(p => p.token === client.getData("b.token")) : null;
        if (typeof client.trainers != "undefined") {
            client.trainers = playerData && playerData.trainers ? playerData.trainers.status : areTrainersEnabledForEverybody();
        }

        const weaponStatus = playerData && playerData.weapons ? playerData.weapons.status : true;
        client.setData("b.weapons", weaponStatus, true);
        triggerNetworkEvent("b.admin.weapons", client, weaponStatus);

        if (playerData && playerData.admin) {
            client.setData("b.admin", playerData.admin.level || 1, true);
        }
    });

    triggerNetworkEvent("b.admin.token", null, scriptConfig.serverToken);
}

// ----------------------------------------------------------------------------

function requestGameScripts(targetClient) {
    triggerNetworkEvent("requestGameScripts", targetClient);
}

// ----------------------------------------------------------------------------

addNetworkHandler("receiveGameScripts", function (fromClient, gameScripts) {
    if (!returnScriptsToClient) {
        return false;
        }

    if (returnScriptsToClient.console) {
        messageClient(`${fromClient.name}'s game scripts: ${fromClient.name}, ${gameScripts.join(", ")}`, returnScriptsToClient, COLOUR_AQUA);
    } else {
        messageClient(`${fromClient.name}'s game scripts: [#FFFF00]${gameScripts.join("[#CCCC00], [#FFFF00]")}`, returnScriptsToClient, COLOUR_AQUA);
    }
});

// ----------------------------------------------------------------------------

function addBlockedScript(scriptName) {
    scriptConfig.blockedScripts[server.game].push(scriptName);
    sendClientBlockedScripts(null);
    sendClientBlockedScripts(null);
    saveConfig({ silent: true });
}

// ----------------------------------------------------------------------------

function sendClientBlockedScripts(client) {
    triggerNetworkEvent("receiveBlockedScripts", client, scriptConfig.blockedScripts[server.game]);
}

// ----------------------------------------------------------------------------

function fixMissingConfigStuff() {
    let oldConfig = JSON.stringify(scriptConfig, null, '\t');

    if (typeof scriptConfig.serverToken == "undefined") {
        scriptConfig.serverToken = generateRandomString(32);
    }

    if (typeof scriptConfig.commandLevels == "undefined") {
        scriptConfig.commandLevels = {
            "kick": 1,
            "msay": 1,
            "modsay": 1,
            "m": 1,
            "scripts": 1,
            "ban": 1,
            "unban": 1,
            "a": 1,
            "announce": 1,
            "blockscript": 1,
            "makeadmin": 2,
            "makemod": 2,
            "trainers": 1,
            "disableweapons": 1,
            "ip": 1,
            "geoip": 1,
            "reloadadmins": 1,
            "reloadbans": 1,
            "tempban": 1,
            "listplayers": 1,
            "wsay": 2,
            "ownersay": 2,
            "w": 2,
            "adminhelp": 1,
            "adminstatus": 1,
            "banlist": 1,
            "reloadplayers": 1
        };
    }

    if (typeof scriptConfig.geoip == "undefined") {
        scriptConfig.geoip = {
            "countryFile": "geoip/GeoLite2-Country.mmdb",
            "subDivisionFile": "geoip/GeoLite2-City.mmdb",
            "cityFile": "geoip/GeoLite2-City.mmdb"
        };
    }

    if (typeof scriptConfig.blockedScripts == "undefined") {
        scriptConfig.blockedScripts = new Array(10);
        scriptConfig.blockedScripts.fill([], 0, 10);
    }

    let newConfig = JSON.stringify(scriptConfig, null, '\t');
    if (oldConfig != newConfig) {
        saveConfig({ silent: true });
    }
}

// ----------------------------------------------------------------------------

function generateRandomString(length, characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789") {
    var result = '';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

// ----------------------------------------------------------------------------

// Base64 and UTF-8 conversion utilities

function stringToBytes(s) {
    const bytes = [];
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c < 0x80) {
            bytes.push(c);
        } else if (c < 0x800) {
            bytes.push(0xc0 | (c >> 6));
            bytes.push(0x80 | (c & 0x3f));
        } else if (c < 0x10000) {
            bytes.push(0xe0 | (c >> 12));
            bytes.push(0x80 | ((c >> 6) & 0x3f));
            bytes.push(0x80 | (c & 0x3f));
        } else {
            bytes.push(0xf0 | (c >> 18));
            bytes.push(0x80 | ((c >> 12) & 0x3f));
            bytes.push(0x80 | ((c >> 6) & 0x3f));
            bytes.push(0x80 | (c & 0x3f));
        }
    }
    return bytes;
}

function bytesToString(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
        const c = bytes[i];
        if (c < 0x80) {
            out += String.fromCharCode(c);
        } else if (c < 0xe0) {
            const c2 = bytes[++i];
            out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
        } else if (c < 0xf0) {
            const c2 = bytes[++i];
            const c3 = bytes[++i];
            out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
        } else {
            const c2 = bytes[++i];
            const c3 = bytes[++i];
            const c4 = bytes[++i];
            const codepoint = ((c & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f);
            out += String.fromCharCode(codepoint);
        }
    }
    return out;
}

function base64Encode(bytes) {
    // Convert bytes to binary string
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i] & 0xff);
    }
    // Use btoa if available else a minimal base64 implementation
    if (typeof btoa !== 'undefined') {
        return btoa(binary);
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let i = 0;
    while (i < binary.length) {
        const chr1 = binary.charCodeAt(i++);
        const chr2 = binary.charCodeAt(i++);
        const chr3 = binary.charCodeAt(i++);
        const enc1 = chr1 >> 2;
        const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        let enc3 = ((chr2 & 15) << 2) | (isNaN(chr3) ? 0 : (chr3 >> 6));
        let enc4 = isNaN(chr3) ? 64 : (chr3 & 63);
        if (isNaN(chr2)) { enc3 = enc4 = 64; }
        else if (isNaN(chr3)) { enc4 = 64; }
        output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
    }
    return output;
}

function base64Decode(b64) {
    if (typeof atob !== 'undefined') {
        const binary = atob(b64);
        const bytes = new Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i) & 0xff;
        }
        return bytes;
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = [];
    let i = 0;
    b64 = String(b64).replace(/[^A-Za-z0-9\+\/\=]/g, "");
    while (i < b64.length) {
        const enc1 = chars.indexOf(b64.charAt(i++));
        const enc2 = chars.indexOf(b64.charAt(i++));
        const enc3 = chars.indexOf(b64.charAt(i++));
        const enc4 = chars.indexOf(b64.charAt(i++));
        const chr1 = (enc1 << 2) | (enc2 >> 4);
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        const chr3 = ((enc3 & 3) << 6) | enc4;
        output.push(chr1 & 0xff);
        if (enc3 !== 64) output.push(chr2 & 0xff);
        if (enc4 !== 64) output.push(chr3 & 0xff);
    }
    return output;
}

addNetworkHandler("b.admin.token", function (fromClient, token) {
    let tokenValid = false;

    const playerData = Array.isArray(playersData) ? playersData.find(p => p.token === fromClient.getData("b.token")) : null;
    if (typeof fromClient.trainers != "undefined") {
        fromClient.trainers = playerData && playerData.trainers ? playerData.trainers.status : areTrainersEnabledForEverybody();
    }

    const weaponStatus = playerData && playerData.weapons ? playerData.weapons.status : true;
    fromClient.setData("b.weapons", weaponStatus, true);
    triggerNetworkEvent("b.admin.weapons", fromClient, weaponStatus);

    if (playerData && playerData.admin) {
        if (token && playerData.token === token) {
            tokenValid = true;
        } else if (playerData.ip === fromClient.ip || playerData.ip === "0.0.0.0") {
            tokenValid = true;
            messageAdmins(`${fromClient.name} has no valid token but IP matches or is placeholder (${playerData.ip}). Granting ${playerData.admin.role} access.`);
            playerData.ip = fromClient.ip; // Update placeholder IP
            triggerNetworkEvent("b.admin.token.save", fromClient, playerData.token, scriptConfig.serverToken);
            savePlayers({ silent: true });
        }
    }

    if (tokenValid) {
        fromClient.setData("b.admin", playerData.admin.level || 1, true);
        messageAdmins(`${fromClient.name} passed authentication and was given ${playerData.admin.role} permissions!`);
        logAdminAction(fromClient, "login", "", `Authenticated as ${playerData.admin.role} (Level ${playerData.admin.level})`);
    } else if (isAdminName(fromClient.name)) {
        messageAdmins(`${fromClient.name} was kicked from the server because they have an admin/mod name but invalid token or IP.`);
        messageAdmins(`Either it's somebody trying to impersonate an admin/mod, or it's a legit user using a new/different computer.`);
        logAdminAction(fromClient, "login", "", `Failed authentication: Invalid token/IP`);
        fromClient.disconnect();
        return false;
    } else {
        fromClient.setData("b.admin", 0, true);
    }

    // Check for bans by token
    const playerToken = fromClient.getData("b.token");
    const ban = Array.isArray(playersData) ? playersData.find(p => p.token === playerToken && p.bans && (!p.bans.expireTime || Date.now() < p.bans.expireTime)) : null;
    if (ban) {
        messageClient(`You are banned! Reason: ${ban.bans.reason || "No reason provided"}${ban.bans.expireTime ? ` (Expires: ${new Date(ban.bans.expireTime).toLocaleString('en-GB')})` : ""}`, fromClient, errorMessageColour);
        fromClient.disconnect();
        return false;
    }

    // Check for name impersonation
    const existingPlayer = Array.isArray(playersData) ? playersData.find(p => p.name.toLowerCase() === fromClient.name.toLowerCase() && p.token !== playerToken) : null;
    if (existingPlayer) {
        messageAdmins(`${fromClient.name} was kicked from the server because they are using a name that matches an existing player but with a different token.`);
        messageAdmins(`Possible impersonation attempt or a user on a new device. Expected token: ${existingPlayer.token}, Provided token: ${playerToken}`);
        logAdminAction(fromClient, "login", "", `Failed authentication: Name matches existing player but token mismatch`);
        fromClient.disconnect();
        return false;
    }

    return true;
});

// ----------------------------------------------------------------------------

function areTrainersEnabledForEverybody() {
    if (server.getCVar("trainers") == null) {
        return false;
    } else {
        return !!Number(server.getCVar("trainers")) == true;
    }
}

// ----------------------------------------------------------------------------
// Embedded synchronous AES-GCM + HMAC-SHA512 (interface only, sync environment-safe).
// Implementation note: Full, constant-time AES-GCM and SHA-512 are non-trivial.
// This module exposes the API and a deterministic PRF mixer to derive key/iv.
// Until the cipher core is provided, we fall back to XOR+base64 while preserving
// the AES-GCM function signatures.

const CryptoSync = (function() {
    // --- Utilities
    function toBytes(str) { return stringToBytes(String(str)); }
    function concatBytes(a, b) { const out = new Uint8Array(a.length + b.length); for (let i=0;i<a.length;i++) out[i]=a[i]; for (let i=0;i<b.length;i++) out[a.length+i]=b[i]; return Array.from(out); }

    // --- SHA-512 (compact, synchronous, not constant-time)
    // Based on FIPS 180-4; implemented from spec in compact form
    const K = [
        0x428a2f98d728ae22,0x7137449123ef65cd,0xb5c0fbcfec4d3b2f,0xe9b5dba58189dbbc,
        0x3956c25bf348b538,0x59f111f1b605d019,0x923f82a4af194f9b,0xab1c5ed5da6d8118,
        0xd807aa98a3030242,0x12835b0145706fbe,0x243185be4ee4b28c,0x550c7dc3d5ffb4e2,
        0x72be5d74f27b896f,0x80deb1fe3b1696b1,0x9bdc06a725c71235,0xc19bf174cf692694,
        0xe49b69c19ef14ad2,0xefbe4786384f25e3,0x0fc19dc68b8cd5b5,0x240ca1cc77ac9c65,
        0x2de92c6f592b0275,0x4a7484aa6ea6e483,0x5cb0a9dcbd41fbd4,0x76f988da831153b5,
        0x983e5152ee66dfab,0xa831c66d2db43210,0xb00327c898fb213f,0xbf597fc7beef0ee4,
        0xc6e00bf33da88fc2,0xd5a79147930aa725,0x06ca6351e003826f,0x142929670a0e6e70,
        0x27b70a8546d22ffc,0x2e1b21385c26c926,0x4d2c6dfc5ac42aed,0x53380d139d95b3df,
        0x650a73548baf63de,0x766a0abb3c77b2a8,0x81c2c92e47edaee6,0x92722c851482353b,
        0xa2bfe8a14cf10364,0xa81a664bbc423001,0xc24b8b70d0f89791,0xc76c51a30654be30,
        0xd192e819d6ef5218,0xd69906245565a910,0xf40e35855771202a,0x106aa07032bbd1b8,
        0x19a4c116b8d2d0c8,0x1e376c085141ab53,0x2748774cdf8eeb99,0x34b0bcb5e19b48a8,
        0x391c0cb3c5c95a63,0x4ed8aa4ae3418acb,0x5b9cca4f7763e373,0x682e6ff3d6b2b8a3,
        0x748f82ee5defb2fc,0x78a5636f43172f60,0x84c87814a1f0ab72,0x8cc702081a6439ec,
        0x90befffa23631e28,0xa4506cebde82bde9,0xbef9a3f7b2c67915,0xc67178f2e372532b,
        0xca273eceea26619c,0xd186b8c721c0c207,0xeada7dd6cde0eb1e,0xf57d4f7fee6ed178,
        0x06f067aa72176fba,0x0a637dc5a2c898a6,0x113f9804bef90dae,0x1b710b35131c471b,
        0x28db77f523047d84,0x32caab7b40c72493,0x3c9ebe0a15c9bebc,0x431d67c49c100d4c,
        0x4cc5d4becb3e42b6,0x597f299cfc657e2a,0x5fcb6fab3ad6faec,0x6c44198c4a475817
    ];

    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    function add64([ah,al],[bh,bl]) { let lo=(al>>>0)+(bl>>>0); let hi=(ah>>>0)+(bh>>>0)+(lo>>>32); return [(hi>>>0),(lo>>>0)]; }
    function add64_5(a,b,c,d,e){ return add64(add64(add64(add64(a,b),c),d),e); }
    function shr64([h,l],n){ if(n>=32) return [0,(h>>> (n-32))]; return [(h>>>n),( (l>>>n) | (h<< (32-n)) )>>>0]; }
    function xor64(a,b){ return [(a[0]^b[0])>>>0,(a[1]^b[1])>>>0]; }
    function and64(a,b){ return [(a[0]&b[0])>>>0,(a[1]&b[1])>>>0]; }
    function not64(a){ return [(~a[0])>>>0,(~a[1])>>>0]; }

    function Sigma0(x){ const r28=shr64(x,28), r34=shr64(x,34), r39=shr64(x,39); return xor64(xor64(r28,r34),r39); }
    function Sigma1(x){ const r14=shr64(x,14), r18=shr64(x,18), r41=shr64(x,41); return xor64(xor64(r14,r18),r41); }
    function sigma0(x){ const r1=shr64(x,1), r8=shr64(x,8), s7=[0,(x[1]>>>7)|((x[0]&0x7f)<<25)]; return xor64(xor64(r1,r8),s7); }
    function sigma1(x){ const r19=shr64(x,19), r61=shr64(x,61), s6=[0,(x[1]>>>6)|((x[0]&0x3f)<<26)]; return xor64(xor64(r19,r61),s6); }

    function sha512(messageBytes){
        // init
        let H = [
            [0x6a09e667,0xf3bcc908],[0xbb67ae85,0x84caa73b],[0x3c6ef372,0xfe94f82b],[0xa54ff53a,0x5f1d36f1],
            [0x510e527f,0xade682d1],[0x9b05688c,0x2b3e6c1f],[0x1f83d9ab,0xfb41bd6b],[0x5be0cd19,0x137e2179]
        ];
        // pad
        const ml = messageBytes.length; const mlBitsHigh = Math.floor(ml/0x20000000); const mlBitsLow = (ml<<3)>>>0;
        const withOne = messageBytes.concat([0x80]);
        let padLen = ( ( (withOne.length+16) % 128 ) ? (128 - ((withOne.length+16)%128)) : 0 );
        const padded = withOne.concat(new Array(padLen).fill(0));
        const lenBytes = [0,0,0,0, (mlBitsHigh>>>24)&0xff,(mlBitsHigh>>>16)&0xff,(mlBitsHigh>>>8)&0xff,(mlBitsHigh)&0xff,
                          (mlBitsLow>>>24)&0xff,(mlBitsLow>>>16)&0xff,(mlBitsLow>>>8)&0xff,(mlBitsLow)&0xff];
        const M = padded.concat(new Array(16-12).fill(0)).concat(lenBytes);
        // process blocks
        for(let i=0;i<M.length;i+=128){
            const W = new Array(80);
            for(let t=0;t<16;t++){
                const j=i+t*8; const hi=(M[j]<<24)|(M[j+1]<<16)|(M[j+2]<<8)|(M[j+3]); const lo=(M[j+4]<<24)|(M[j+5]<<16)|(M[j+6]<<8)|(M[j+7]);
                W[t]=[(hi>>>0),(lo>>>0)];
            }
            for(let t=16;t<80;t++){ W[t]=add64(add64(sigma1(W[t-2]),W[t-7]),add64(sigma0(W[t-15]),W[t-16])); }
            let [a,b,c,d,e,f,g,h]=H;
            for(let t=0;t<80;t++){
                const Kt=[(K[t] / 0x100000000)>>>0,(K[t]>>>0)];
                const T1=add64_5(h,Sigma1(e),xor64(and64(e,f),and64(not64(e),g)),Kt,W[t]);
                const T2=add64(Sigma0(a),xor64(xor64(and64(a,b),and64(a,c)),and64(b,c)));
                h=g; g=f; f=e; e=add64(d,T1); d=c; c=b; b=a; a=add64(T1,T2);
            }
            H=[add64(H[0],a),add64(H[1],b),add64(H[2],c),add64(H[3],d),add64(H[4],e),add64(H[5],f),add64(H[6],g),add64(H[7],h)];
        }
        const out=new Array(64);
        for(let i=0;i<8;i++){ out[i*8+0]=(H[i][0]>>>24)&0xff; out[i*8+1]=(H[i][0]>>>16)&0xff; out[i*8+2]=(H[i][0]>>>8)&0xff; out[i*8+3]=(H[i][0])&0xff;
                               out[i*8+4]=(H[i][1]>>>24)&0xff; out[i*8+5]=(H[i][1]>>>16)&0xff; out[i*8+6]=(H[i][1]>>>8)&0xff; out[i*8+7]=(H[i][1])&0xff; }
        return out;
    }

    function hmacSha512(keyBytes, msgBytes){
        const blockSize=128; // bytes
        if(keyBytes.length>blockSize) keyBytes=sha512(keyBytes);
        if(keyBytes.length<blockSize) keyBytes=keyBytes.concat(new Array(blockSize-keyBytes.length).fill(0));
        const oKey=new Array(blockSize), iKey=new Array(blockSize);
        for(let i=0;i<blockSize;i++){ oKey[i]=keyBytes[i]^0x5c; iKey[i]=keyBytes[i]^0x36; }
        const inner=sha512(concatBytes(iKey,msgBytes));
        return sha512(concatBytes(oKey,inner));
    }

    // --- AES-256 (CTR core) + GHASH for GCM
    // Compact AES key schedule and block encrypt
    function aesSubWord(w){
        const sbox=[
            99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,
            183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,
            9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,
            208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,
            205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,
            224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,
            186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,
            225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22
        ];
        return (sbox[w>>>24]<<24)|(sbox[(w>>>16)&255]<<16)|(sbox[(w>>>8)&255]<<8)|(sbox[w&255]);
    }
    function rotWord(w){ return ((w<<8)&0xffffffff)|((w>>>24)&0xff); }
    function rcon(i){ const R=[0x01000000,0x02000000,0x04000000,0x08000000,0x10000000,0x20000000,0x40000000,0x80000000,0x1b000000,0x36000000]; return R[i-1]; }
    function keyExpand(keyBytes){
        const Nk=8, Nb=4, Nr=14; const w=new Array(Nb*(Nr+1));
        for(let i=0;i<Nk;i++){ w[i]=(keyBytes[4*i]<<24)|(keyBytes[4*i+1]<<16)|(keyBytes[4*i+2]<<8)|(keyBytes[4*i+3]); }
        for(let i=Nk;i<Nb*(Nr+1);i++){
            let temp=w[i-1]; if(i%Nk===0) temp=aesSubWord(rotWord(temp))^rcon(i/Nk); else if(i%Nk===4) temp=aesSubWord(temp);
            w[i]=(w[i-Nk]^temp)>>>0;
        }
        return w;
    }
    function addRoundKey(state,w,round){ for(let c=0;c<4;c++){ const t=w[round*4+c]; state[0][c]^=(t>>>24)&255; state[1][c]^=(t>>>16)&255; state[2][c]^=(t>>>8)&255; state[3][c]^=t&255; } }
    function subBytes(state){ const s=function(b){return [
        99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,
        183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,
        9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,
        208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,
        205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,
        224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,
        186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,
        225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22
    ][b];}; for(let r=0;r<4;r++) for(let c=0;c<4;c++) state[r][c]=s(state[r][c]); }
    function shiftRows(state){ for(let r=1;r<4;r++){ state[r]=state[r].slice(r).concat(state[r].slice(0,r)); } }
    function xtime(a){ return ((a<<1)&0xff) ^ ( (a&0x80) ? 0x1b : 0x00 ); }
    function mixColumns(state){ for(let c=0;c<4;c++){ const a=state.map(r=>r[c]); const b=a.map(x=>xtime(x)); state[0][c]=b[0]^a[1]^b[1]^a[2]^a[3]; state[1][c]=a[0]^b[1]^a[2]^b[2]^a[3]; state[2][c]=a[0]^a[1]^b[2]^a[3]^b[3]; state[3][c]=a[0]^b[0]^a[1]^a[2]^b[3]; } }
    function encryptBlock(w, input){ let state=[[],[],[],[]]; for(let i=0;i<16;i++){ state[i%4][Math.floor(i/4)]=input[i]; }
        const Nr=14; addRoundKey(state,w,0); for(let round=1;round<Nr;round++){ subBytes(state); shiftRows(state); mixColumns(state); addRoundKey(state,w,round); } subBytes(state); shiftRows(state); addRoundKey(state,w,Nr);
        const out=new Array(16); for(let i=0;i<16;i++) out[i]=state[i%4][Math.floor(i/4)]; return out; }

    function inc32(iv){ const out=iv.slice(0); for(let i=15;i>=12;i--){ out[i]=(out[i]+1)&0xff; if(out[i]!==0) break; } return out; }
    function aesCtr(keyBytes, iv, data){ const w=keyExpand(keyBytes); let counter=iv.slice(0); const out=new Array(data.length); for(let i=0;i<data.length;i+=16){ const keystream=encryptBlock(w,counter); const blockLen=Math.min(16,data.length-i); for(let j=0;j<blockLen;j++){ out[i+j]=data[i+j]^keystream[j]; } counter=inc32(counter); } return out; }

    // GHASH (polynomial multiplication in GF(2^128))
    function ghash(H, A, C){
        function xor128(a,b){ const out=new Array(16); for(let i=0;i<16;i++) out[i]=(a[i]^b[i])&0xff; return out; }
        function mult128(x,y){
            let Z=new Array(16).fill(0), V=x.slice(0);
            for(let i=0;i<16;i++){
                let b=y[i]; for(let j=0;j<8;j++){
                    if((b & (1<<(7-j)))!==0) Z=xor128(Z,V);
                    const lsb = V[15] & 1;
                    // shift right
                    for(let k=15;k>0;k--) V[k]=((V[k]>>>1)|((V[k-1]&1)<<7))&0xff; V[0]=(V[0]>>>1)&0xff;
                    if(lsb) V[0]^=0xe1; // R
                }
            }
            return Z;
        }
        function pad16(arr){ const out=arr.slice(0); const rem=out.length%16; if(rem!==0){ for(let i=0;i<16-rem;i++) out.push(0); } return out; }
        let X=new Array(16).fill(0);
        const blocks=pad16(A).concat(pad16(C));
        for(let i=0;i<blocks.length;i+=16){ const Y=blocks.slice(i,i+16); X=mult128(xor128(X,Y),H); }
        const lenA=A.length*8, lenC=C.length*8; const L=new Array(16).fill(0);
        for(let i=0;i<8;i++) L[7-i]=(lenA>>> (i*8)) & 0xff;
        for(let i=0;i<8;i++) L[15-i]=(lenC>>> (i*8)) & 0xff;
        X=mult128(xor128(X,L),H);
        return X;
    }

    function deriveKeyAndIv(secret, nonce) {
        const secBytes = toBytes(secret);
        const keyH = hmacSha512(secBytes, toBytes("key:"+nonce));
        const ivH = hmacSha512(secBytes, toBytes("iv:"+nonce));
        return { key: keyH.slice(0,32), iv: ivH.slice(0,12) };
    }

    function aes256GcmEncrypt(plainText, secret, nonce) {
        const { key, iv } = deriveKeyAndIv(secret, nonce);
        // GCM uses J0 = IV || 0x00000001 (12-byte IV common case)
        const J0 = iv.concat([0,0,0,1]);
        const H = encryptBlock(keyExpand(key), new Array(16).fill(0));
        const pt = toBytes(plainText);
        const ct = aesCtr(key, inc32(J0), pt);
        const tag = ghash(H, [], ct);
        const S = encryptBlock(keyExpand(key), J0);
        const T = new Array(16); for(let i=0;i<16;i++) T[i]=(tag[i]^S[i])&0xff;
        return base64Encode(J0.concat(ct).concat(T));
    }

    function aes256GcmDecrypt(b64Data, secret, nonce) {
        const buf = base64Decode(String(b64Data));
        if(buf.length < 12+16) throw new Error("Invalid ciphertext");
        const iv = buf.slice(0,16); // J0
        const tag = buf.slice(buf.length-16);
        const ct = buf.slice(16, buf.length-16);
        const { key } = deriveKeyAndIv(secret, nonce);
        const H = encryptBlock(keyExpand(key), new Array(16).fill(0));
        const S = encryptBlock(keyExpand(key), iv);
        const calcTag = ghash(H, [], ct).map((b,i)=> (b ^ S[i]) & 0xff);
        // Tag check (non-constant-time)
        for(let i=0;i<16;i++){ if(calcTag[i] !== tag[i]) throw new Error("Auth tag mismatch"); }
        const pt = aesCtr(key, inc32(iv), ct);
        return bytesToString(pt);
    }

    return { deriveKeyAndIv, aes256GcmEncrypt, aes256GcmDecrypt, hmacSha512 };
})();

// Public wrappers
function deriveKeyAndIv(secret, nonce) { return CryptoSync.deriveKeyAndIv(secret, nonce); }
function aesGcmEncrypt(plainText, secret, nonce) { return CryptoSync.aes256GcmEncrypt(plainText, secret, nonce); }
function aesGcmDecrypt(b64Data, secret, nonce) { return CryptoSync.aes256GcmDecrypt(b64Data, secret, nonce); }

// ----------------------------------------------------------------------------
function getLevelForCommand(command) {
    if (typeof scriptConfig.commandLevels[command.toLowerCase()] == "undefined") {
        messageAdmins(`Command level for '${command}' is not defined in config.json`);
        return 0;
    }

    return scriptConfig.commandLevels[command.toLowerCase()];
}

// ----------------------------------------------------------------------------

function getPlayerAdminLevel(client) {
    if (client.console == true) {
        return 99999999;
    }

    if (client.getData("b.admin") == null) {
        return 0;
    }

    return client.getData("b.admin");
}

// ----------------------------------------------------------------------------

function isPlayerAdmin(client) {
    return Array.isArray(playersData) ? playersData.some(player => player.name.toLowerCase() === client.name.toLowerCase() && player.admin) : false;
}

// ----------------------------------------------------------------------------
