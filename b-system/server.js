"use strict";

// ----------------------------------------------------------------------------
// Global Variables
// ----------------------------------------------------------------------------

let welcomeMessageColour = toColour(144, 255, 96, 255);

let disconnectReasons = [
    "Lost Connection",
    "Disconnected",
    "Unsupported Client",
    "Wrong Game",
    "Incorrect Password",
    "Unsupported Executable",
    "Disconnected",
    "Banned",
    "Failed",
    "Invalid Name",
    "Crashed"
];

let gameNames = [
    "Unknown",
    "GTA III",
    "GTA Vice City",
    "GTA San Andreas",
    "GTA Underground",
    "GTA IV",
    "GTA IV (EFLC)",
    "Unknown",
    "Unknown",
    "Unknown",
    "Mafia: The City of Lost Heaven",
    "Mafia II",
    "Mafia III",
    "Mafia Definitive Edition",
];

let gameAnnounceColour = [
    COLOUR_BLACK,
    COLOUR_SILVER,
    COLOUR_AQUA,
    COLOUR_ORANGE,
    COLOUR_ORANGE,
    COLOUR_SILVER,
    COLOUR_SILVER,
    COLOUR_BLACK,
    COLOUR_BLACK,
    COLOUR_BLACK,
    COLOUR_RED,
    COLOUR_RED,
    COLOUR_RED,
    COLOUR_RED,
];

let connectionID = Array(128);
connectionID.fill(-1);

// AFK timeout in milliseconds (5 minutes)
const AFK_TIMEOUT = 5 * 60 * 1000;

// ----------------------------------------------------------------------------
// AFK System
// ----------------------------------------------------------------------------

addEvent("OnPlayerGameFocused", 1);
addEvent("OnPlayerGameDefocused", 1);
addEvent("OnPlayerActivity", 1);

addEventHandler("OnPlayerJoined", (event, client) => {
    client.setData("b.afk", 0, true);
    client.setData("b.ping", client.ping || 0, true);
    client.setData("b.colour", getRandomColour(), true);
    client.setData("b.name", client.name, true);
    client.setData("b.ivinfo", [0, 0], true);
    client.setData("b.lastActivity", new Date().getTime(), true);
    triggerNetworkEvent("b.ping.sync", client, client.ping || 0);

    client.setData("connectTime", new Date().getTime());
    messageClient(`Welcome to ${server.name}!`, client, welcomeMessageColour);
    messageClient(`F1 = Player Manager | F3 = Vehicle Menu`, client, COLOUR_YELLOW);

    let messageText = `${client.name} [#FFFFFF]has joined the game.👋`;
    if (typeof module.geoip != "undefined") {
        let countryName = module.geoip.getCountryName("geoip-country.mmdb", client.ip) || "Unknown";
        if (countryName != "Unknown") {
            messageText = `👋 [#0099FF]${client.name} [#FFFFFF]has joined the game from ${countryName}`;
        }
    }
    message(messageText, client.getData("b.colour"));
});

addEventHandler("OnPlayerQuit", (event, client, reason) => {
    if (reason === 0 || reason === 10) {
        console.log(`${client.name} left the game (${disconnectReasons[reason]})`);
    }

    client.setData("b.afk", null, true);
    client.setData("b.ping", null, true);
    client.setData("b.colour", null, true);
    client.setData("b.name", null, true);
    client.setData("b.ivinfo", null, true);
    client.setData("b.lastActivity", null, true);

    let messageText = `👋 [#0099FF]${client.name} [#FFFFFF]left the game [#999999](${disconnectReasons[reason]})`;
    message(messageText, gameAnnounceColour[server.game]);
});

addNetworkHandler("b.afk", (client, state) => {
    if (!client) return;
    if (state === true) {
        client.setData("b.afk", 1, true);
        if (client.player != null) {
            client.player.setData("b.afk", 1, true);
            triggerEvent("OnPlayerGameDefocused", client, client);
        }
    } else {
        client.setData("b.afk", 0, true);
        client.setData("b.lastActivity", new Date().getTime(), true);
        if (client.player != null) {
            client.player.setData("b.afk", 0, true);
            triggerEvent("OnPlayerGameFocused", client, client);
        }
    }
});

addNetworkHandler("b.activity", (client) => {
    if (client) {
        client.setData("b.lastActivity", new Date().getTime(), true);
        if (client.getData("b.afk") === 1) {
            client.setData("b.afk", 0, true);
            if (client.player != null) {
                client.player.setData("b.afk", 0, true);
                triggerEvent("OnPlayerGameFocused", client, client);
            }
        }
    }
});

// AFK timeout checker
setInterval(() => {
    getClients().forEach((client) => {
        if (!client || !client.getData("b.lastActivity")) return;
        
        const now = new Date().getTime();
        const lastActivity = client.getData("b.lastActivity");
        
        if (now - lastActivity > AFK_TIMEOUT && client.getData("b.afk") !== 1) {
            client.setData("b.afk", 1, true);
            if (client.player != null) {
                client.player.setData("b.afk", 1, true);
                triggerEvent("OnPlayerGameDefocused", client, client);
            }
        }
    });
}, 10000);

