"use strict";

// ----------------------------------------------------------------------------
// AFK System
// ----------------------------------------------------------------------------

let isFocused = true;
let lastMousePosition = { x: 0, y: 0 };
let lastActivityTime = new Date().getTime();
const ACTIVITY_CHECK_INTERVAL = 1000; // Check every second
const MOUSE_MOVE_THRESHOLD = 5; // Pixels

addEventHandler("OnLostFocus", (event) => {
    isFocused = false;
    if (isConnected) {
        triggerNetworkEvent("b.afk", true);
    }
});

addEventHandler("OnFocus", (event) => {
    isFocused = true;
    if (isConnected) {
        triggerNetworkEvent("b.afk", false);
        triggerNetworkEvent("b.activity");
    }
});

// Track keyboard input
addEventHandler("OnKeyDown", (event, key) => {
    if (isConnected) {
        lastActivityTime = new Date().getTime();
        triggerNetworkEvent("b.activity");
    }
});

// Track mouse movement
addEventHandler("OnMouseMove", (event, x, y) => {
    if (isConnected) {
        const dx = Math.abs(x - lastMousePosition.x);
        const dy = Math.abs(y - lastMousePosition.y);
        if (dx > MOUSE_MOVE_THRESHOLD || dy > MOUSE_MOVE_THRESHOLD) {
            lastActivityTime = new Date().getTime();
            lastMousePosition = { x, y };
            triggerNetworkEvent("b.activity");
        }
    }
});

// Periodically check activity
setInterval(() => {
    if (isConnected && isFocused) {
        triggerNetworkEvent("b.activity");
    }
}, ACTIVITY_CHECK_INTERVAL);

// ----------------------------------------------------------------------------
// Scoreboard System
// ----------------------------------------------------------------------------

let titleFont = null;
let subTitleFont = null;
let listFont = null;
let updateGTAIVInfo = null;

let listWidth = game.width / 3;

let ivEpisodes = [
    "IV",
    "TLAD",
    "TBoGT",
];

let ivGamemodes = [
    "Deathmatch",
    "Team Deathmatch",
    "Mafiya Work",
    "Team Mafiya Work",
    "Team Car Jack City",
    "Car Jack City",
    "Race",
    "GTA Race",
    "Party Mode",
    "Invalid (9)",
    "Cops n' Crooks",
    "Invalid (11)",
    "Turf War",
    "Deal Breaker",
    "Hangman's NOOSE",
    "Bomb da Base II",
    "Freemode",
    "Chopper v Chopper",
    "Witness Protection",
    "Club Business",
    "Races",
    "Team Deathmatch",
    "Own the City",
    "Lone Wolf Biker",
    "Deathmatch",
    "Instant Play",
    "Deathmatch",
    "Team Deathmatch",
    "Races",
    "GTA Races",
    "Custom (Sandbox)"
];

function initializeGTAIVInfoUpdater() {
    if (typeof gta != "undefined") {
        if (updateGTAIVInfo == null) {
            updateGTAIVInfo = setInterval(function () {
                if (game.ivEpisode !== undefined && game.ivGamemode !== undefined) {
                    let gameMode = Number(game.ivGamemode);
                    if (gameMode >= 0 && gameMode < ivGamemodes.length) {
                        triggerNetworkEvent("b.ivinfo.", game.ivEpisode, gameMode);
                    }
                }
            }, 2500);
        }
    }
}

addNetworkHandler("b.ping.sync", (ping) => {
    localPlayer.setData("b.ping", ping, true);
});

bindEventHandler("OnResourceReady", thisResource, function (event, resource) {
    let fontStream = openFile("pricedown.ttf");
    if (fontStream != null) {
        titleFont = lucasFont.createFont(fontStream, 22.0);
        fontStream.close();
    }
    subTitleFont = lucasFont.createDefaultFont(12.0, "Roboto", "Light");
    listFont = lucasFont.createDefaultFont(12.0, "Roboto", "Light");

    initializeGTAIVInfoUpdater();
});

