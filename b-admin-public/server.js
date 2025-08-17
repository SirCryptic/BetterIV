"use strict";

// ----------------------------------------------------------------------------

let scriptConfig = null;
let playersData = null;
let logMessagePrefix = "ADMIN:";
let returnScriptsToClient = null;
let joinAttempts = new Map();
const errorMessageColour = COLOUR_RED; // Define error message color
const adminLogFile = "log.json"; // File for admin command logs
const playersFile = "players.json"; // File for player data

// ----------------------------------------------------------------------------
bindEventHandler("onResourceStart", thisResource, (event, resource) => {
    loadConfig();
    loadPlayers();
    server.unbanAllIPs(); // Clear server ban list
    applyBansToServer(); // Reapply from players.json
    applyPlayerPermissions();
    collectAllGarbage();

    // Start timer to check for expired temp bans
    setInterval(checkExpiredBans, 60000); // Check every minute

    // Initialize admin log file
    let logFileContent = loadTextFile(adminLogFile);
    if (!logFileContent || logFileContent.trim() === "") {
        saveTextFile(adminLogFile, JSON.stringify([{ timestamp: new Date().toISOString(), client: "System", ip: "0.0.0.0", command: "server", params: "", details: "Server started" }], null, '\t'));
    } else {
        try {
            JSON.parse(logFileContent);
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
    event.preventDefault();
    if (!client || !chatMessage) return false;

    const processedMessage = processEmotes(chatMessage);
    const playerColour = client.getData("b.colour") || COLOUR_WHITE;
    const playerName = client.getData("b.name") || client.name || "Unknown";
    const formattedMessage = `${playerName}: [#FFFFFF]${processedMessage}`;

    console.log(`[CHAT] ${client.name}: ${processedMessage}`);

    getClients().forEach((otherClient) => {
        // Send entire message in one color (e.g., player's color)
        messageClient(formattedMessage, otherClient, playerColour);
    });

    return false;
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
    console.log(`CONNECT: ${client.name} (${client.ip}) is attempting to connect`);

    // Check if username is already taken by another connected client
    const existingClient = getClients().find(c => c.index !== client.index && c.name.toLowerCase() === client.name.toLowerCase());
    if (existingClient) {
        messageClient(`Sorry, this username ${client.name} is already taken, please choose something else.`, client, errorMessageColour);
        client.disconnect();
        messageAdmins(`Player ${client.name} [IP: ${client.ip}] was disconnected: Username already taken by ID:${existingClient.index}.`);
        logAdminAction(client, "join_attempt", "", `Disconnected due to duplicate username ${client.name}`);
        return;
    }

    // Rate limiting: Track join attempts per IP
    const ip = client.ip;
    let attempts = joinAttempts.get(ip) || 0;
    joinAttempts.set(ip, attempts + 1);
    setTimeout(() => joinAttempts.set(ip, (joinAttempts.get(ip) || 1) - 1), 60000); // Reset after 1 min
    if (attempts > 5) {
        messageClient("Too many join attempts. Please try again later.", client, errorMessageColour);
        client.disconnect();
        messageAdmins(`Rate limit hit for IP ${ip} (${client.name}). Possible spam or evasion attempt.`);
        logAdminAction(client, "join_attempt", "", `Rate limit exceeded for IP ${ip}`);
        return;
    }

    // Check for bans (single IP or range)
    const currentTime = Date.now();
    const matchingBan = playersData.find(p => p.bans && (!p.bans.expireTime || currentTime < p.bans.expireTime) && isIPInRange(client.ip, p.ip));
    if (matchingBan) {
        messageClient(`You are banned! Reason: ${matchingBan.bans.reason} (By: ${matchingBan.bans.admin})${matchingBan.bans.expireTime ? ` Expires: ${new Date(matchingBan.bans.expireTime).toLocaleString('en-GB')}` : ""}`, client, errorMessageColour);
        server.banIP(client.ip, 0); // Ban exact IP for redundancy
        client.disconnect();
        messageAdmins(`Banned player ${client.name} [IP: ${client.ip}] attempted to join (matched ${matchingBan.name || matchingBan.ip}, Reason: ${matchingBan.bans.reason}).`);
        logAdminAction(client, "join_attempt", "", `Banned join attempt (matched ${matchingBan.name || matchingBan.ip}, Reason: ${matchingBan.bans.reason})`);
        return;
    }

    // Trigger token request from client
    triggerNetworkEvent("b.admin.token", client, scriptConfig.serverToken);
});

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
            if (cmd === "kick") usage = "/kick [ID:<number>]/name/ip/token";
            else if (cmd === "ban") usage = "/ban [ID:<number>]/name/ip/token [reason]";
            else if (cmd === "tempban") usage = "/tempban [ID:<number>]/name/ip/token <minutes> [reason]";
            else if (cmd === "unban") usage = "/unban name/ip/token";
            else if (cmd === "msay" || cmd === "modsay" || cmd === "m") usage = "/msay <message>";
            else if (cmd === "wsay" || cmd === "ownersay" || cmd === "w") usage = "/wsay <message>";
            else if (cmd === "a") usage = "/a <message>";
            else if (cmd === "announce") usage = "/announce <message>";
            else if (cmd === "makeadmin") usage = "/makeadmin <username>";
            else if (cmd === "makemod") usage = "/makemod <username>";
            else if (cmd === "demote") usage = "/demote [ID:<number>]/name/ip/token";
            else if (cmd === "scripts") usage = "/scripts [ID:<number>]/name/ip/token";
            else if (cmd === "blockscript") usage = "/blockscript <script>";
            else if (cmd === "trainers") usage = "/trainers name";
            else if (cmd === "disableweapons") usage = "/disableweapons [ID:<number>]/name/ip/token";
            else if (cmd === "ip") usage = "/ip [ID:<number>]/name/ip/token";
            else if (cmd === "geoip") usage = "/geoip [ID:<number>]/name/ip/token";
            else if (cmd === "banlist") usage = "/banlist";
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
        { usage: "kick [ID:<number>]/name/ip/token", description: "Kicks a player from the server" },
        { usage: "ban [ID:<number>]/name/ip/token [reason]", description: "Permanently bans a player by ID, name, IP, or token" },
        { usage: "tempban [ID:<number>]/name/ip/token <minutes> [reason]", description: "Temporarily bans a player for specified minutes" },
        { usage: "demote [ID:<number>]/name/ip/token", description: "Demotes an admin/mod to level 0" },
        { usage: "makeadmin [ID:<number>]/name/ip/token", description: "Makes Player Admin level 2" },
        { usage: "makemod [ID:<number>]/name/ip/token", description: "Makes Player Moderator level 1" },
        { usage: "unban name/ip/token", description: "Removes a ban by player name, IP, or token" },
        { usage: "banlist", description: "Lists all active bans with details" },
        { usage: "trainers name", description: "Toggles trainers for a player" },
        { usage: "disableweapons [ID:<number>]/name/ip/token", description: "Toggles weapons for a player" },
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
        const errorMsg = "Usage: kick [ID:<number>]/name/ip/token - Kicks a player from the server";
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
        const errorMsg = "Usage: scripts [ID:<number>]/name/ip/token - Requests game scripts for a player";
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
        const errorMsg = "Usage: ban [ID:<number>]/name/ip/token/range [reason] - Bans a player or IP range forever";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    let splitParams = params.split(" ");
    let targetParams = splitParams[0];
    let reasonParams = splitParams.slice(1).join(" ");
    let isRange = targetParams.includes('/') || targetParams.includes('*');

    if (!reasonParams) {
        const errorMsg = "Reason is required for bans.";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    const duration = 999999999; // minutes (~1900 years)
    const expireTime = Date.now() + (duration * 60 * 1000);

    if (isRange) {
        if (targetParams.includes('/') && !isValidCIDR(targetParams)) {
            messageClient("Invalid CIDR range (bits must be 0-32).", client, errorMessageColour);
            return false;
        }
        playersData.push({
            name: `RangeBan_${targetParams.replace(/[^a-z0-9]/gi, '_')}`,
            ip: targetParams,
            token: generateRandomString(128),
            bans: {
                reason: escapeJSONString(reasonParams),
                admin: escapeJSONString(client.console ? "Console" : client.name),
                timeStamp: new Date().toLocaleDateString('en-GB'),
                expireTime: expireTime
            },
            trainers: null,
            weapons: null,
            admin: null,
            lastKnownName: null
        });
        saveTextFile("players_backup.json", JSON.stringify(playersData, null, '\t'));
        savePlayers();
        logAdminAction(client, command, params, `Banned IP range ${targetParams} forever. Reason: ${reasonParams}`);
        const successMsg = `Successfully banned IP range ${targetParams} forever. Reason: ${reasonParams}`;
        client.console ? console.log(successMsg) : messageClient(successMsg, client, COLOUR_YELLOW);
        messageAdmins(`IP range ${targetParams} has been banned by ${client.console ? "Console" : client.name} forever! Reason: ${reasonParams}`);
        getClients().forEach(c => {
            if (isIPInRange(c.ip, targetParams)) {
                messageClient(`You have been banned forever! Reason: ${reasonParams}`, c, errorMessageColour);
                c.disconnect();
            }
        });
        return true;
    }

    let targetClient = getClientFromParams(targetParams, true);
    if (targetClient == null) {
        const errorMsg = `No player found with ID, name, IP, or token '${targetParams}'. Use /listplayers to see connected players.`;
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
            admin: null,
            lastKnownName: null
        });
        playerIndex = playersData.length - 1;
    }
    playersData[playerIndex].bans = {
        reason: escapeJSONString(reasonParams),
        admin: escapeJSONString(client.console ? "Console" : client.name),
        timeStamp: new Date().toLocaleDateString('en-GB'),
        expireTime: expireTime
    };
    playersData[playerIndex].ip = targetClient.ip;
    saveTextFile("players_backup.json", JSON.stringify(playersData, null, '\t'));
    savePlayers();
    logAdminAction(client, command, params, `Banned ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}] forever. Reason: ${reasonParams}`);
    const successMsg = `Successfully banned ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}] forever. Reason: ${reasonParams}`;
    client.console ? console.log(successMsg) : messageClient(successMsg, client, COLOUR_YELLOW);
    messageAdmins(`${targetClient.name} [ID:${targetClient.index}] (IP: ${targetClient.ip}) has been banned by ${client.console ? "Console" : client.name} forever! Reason: ${reasonParams}`);
    console.log(`ban cmd executed by ${client.console ? "Console" : client.name}: Banned ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}] forever. Reason: ${reasonParams}`);
    server.banIP(targetClient.ip, duration * 60);
    triggerNetworkEvent("b.admin.token.save", targetClient, playerToken, scriptConfig.serverToken);
    messageClient(`You have been banned forever! Reason: ${reasonParams}`, targetClient, errorMessageColour);
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
        const errorMsg = "Usage: tempban [ID:<number>]/name/ip/token/range <minutes> [reason] - Temporarily bans a player or IP range";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    let splitParams = params.split(" ");
    let targetParams = splitParams[0];
    let duration = parseInt(splitParams[1]);
    let reasonParams = splitParams.slice(2).join(" ");
    let isRange = targetParams.includes('/') || targetParams.includes('*');

    if (isNaN(duration) || duration <= 0) {
        const errorMsg = "Duration must be a positive number (in minutes).";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    if (!reasonParams) {
        const errorMsg = "Reason is required for tempbans.";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    if (isRange && targetParams.includes('/') && !isValidCIDR(targetParams)) {
        messageClient("Invalid CIDR range (bits must be 0-32).", client, errorMessageColour);
        return false;
    }

    const expireTime = Date.now() + (duration * 60 * 1000);
    const expiryDate = new Date(expireTime).toLocaleString('en-GB');

    if (isRange) {
        playersData.push({
            name: `RangeTempBan_${targetParams.replace(/[^a-z0-9]/gi, '_')}`,
            ip: targetParams,
            token: generateRandomString(128),
            bans: {
                reason: escapeJSONString(reasonParams),
                admin: escapeJSONString(client.console ? "Console" : client.name),
                timeStamp: new Date().toLocaleDateString('en-GB'),
                expireTime: expireTime
            },
            trainers: null,
            weapons: null,
            admin: null,
            lastKnownName: null
        });
        saveTextFile("players_backup.json", JSON.stringify(playersData, null, '\t'));
        savePlayers();
        logAdminAction(client, command, params, `Tempbanned IP range ${targetParams} for ${duration} minutes. Reason: ${reasonParams}`);
        const successMsg = `Successfully tempbanned IP range ${targetParams} for ${duration} minutes until ${expiryDate}. Reason: ${reasonParams}`;
        client.console ? console.log(successMsg) : messageClient(successMsg, client, COLOUR_YELLOW);
        messageAdmins(`IP range ${targetParams} has been tempbanned by ${client.console ? "Console" : client.name} for ${duration} minutes until ${expiryDate}! Reason: ${reasonParams}`);
        getClients().forEach(c => {
            if (isIPInRange(c.ip, targetParams)) {
                messageClient(`You have been tempbanned for ${duration} minutes! Reason: ${reasonParams} (Expires: ${expiryDate})`, c, errorMessageColour);
                c.disconnect();
            }
        });
        return true;
    }

    let targetClient = getClientFromParams(targetParams, true);
    if (targetClient == null) {
        const errorMsg = `No player found with ID, name, IP, or token '${targetParams}'. Use /listplayers to see connected players.`;
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
            admin: null,
            lastKnownName: null
        });
        playerIndex = playersData.length - 1;
    }
    playersData[playerIndex].bans = {
        reason: escapeJSONString(reasonParams),
        admin: escapeJSONString(client.console ? "Console" : client.name),
        timeStamp: new Date().toLocaleDateString('en-GB'),
        expireTime: expireTime
    };
    playersData[playerIndex].ip = targetClient.ip;
    saveTextFile("players_backup.json", JSON.stringify(playersData, null, '\t'));
    savePlayers();
    logAdminAction(client, command, params, `Tempbanned ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}] for ${duration} minutes. Reason: ${reasonParams}`);
    const successMsg = `Successfully tempbanned ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}] for ${duration} minutes until ${expiryDate}. Reason: ${reasonParams}`;
    client.console ? console.log(successMsg) : messageClient(successMsg, client, COLOUR_YELLOW);
    messageAdmins(`${targetClient.name} [ID:${targetClient.index}] (IP: ${targetClient.ip}) has been tempbanned by ${client.console ? "Console" : client.name} for ${duration} minutes until ${expiryDate}! Reason: ${reasonParams}`);
    console.log(`tempban cmd executed by ${client.console ? "Console" : client.name}: Tempbanned ${targetClient.name} [ID:${targetClient.index}, IP: ${targetClient.ip}] for ${duration} minutes. Reason: ${reasonParams}`);
    server.banIP(targetClient.ip, duration * 60);
    triggerNetworkEvent("b.admin.token.save", targetClient, playerToken, scriptConfig.serverToken);
    messageClient(`You have been tempbanned for ${duration} minutes! Reason: ${reasonParams} (Expires: ${expiryDate})`, targetClient, errorMessageColour);
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
        const errorMsg = "Usage: unban name/ip/token/range - Removes a ban by player name, IP, token, or range";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    logAdminAction(client, command, params);
    let removedBans = [];
    for (let i = playersData.length - 1; i >= 0; i--) {
        if (playersData[i].bans && (
            playersData[i].ip === params ||
            playersData[i].name.toLowerCase().includes(params.toLowerCase()) ||
            playersData[i].token === params ||
            (playersData[i].ip.includes('/') || playersData[i].ip.includes('*'))
        )) {
            server.unbanIP(playersData[i].ip); // Unban exact IP or range
            let removedBan = playersData[i].bans;
            removedBans.push({ name: playersData[i].name, ip: playersData[i].ip, ...removedBan });
            playersData[i].bans = null;
            if (playersData[i].name.startsWith('RangeBan_') || playersData[i].name.startsWith('RangeTempBan_')) {
                playersData.splice(i, 1); // Remove range ban entries
            }
        }
    }

    if (removedBans.length === 0) {
        const errorMsg = `No bans found for name, IP, token, or range '${params}'. Use /banlist to see active bans.`;
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    saveTextFile("players_backup.json", JSON.stringify(playersData, null, '\t')); // Single backup
    savePlayers();
    removedBans.forEach(ban => {
        const successMsg = `Successfully unbanned ${ban.name} [IP: ${ban.ip}]${ban.reason ? ` (Reason: ${ban.reason})` : ""}`;
        client.console ? console.log(successMsg) : messageClient(successMsg, client, COLOUR_YELLOW);
        messageAdmins(`${ban.name} [IP: ${ban.ip}] has been unbanned by ${client.console ? "Console" : client.name}!`);
        logAdminAction(client, command, params, `Unbanned ${ban.name} [IP: ${ban.ip}]`);
    });
    return true;
});

