"use strict";

// ----------------------------------------------------------------------------

let smallGameMessageFontFile = (typeof gta != "undefined") ? "fonts/pricedown.ttf" : "fonts/aurora-condensed-bold.ttf";
let smallGameMessageFont = null;
let smallGameMessageText = "";
let smallGameMessageColour = COLOUR_WHITE;
let smallGameMessageTimer = null;

// GTA Connected only
let blockedScripts = [];
let tokenData = {};
let weaponsEnabled = true; // Global variable to store weapon status

// ----------------------------------------------------------------------------

bindEventHandler("onResourceReady", thisResource, function (event, resource) {
    let fontStream = openFile(smallGameMessageFontFile);
    if (fontStream != null) {
        smallGameMessageFont = lucasFont.createFont(fontStream, 20.0);
        fontStream.close();
    }

    // Ensure token.json exists
    let tokenFile = loadTextFile("token.json");
    if (tokenFile == "") {
        saveTextFile("token.json", JSON.stringify({}, null, '\t'));
    }

    // Start weapon check interval for disabling weapons
    if (typeof gta != "undefined") {
        setInterval(function() {
            if (localPlayer && weaponsEnabled === false) {
                try {
                    natives.removeAllCharWeapons(localPlayer);
                    const weaponTypes = [1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17];
                    for (let i = 0; i < weaponTypes.length; i++) {
                        natives.removeAllPickupsOfType(weaponTypes[i]);
                    }
                } catch (e) {}
            }
        }, 2000); // Check every 2000ms
    }
});

// ----------------------------------------------------------------------------

addEventHandler("OnProcess", function (event, deltaTime) {
    if (typeof gta != "undefined") {
        blockedScripts.forEach((blockedScript) => {
            game.terminateScript(blockedScript);
        });
    }
});

// ----------------------------------------------------------------------------

addEventHandler("OnDrawnHUD", function (event) {
    if (smallGameMessageFont != null) {
        if (smallGameMessageText != "") {
            smallGameMessageFont.render(smallGameMessageText, [0, game.height - 50], game.width, 0.5, 0.0, smallGameMessageFont.size, smallGameMessageColour, true, true, false, true);
        }
    }
});

// ----------------------------------------------------------------------------

addNetworkHandler("smallGameMessage", function (text, colour, duration) {
    if (smallGameMessageText != "") {
        clearTimeout(smallGameMessageTimer);
    }

    smallGameMessageColour = colour;
    smallGameMessageText = text;

    smallGameMessageTimer = setTimeout(function () {
        smallGameMessageText = "";
        smallGameMessageColour = COLOUR_WHITE;
        smallGameMessageTimer = null;
    }, duration);
});

// ----------------------------------------------------------------------------

addNetworkHandler("requestGameScripts", function () {
    if (typeof gta != "undefined") {
        triggerNetworkEvent("receiveGameScripts", game.getActiveScripts());
    }
});

// ----------------------------------------------------------------------------

addNetworkHandler("receiveBlockedScripts", function (scripts) {
    blockedScripts = scripts;
});

// ----------------------------------------------------------------------------

addNetworkHandler("receiveConsoleMessage", function (messageText) {
});

// ----------------------------------------------------------------------------

addNetworkHandler("b.admin.token", function (serverToken) {
    let tokenFile = loadTextFile("token.json");
    if (tokenFile == "") {
        tokenData = {};
        saveTextFile("token.json", JSON.stringify(tokenData, null, '\t'));
    } else {
        try {
            tokenData = JSON.parse(tokenFile);
            if (tokenData == null) {
                tokenData = {};
                saveTextFile("token.json", JSON.stringify(tokenData, null, '\t'));
            }
        } catch (e) {
            tokenData = {};
            saveTextFile("token.json", JSON.stringify(tokenData, null, '\t'));
        }
    }

    let token = tokenData[serverToken] || "";
    triggerNetworkEvent("b.admin.token", token);
});

// ----------------------------------------------------------------------------

addNetworkHandler("b.admin.token.save", function (token, serverToken) {
    let tokenFile = loadTextFile("token.json");
    if (tokenFile == "") {
        tokenData = {};
    } else {
        try {
            tokenData = JSON.parse(tokenFile);
            if (tokenData == null) {
                tokenData = {};
            }
        } catch (e) {
            tokenData = {};
        }
    }

    tokenData[serverToken] = token;
    saveTextFile("token.json", JSON.stringify(tokenData, null, '\t'));
});

// ----------------------------------------------------------------------------

addNetworkHandler("b.admin.weapons", function (status) {
    if (typeof gta != "undefined") {
        weaponsEnabled = status;
        if (!status && localPlayer) {
            try {
                natives.removeAllCharWeapons(localPlayer);
                const weaponTypes = [1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17];
                for (let i = 0; i < weaponTypes.length; i++) {
                    natives.removeAllPickupsOfType(weaponTypes[i]);
                }
            } catch (e) {}
        }
    }
});


// ----------------------------------------------------------------------------

const emotes = {
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
    for (const emote in emotes) {
        if (processed.includes(emote)) {
            processed = processed.replace(new RegExp(escapeRegExp(emote), "g"), emotes[emote]);
        }
    }
    return processed;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ----------------------------------------------------------------------------

addCommandHandler("emotes", function(command, params) {
    message("📝 Available Emoticons:", COLOUR_YELLOW);
    const emoteEntries = Object.entries(emotes);
    let emoteLines = [];
    for (let i = 0; i < emoteEntries.length; i += 5) {
        const group = emoteEntries.slice(i, i + 5);
        const line = group.map(([text, emoji]) => `${text} ${emoji}`).join("  ");
        emoteLines.push(line);
    }
    emoteLines.forEach(line => {
        message(line, COLOUR_WHITE);
    });
    message("Type these in your chat messages! 😊", COLOUR_LIME);
});

// ----------------------------------------------------------------------------