// ----------------------------------------------------------------------------
// Scoreboard System
// ----------------------------------------------------------------------------

function updatePlayerScoreboardPing() {
    getClients().forEach((client) => {
        if (client && typeof client.setData === "function") {
            let ping = client.ping !== undefined && client.ping !== null ? client.ping : 0;
            client.setData("b.ping", ping, true);
            triggerNetworkEvent("b.ping.sync", client, ping);
        }
    });
}

function updatePlayerScoreboardGTAIV(client, episode, gameMode) {
    if (client && typeof client.setData === "function") {
        client.setData("b.ivinfo", [episode, gameMode], true);
    }
}

function getClientFromParams(params) {
    if (typeof server == "undefined") {
        let clients = getClients();
        for (let i in clients) {
            if (clients[i] && clients[i].name && clients[i].name.toLowerCase().indexOf(params.toLowerCase()) != -1) {
                return clients[i];
            }
        }
    } else {
        let clients = getClients();
        if (isNaN(params)) {
            for (let i in clients) {
                if (clients[i] && clients[i].name && clients[i].name.toLowerCase().indexOf(params.toLowerCase()) != -1) {
                    return clients[i];
                }
            }
        } else {
            let clientID = Number(params) || 0;
            if (clients[clientID]) {
                return clients[clientID];
            }
        }
    }
    return false;
}

addNetworkHandler("b.ivinfo.", (client, episode, gameMode) => {
    if (client) {
        updatePlayerScoreboardGTAIV(client, episode, gameMode);
    }
});

// ----------------------------------------------------------------------------
// Player Colour System
// ----------------------------------------------------------------------------

addNetworkHandler("b.colour", () => {
    getClients().forEach((client) => {
        client.player.setNametag(client.name, Number(client.getData("b.colour")) || COLOUR_WHITE);
    });
});

function setPlayerColour(player) {
    let client = getPlayerClient(player);
    if (client != null) {
        client.setData("b.colour", client.getData("b.colour"), true);
        if (server.game == GAME_GTA_IV) {
            triggerNetworkEvent("b.colour", null);
        }
    }
}

addEventHandler("OnPedSpawn", function(event, ped) {
    if (ped.isType(ELEMENT_PLAYER)) {
        setTimeout(setPlayerColour, 500, ped);
    }
});

function getPlayerClient(player) {
    let clients = getClients();
    for (let i in clients) {
        if (clients[i].player == player) {
            return clients[i];
        }
    }
    return null;
}

function getRandomColour() {
    return toColour(getRandom(32, 255), getRandom(32, 255), getRandom(32, 255), 255);
}

function getRandom(min, max) {
    return Math.floor(Math.random() * (Number(max) - Number(min) + 1)) + Number(min);
}

// ----------------------------------------------------------------------------
// Chat System
// ----------------------------------------------------------------------------

addNetworkHandler("b.chat", (client, message) => {
    if (!client || !message) return;
    let colour = client.getData("b.colour") || COLOUR_WHITE;
    let name = client.getData("b.name") || client.name || "Unknown";
    message(`[${name}]: ${message}`, colour);
});

// ----------------------------------------------------------------------------
// Resource Start Handler
// ----------------------------------------------------------------------------

bindEventHandler("OnResourceStart", thisResource, (event, resource) => {
    let clients = getClients();
    for (let i in clients) {
        if (!clients[i] || typeof clients[i].setData !== "function") continue;
        if (clients[i].getData("b.afk") == null) {
            clients[i].setData("b.afk", 0, true);
        }
        if (clients[i].getData("b.ping") == null) {
            clients[i].setData("b.ping", clients[i].ping || 0, true);
            triggerNetworkEvent("b.ping.sync", clients[i], clients[i].ping || 0);
        }
        if (clients[i].getData("b.colour") == null) {
            clients[i].setData("b.colour", getRandomColour(), true);
        }
        if (clients[i].getData("b.name") == null) {
            clients[i].setData("b.name", clients[i].name, true);
        }
        if (clients[i].getData("b.ivinfo") == null) {
            clients[i].setData("b.ivinfo", [0, 0], true);
        }
        if (clients[i].getData("b.lastActivity") == null) {
            clients[i].setData("b.lastActivity", new Date().getTime(), true);
        }
        if (clients[i].player != null) {
            clients[i].player.setData("b.colour", getRandomColour(), true);
        }
    }
    triggerNetworkEvent("b.colour", null);
    setInterval(updatePlayerScoreboardPing, 3000);
});

// ----------------------------------------------------------------------------
// Resource Stop Handler
// ----------------------------------------------------------------------------

bindEventHandler("OnResourceStop", thisResource, function(event, resource) {
    let clients = getClients();
    for (let i in clients) {
        clients[i].removeData("b.colour");
        clients[i].removeData("b.lastActivity");
        if (clients[i].player != null) {
            clients[i].player.removeData("b.colour");
        }
    }
    triggerNetworkEvent("b.colour", null);
});

// ----------------------------------------------------------------------------