bindEventHandler("OnResourceStart", thisResource, function (event, resource) {
    initializeGTAIVInfoUpdater();
});

addEventHandler("OnDrawnHUD", function (event) {
    if (isKeyDown(SDLK_TAB)) {
        if (listFont != null && titleFont != null) {
            let playersText = `Players`;
            let scoreboardStart = (game.height / 2) - (Math.floor(getClients().length / 2) * 20);
            titleFont.measure(playersText, listWidth, 0.0, 1.0, 10, false, false);
            titleFont.render(playersText, [game.width / 2, scoreboardStart - 85], 0, 0.5, 0.0, titleFont.size, COLOUR_WHITE, false, false, false, true);

            let playerCountText = `${getClients().length} connected`;
            subTitleFont.measure(playerCountText, listWidth, 0.0, 1.0, 10, false, false);
            subTitleFont.render(playerCountText, [game.width / 2, scoreboardStart - 55], 0, 0.5, 0.0, subTitleFont.size, COLOUR_WHITE, false, false, false, true);

            let listColumns = ["ID", "Name", "Ping"];
            if (typeof gta != "undefined" && game.game == GAME_GTA_IV) {
                listColumns = ["ID", "Name", "Ping", "Episode", "Gamemode"];
            }

            let columnWidth = Math.round(listWidth / listColumns.length);
            let listLeft = Math.round(game.width / 2) - (listWidth / 2);

            graphics.drawRectangle(null, [listLeft, scoreboardStart - 5], [listWidth + 50, 1], COLOUR_WHITE);

            for (let i in listColumns) {
                let columnLeft = Math.round(listLeft + (columnWidth * i));
                listFont.measure(listColumns[i], columnWidth, 0.5, 1.0, 10, false, false);
                listFont.render(listColumns[i], [columnLeft, scoreboardStart - 30], columnWidth, 0.5, 1.0, listFont.size, COLOUR_WHITE, false, false, false, true);
            }

            let clients = getClients();
            for (let i = 0; i < clients.length; i++) {
                if (!clients[i] || typeof clients[i].getData !== "function") {
                    continue;
                }

                let colour = clients[i].getData("b.afk") === 1 ? toColour(128, 128, 128, 255) : (clients[i].getData("b.colour") || COLOUR_WHITE);

                let name = clients[i].name || "Unknown";
                if (clients[i].getData("b.name") != null) {
                    name = clients[i].getData("b.name");
                }

                let ping = clients[i].getData("b.ping");
                if (ping === null || ping === undefined) {
                    ping = clients[i].ping !== undefined ? clients[i].ping : "N/A";
                }

                let listColumnData = [
                    String(clients[i].index),
                    name,
                    String(ping)
                ];
                if (typeof gta != "undefined" && game.game == GAME_GTA_IV) {
                    let ivInfo = clients[i].getData("b.ivinfo") || [0, 0];
                    let gameModeIndex = Number(ivInfo[1]);
                    let gameModeName = gameModeIndex >= 0 && gameModeIndex < ivGamemodes.length ? ivGamemodes[gameModeIndex] : "Unknown";
                    listColumnData = [
                        String(clients[i].index),
                        name,
                        String(ping),
                        ivEpisodes[ivInfo[0]] || "Unknown",
                        gameModeName
                    ];
                }

                for (let j in listColumnData) {
                    let columnLeft = Math.round(listLeft + (columnWidth * j));
                    listFont.measure(listColumnData[j], columnWidth, 0.5, 1.0, 10, false, false);
                    listFont.render(listColumnData[j], [columnLeft, scoreboardStart + (i * 20)], columnWidth, 0.5, 1.0, listFont.size, colour, false, false, false, true);
                }

                if (clients[i].getData("b.afk") === 1) {
                    listFont.measure("AFK", columnWidth, 0.5, 1.0, 10, false, false);
                    listFont.render("AFK", [listLeft + listWidth + 50, scoreboardStart + (i * 20)], columnWidth, 0.5, 1.0, listFont.size, colour, false, false, false, true);
                }
            }
        }
    }
});

// ----------------------------------------------------------------------------