// ----------------------------------------------------------------------------

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

    let playerList = players.map(p => {
        const playerData = playersData.find(pd => pd.token === p.getData("b.token"));
        const lastKnownName = playerData && playerData.lastKnownName ? ` - Last known as: (${playerData.lastKnownName})` : "";
        return `${p.name} [ID:${p.index}, IP: ${p.ip}]${lastKnownName}`;
    }).join("\n");
    if (client.console) {
        console.log(`Connected Players (${players.length}):\n${playerList}`);
    }
    messageClient(`Connected Players (${players.length}):\n${playerList}`, client, COLOUR_YELLOW);
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
            admin: { role: "admin", level: 2, addedBy: escapeJSONString(client.name) },
            lastKnownName: null
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
            admin: { role: "mod", level: 1, addedBy: escapeJSONString(client.name) },
            lastKnownName: null
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
// cmd added at the request of don.
addCommandHandler("demote", (command, params, client) => {
    if (!client.console && getPlayerAdminLevel(client) < getLevelForCommand(command)) {
        messageClient("You are not authorized to use this command!", client, errorMessageColour);
        return false;
    }

    if (!params || params.trim() === "") {
        const errorMsg = "Usage: demote [ID:<number>]/name/ip/token - Demotes an admin/mod to level 0";
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    let targetParams = params.trim();
    let targetClient = getClientFromParams(targetParams, true);
    let playerIndex = -1;

    if (targetClient) {
        // Online player found
        const playerToken = targetClient.getData("b.token");
        playerIndex = playersData.findIndex(p => p.token === playerToken);
    } else {
        // Offline: search by name/ip/token in playersData
        playerIndex = playersData.findIndex(p => 
            p.name.toLowerCase() === targetParams.toLowerCase() ||
            p.ip === targetParams ||
            p.token === targetParams
        );
    }

    if (playerIndex === -1) {
        const errorMsg = `No player found with ID, name, IP, or token '${targetParams}'. Use /listplayers for online or check players.json/banlist.`;
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    if (playersData[playerIndex].admin === null) {
        const errorMsg = `${playersData[playerIndex].name} is not an admin/mod.`;
        client.console ? console.log(errorMsg) : messageClient(errorMsg, client, errorMessageColour);
        return false;
    }

    // Prevent self-demote
    if (!client.console && targetClient && targetClient.index === client.index) {
        messageClient("You cannot demote yourself!", client, errorMessageColour);
        return false;
    }

    playersData[playerIndex].admin = null;
    if (targetClient) {
        targetClient.setData("b.admin", 0, true);
    }

    saveTextFile("players_backup.json", JSON.stringify(playersData, null, '\t'));
    savePlayers();
    logAdminAction(client, command, params, `Demoted ${playersData[playerIndex].name} to level 0`);
    const successMsg = `Successfully demoted ${playersData[playerIndex].name}${targetClient ? ` [ID:${targetClient.index}, IP: ${targetClient.ip}]` : " (offline)"} to level 0`;
    client.console ? console.log(successMsg) : messageClient(successMsg, client, COLOUR_YELLOW);
    messageAdmins(`${client.console ? "Console" : client.name} demoted ${playersData[playerIndex].name}${targetClient ? ` [ID:${targetClient.index}]` : " (offline)"} to level 0!`);
    console.log(`demote cmd executed by ${client.console ? "Console" : client.name}: Demoted ${playersData[playerIndex].name} to level 0`);
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
                admin: null,
                lastKnownName: null
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
                admin: null,
                lastKnownName: null
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
        const errorMsg = "Usage: disableweapons [ID:<number>]/name/ip/token - Toggles weapons for a player (GTA Connected only)";
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
                admin: null,
                lastKnownName: null
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
                admin: null,
                lastKnownName: null
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
        const errorMsg = "Usage: ip [ID:<number>]/name/ip/token - Gets a player's IP address";
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
        const errorMsg = "Usage: geoip [ID:<number>]/name/ip/token - Gets a player's GeoIP information";
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
        return null; // Require exact match or ID for multiple matches
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
        playersData = JSON.parse(playersFileContent);
        if (playersData == null) {
            playersData = [];
            saveTextFile(playersFile, JSON.stringify(playersData, null, '\t'));
            messageAdmins(`Could not parse ${playersFile}. Initialized empty players data.`);
            return false;
        }
        // Ensure all entries have required fields
        playersData.forEach(player => {
            if (!player.hasOwnProperty('admin')) {
                player.admin = null;
            }
            if (!player.hasOwnProperty('lastKnownName')) {
                player.lastKnownName = null;
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
        messageClient(`${fromClient.name}'s game scripts: ${gameScripts.join(", ")}`, returnScriptsToClient, COLOUR_AQUA);
    } else {
        messageClient(`${fromClient.name}'s game scripts: [#FFFF00]${gameScripts.join("[#CCCC00], [#FFFF00]")}`, returnScriptsToClient, COLOUR_AQUA);
    }
});

// ----------------------------------------------------------------------------

function addBlockedScript(scriptName) {
    scriptConfig.blockedScripts[server.game].push(scriptName);
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
            "demote": 2,
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

// Updated b.admin.token handler to allow name changes, track last known name, and display in format: playername - Last known as: (oldname1)
addNetworkHandler("b.admin.token", function (fromClient, token) {
    let tokenValid = false;
    let playerIndex = -1;
    let playerToken = token;

    // If client sent an empty token, generate new
    if (!playerToken || playerToken === "") {
        playerToken = generateRandomString(128);
        triggerNetworkEvent("b.admin.token.save", fromClient, playerToken, scriptConfig.serverToken);
        fromClient.setData("b.token", playerToken, true);
    } else {
        fromClient.setData("b.token", playerToken, true);
    }

    // Look up by token
    playerIndex = playersData.findIndex(p => p.token === playerToken);
    if (playerIndex !== -1) {
        // Token matches existing entry
        const existingPlayer = playersData[playerIndex];
        if (existingPlayer.name.toLowerCase() !== fromClient.name.toLowerCase()) {
            // Name change detected, update lastKnownName and current name
            playersData[playerIndex].lastKnownName = escapeJSONString(existingPlayer.name);
            playersData[playerIndex].name = escapeJSONString(fromClient.name);
            savePlayers();
            messageAdmins(`${fromClient.name} [IP: ${fromClient.ip}] changed name - Last known as: (${existingPlayer.name})`);
            logAdminAction(fromClient, "name_change", "", `Changed name from ${existingPlayer.name} to ${fromClient.name}`);
        }

        // Update IP if changed
        if (existingPlayer.ip !== fromClient.ip) {
            playersData[playerIndex].ip = fromClient.ip;
            savePlayers();
        }

        // Check for bans
        if (existingPlayer.bans && (!existingPlayer.bans.expireTime || Date.now() < existingPlayer.bans.expireTime)) {
            messageClient(`You are banned! Reason: ${existingPlayer.bans.reason || "No reason provided"}${existingPlayer.bans.expireTime ? ` (Expires: ${new Date(existingPlayer.bans.expireTime).toLocaleString('en-GB')})` : ""}`, fromClient, errorMessageColour);
            fromClient.disconnect();
            messageAdmins(`Banned player ${fromClient.name} [IP: ${fromClient.ip}] attempted to join (matched token).`);
            logAdminAction(fromClient, "join_attempt", "", `Banned join attempt (matched token)`);
            return false;
        }
    } else {
        // New token, check for name or IP match (optional for monitoring, but no disconnect)
        const existingByName = playersData.find(p => p.name.toLowerCase() === fromClient.name.toLowerCase());
        if (existingByName) {
            messageAdmins(`Possible impersonation: ${fromClient.name} [IP: ${fromClient.ip}] matches existing name but new token. Expected token: ${existingByName.token}`);
            logAdminAction(fromClient, "join_attempt", "", `Possible impersonation (matched name, new token)`);
        }

        const existingByIP = playersData.find(p => p.ip === fromClient.ip);
        if (existingByIP) {
            messageAdmins(`Possible evasion: ${fromClient.name} [IP: ${fromClient.ip}] matches existing IP but new token/name. Last known as: (${existingByIP.name})`);
            logAdminAction(fromClient, "join_attempt", "", `Possible evasion (matched IP, new token/name)`);
        }

        // Create new entry
        playersData.push({
            name: escapeJSONString(fromClient.name),
            ip: fromClient.ip,
            token: playerToken,
            bans: null,
            trainers: { status: areTrainersEnabledForEverybody(), addedBy: "System" },
            weapons: { status: true, addedBy: "System" },
            admin: null,
            lastKnownName: null
        });
        savePlayers();
        playerIndex = playersData.length - 1;
    }

    // Set permissions
    const playerData = playersData[playerIndex];
    if (typeof fromClient.trainers != "undefined") {
        fromClient.trainers = playerData.trainers ? playerData.trainers.status : areTrainersEnabledForEverybody();
    }
    const weaponStatus = playerData.weapons ? playerData.weapons.status : true;
    fromClient.setData("b.weapons", weaponStatus, true);
    triggerNetworkEvent("b.admin.weapons", fromClient, weaponStatus);

    if (playerData.admin) {
        fromClient.setData("b.admin", playerData.admin.level || 1, true);
        messageAdmins(`${fromClient.name} authenticated as admin (Level ${playerData.admin.level})${playerData.lastKnownName ? ` - Last known as: (${playerData.lastKnownName})` : ""}`);
        logAdminAction(fromClient, "login", "", `Authenticated as admin (Level ${playerData.admin.level})`);
    } else {
        fromClient.setData("b.admin", 0, true);
    }

    messageAdmins(`[JOIN] Player ${fromClient.name} connected (IP: ${fromClient.ip})${playerData.lastKnownName ? ` - Last known as: (${playerData.lastKnownName})` : ""}`);
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

function isIPInRange(ip, range) {
    if (range.includes('*')) { // Wildcard e.g., 192.168.*.*
        const regex = new RegExp('^' + range.replace(/\./g, '\\.').replace(/\*/g, '\\d+') + '$');
        return regex.test(ip);
    } else if (range.includes('/')) { // CIDR e.g., 192.168.1.0/24
        const [rangeIP, bits] = range.split('/');
        const mask = (0xffffffff << (32 - parseInt(bits))) >>> 0;
        const rangeInt = ipToInt(rangeIP) & mask;
        const ipInt = ipToInt(ip) & mask;
        return rangeInt === ipInt;
    }
    return ip === range; // Single IP fallback
}

function ipToInt(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet), 0) >>> 0;
}

function isValidCIDR(range) {
    if (!range.includes('/')) return true;
    const [ip, bits] = range.split('/');
    const bitsNum = parseInt(bits);
    if (isNaN(bitsNum) || bitsNum < 0 || bitsNum > 32) return false;
    const ipParts = ip.split('.').map(Number);
    return ipParts.length === 4 && ipParts.every(part => !isNaN(part) && part >= 0 && part <= 255);
}

// ----------------------------------------------------------------------------

function logAdminAction(client, command, params, details = "") {
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
        client: client.console ? "Console" : client.name,
        ip: client.console ? "0.0.0.0" : client.ip,
        command: command,
        params: params,
        details: details
    });
    saveTextFile(adminLogFile, JSON.stringify(logArray, null, '\t'));
}
