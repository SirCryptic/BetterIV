// Author: SirCryptic - for GTA Connected IV & EFLC 
// Description: Force unlocks all known locked doors by hash and position, and terminates known lock script brains.
// Contributers <3 https://github.com/PerikiyoXD // PXD , thankyou

"use strict";

const LOCK_BRAINS = [
  "ambJimsLocks",
  "ambjimslocks",
  "ambgerry3doorlock",
  "ambCabaret",
  "ambcabaret"
];
const DOOR_MODEL_NAMES = [
  "BM_lawyerDoor",
  "BM_lawyerDoor_2a",
  "BM_lawyerDoor_2b",
  "cj_bank_door_L",
  "cj_bank_door_R",
  "cj_boat_door",
  "cj_BS_door_L",
  "cj_BS_door_R",
  "cj_DB_MH3_door1",
  "cj_int_door_6",
  "cj_int_door_7",
  "cj_int_door_10",
  "cj_int_door_12_H",
  "cj_int_door_22",
  "cj_int_door_24",
  "cj_int_door_27L",
  "cj_int_door_27R",
  "cj_int_door_29",
  "cj_int_door_30",
  "cj_int_door_3L",
  "cj_law_frontdoor_L",
  "cj_law_frontdoor_R",
  "cj_MC_door_1",
  "cj_mision_door_1",
  "cj_MP_fact_door_2",
  "cj_new_china_door_L",
  "cj_new_china_door_R",
  "cj_PER_door_L",
  "cj_PER_door_R",
  "cj_RUS_door_1",
  "cj_RUS_door_2",
  "ec_ML_door_L",
  "ec_ML_door_R",
  "faustinsfrontdoor",

  "cj_shoot_t_door",
  "cj_t_door_BRK",
  "cj_t_door_ENG",
  "cj_t_door_VAC",

  "cj_church_door_L",
  "cj_church_door_R",
  "cj_ext_door_1",
  "cj_ext_door_10",
  "cj_ext_door_11",
  "cj_ext_door_15b",
  "cj_ext_door_16",
  "cj_ext_door_17",
  "cj_ext_door_18",
  "cj_ext_door_19_L",
  "cj_ext_door_19_R",
  "cj_ext_door_22",
  "cj_ext_door_6",
  "cj_ext_door_9",
  "cj_ext_door_CM",
  "cj_GM_door_04",
  "cj_GM_door_05",
  "cj_GM_door_1",
  "cj_GM_door_2",
  "cj_G_door_big",
  "cj_G_door_big2",
  "cj_JA_door1",
  "cj_LD_MET_door_L",
  "cj_LD_MET_door_R",
  "cj_shop_door_1",
  "cabaret_door_R",
  "cabaret_door_L",

  "magkiosk_door",
  "CJ_VAULT_DOOR",
  "CJ_VAULT_DOOR_DAM",
  "CJ_VAULT_GATE",
  "GB_safe02_door",

  "KM_CBDoor",
  "KM_CBDoorTM",
  "KM_CBDoorTW",
  "KM_CBFrontDrL",
  "KM_CBFrontDrR",

  "ab_RitzIntDoorA",
  "ab_RitzIntDoorB",
  "ab_ritzMaindoor",
  "ab_ritz_aptdoor",
  "ab_ritzglassdoor",

  "KM_PortacabinDoor",
  "KM_PrisSecDoor",
  "KM_PrisVisDoor",
  "proj_doorRM1",
  "proj_doorRM1d",
  "proj_doorRM2",
  "proj_doorRM4",
  "jamfrontdoor",
  "nhospmaindoors",
  "nhospmaindoors01",

  "ndinerdoor1",
  "ndinerdoor2",

  "XJ_TenDoor",
  "Deal_doorA",
  "Deal_doorB",
  "KM_KorBlacDoor",
  "KM_KorTDoor",

  "playboyfrontdoor",
  "Blk3_LobbyDoor",
  "corpdoor",
  "LD_show_door_L",
  "LD_show_door_R",

  "hospdoorcorri1",
  "hospdoorcorri3",
  "hospdoorcorri4",
  "hospdoorcorri5",

  "ab_projDoor2",
  "bs3missiongardoor",
  "bs3respraydoor",

  "CJ_LIFT_L_DOOR",
  "CJ_LIFT_L_DOOR_2",
  "CJ_LIFT_L_DOOR_OUT",
  "CJ_LIFT_L_DOOR_OUT_2",
  "CJ_LIFT_R_DOOR",
  "CJ_LIFT_R_DOOR_2",
  "CJ_LIFT_R_DOOR_OUT",
  "CJ_LIFT_R_DOOR_OUT_2",

  "cj_angel_door_L",
  "cj_angel_door_R",
  "cj_e1_door_1",
  "cj_e1_door_lost",
  "cj_lost_door",
  "e1_pris_door_L",
  "e1_pris_door_R",
  "e1_pris_door_L_DAM",
  "e1_pris_door_R_DAM",

  "cj_int_door_1",
  "cj_int_door_2",
  "cj_int_door_3R",
  "cj_int_door_9",
  "e2_bowl_door_L",
  "e2_bowl_door_R",
  "e2_fightcagegate",
  "P_E2_fightcagedoor",
  "P_E2_fightclubdoor",
  "e2_maisontdoor1",
  "e2_maisontdoor2",
  "et_FactoryGate_L",
  "et_FactoryGate_R",
  "P_E2_BM_DOOR",
  "P_E2_HercDoorExt",
  "P_E2_HercDoorInt",
  "P_INT_DOOR_AH",
  "P_Intdoor10",
  "P_JET_DOOR_1",

  "P_RANGE_GATE",
  "P_RANGE_GATE2",
  "RANGE_GATE2_R_DYN",
  "RANGE_GATE2_L_DYN",
  "P_E2_goldrangedoor",
  "CJ_NEW_BOWL_DOOR_R",
  "CJ_NEW_BOWL_DOOR_L",

  "E2_Maison_secdoor",
  "E2_Maisondoor16",
  "E2_Maisondoor17",
  "E2_Maisondoor18",

  "E2_XJoff_door02",

  "E2_Sky_door_L01",
  "E2_Sky_door_L02",
  "E2_Sky_door_L03",
  "E2_Sky_door_R01",
  "E2_Sky_door_R02"
];

// Episode constants matching gta.ivEpisode
const EP_IV = 0;
const EP_TLAD = 1;
const EP_TBOGT = 2;

// If an anchor has no `episodes` field, it's applied in all episodes.
const FIXED_ANCHORS = [
    { hash: -1452339441, x: 64535.0, y: 1223.0, z: 29.0 },
    { hash: -1452339441, x: 865.7, y: -517.8, z: 16.5 },
    { hash: 257820338, x: 850.8, y: -517.8, z: 16.5 },
    { hash: -1452339441, x: -1247.0, y: 1540.0, z: 26.0 },
    { hash: -1452339441, x: -1246.0, y: 1560.0, z: 26.0 },
    { hash: 807349477, x: 1314.0, y: 71.0, z: 42.0 },
    { hash: 807349477, x: 1367.0, y: 192.0, z: 28.0 },
    { hash: 807349477, x: 64323.0, y: 1096.0, z: 25.0 },
    { hash: -2113580896, x: 896.0, y: -504.0, z: 15.0 },
    { hash: 419786306, x: 882.0, y: -29.0, z: 29.0 },
    { hash: 419786306, x: 65439.0, y: 878.0, z: 15.0 },
    { hash: 419786306, x: 64574.0, y: 893.0, z: 14.0 },
    { hash: -431164822, x: -28.0, y: -463.0, z: 16.0 },
    { hash: 866127123, x: -28.0, y: -466.0, z: 16.0 },
    { hash: -431164822, x: -28.0, y: -467.0, z: 16.0 },
    { hash: 866127123, x: -28.0, y: -470.0, z: 16.0 },
    { hash: -223135715, x: -160.0, y: 591.0, z: 119.0 },
    { hash: -223135715, x: -160.0, y: 593.0, z: 119.0 },
    { hash: 804737190, x: 561.9761, y: 1391.626, z: 30.855 },
    { hash: 387699963, x: 943.0, y: -493.0, z: 16.0 },
    { hash: 261592072, x: 597.0, y: 1400.0, z: 12.0 },
    { hash: 1033979537, x: -126.0, y: 1500.0, z: 23.0 },
    { hash: 1135556036, x: 1283.0, y: 400.0, z: 23.0 },
    { hash: -842872319, x: 1286.0, y: 400.0, z: 23.0 },
    { hash: -269541707, x: 64296.0, y: 1072.0, z: 20.0 },
    { hash: -269541707, x: 64293.0, y: 1074.0, z: 20.0 },
    { hash: -1413798865, x: 1143.0, y: 1670.0, z: 17.0 },

    { hashName: "cabaret_door_L", x: 965.7597, y: -274.3801, z: 17.2717 },
    { hashName: "cabaret_door_R", x: 966.3721, y: -277.2479, z: 17.3736 },
    { hashName: "cabaret_door_L", x: 965.8656, y: -274.3706, z: 17.2718 },
    { hashName: "cabaret_door_R", x: 966.4907, y: -276.1051, z: 17.2730 },
    { hashName: "cabaret_door_L", x: 957.5000, y: -273.4200, z: 18.4700 },
    { hashName: "cabaret_door_R", x: 957.5000, y: -273.4200, z: 18.4700 },
    { hashName: "cabaret_door_L", x: 965.0354, y: -271.3837, z: 18.1729 },
    { hashName: "cabaret_door_R", x: 965.0354, y: -271.3837, z: 18.1729 },

    { hash: -1212308722, x: 65008.0, y: 1262.0, z: 18.0 },
    { hash: -1212308722, x: -528.3, y: 1262.2, z: 17.7 },

    // TBOGT only
    { hash: 790510853, x: 65065.0, y: 148.0, z: 10.0, episodes: [EP_TBOGT] },
    { hash: -175426899, x: 65068.0, y: 153.0, z: 10.0, episodes: [EP_TBOGT] },
    { hash: -175426899, x: -468.0, y: 153.0, z: 10.0, episodes: [EP_TBOGT] },

    // TLAD + TBOGT
    { hash: 1643309849, x: 63810.0, y: 342.0, z: 27.0, episodes: [EP_TLAD, EP_TBOGT] },
    { hash: 1643309849, x: 63821.0, y: 354.0, z: 26.0, episodes: [EP_TLAD, EP_TBOGT] },
    { hash: 1292729623, x: 64913.0, y: 1207.0, z: 6.0, episodes: [EP_TLAD, EP_TBOGT] },
    { hash: 566666890, x: 64909.0, y: 1207.0, z: 6.0, episodes: [EP_TLAD, EP_TBOGT] },

    // TBOGT only
    { hash: -397503281, x: -474.0, y: 162.0, z: 10.0, episodes: [EP_TBOGT] },
    { hash: 2140720422, x: -390.2, y: 1487.7, z: 10.8, episodes: [EP_TBOGT] },
    { hash: 2140720422, x: -387.503, y: 1486.445, z: 10.847, episodes: [EP_TBOGT] },
    { hash: 2140720422, x: -386.9, y: 1486.4, z: 9.9, episodes: [EP_TBOGT] }
];

const LOCK_BRAIN_KILL_INTERVAL_MS = 4000;
const TEST_SINGLE_SWEEP_NO_REAPPLY = false;

let doorModelHashes = [];
let activeAnchors = [];
let initialized = false;
let nextBrainKillAt = 0;

// --- Resolved-once function references ---

const getNowMs = (function () {
    if (typeof natives !== "undefined" && typeof natives.getGameTimer === "function") {
        return function () { return natives.getGameTimer(); };
    }
    if (typeof GetGameTimer === "function") {
        return function () { return GetGameTimer(); };
    }
    return function () { return Date.now(); };
})();

const setDoorUnlockedAt = (typeof Vec3 !== "undefined")
    ? function (modelHash, worldX, worldY, worldZ) {
        try {
            natives.setStateOfClosestDoorOfType(modelHash, new Vec3(worldX, worldY, worldZ), 0, 0.0);
        } catch (e) {
            console.log(`[err]  setStateOfClosestDoorOfType(hash=${modelHash}, x=${worldX}, y=${worldY}, z=${worldZ}) threw: ${e && e.message}`);
        }
    }
    : function (modelHash, worldX, worldY, worldZ) {
        try {
            natives.setStateOfClosestDoorOfType(modelHash, worldX, worldY, worldZ, 0, 0.0);
        } catch (e) {
            console.log(`[err]  setStateOfClosestDoorOfType(hash=${modelHash}, x=${worldX}, y=${worldY}, z=${worldZ}) threw: ${e && e.message}`);
        }
    };

// --- Helpers ---

function isIntervalDue(nowMs, nextDueMs) {
    return nowMs >= nextDueMs;
}

function getCurrentEpisode() {
    try {
        if (typeof gta !== "undefined" && typeof gta.ivEpisode !== "undefined") {
            return gta.ivEpisode | 0;
        }
    } catch (e) {
        console.log(`[err]  getCurrentEpisode threw: ${e && e.message}`);
    }
    return EP_IV;
}

function anchorAppliesToEpisode(anchor, episode) {
    if (!anchor.episodes) return true;
    for (let i = 0; i < anchor.episodes.length; i++) {
        if (anchor.episodes[i] === episode) return true;
    }
    return false;
}

function showMsg(text) {
    try {
        if (typeof showMessage === "function") {
            showMessage(text);
            return;
        }
        if (typeof natives !== "undefined" && typeof natives.printStringWithLiteralStringNow === "function") {
            natives.printStringWithLiteralStringNow("STRING", text, 2500, true);
        }
    } catch (e) {
        console.log(`[err]  showMsg threw: ${e && e.message}`);
    }
}

function getHash(modelName) {
    try {
        if (natives && typeof natives.getHashKey === "function") {
            return natives.getHashKey(modelName);
        }
    } catch (e) {
        console.log(`[err]  natives.getHashKey(${JSON.stringify(modelName)}) threw: ${e && e.message}`);
    }
    return 0;
}

function killLockBrains() {
    if (!natives || typeof natives.terminateAllScriptsWithThisName !== "function") return;
    for (let i = 0; i < LOCK_BRAINS.length; i++) {
        const brainName = LOCK_BRAINS[i];
        try {
            natives.terminateAllScriptsWithThisName(brainName);
        } catch (e) {
            console.log(`[err]  terminateAllScriptsWithThisName(${JSON.stringify(brainName)}) threw: ${e && e.message}`);
        }
    }
}

// --- One-time setup ---

function buildDoorModelHashes() {
    const seenHashes = {};
    doorModelHashes = [];

    for (let i = 0; i < DOOR_MODEL_NAMES.length; i++) {
        const modelHash = getHash(DOOR_MODEL_NAMES[i]);
        if (modelHash && !seenHashes[modelHash]) {
            seenHashes[modelHash] = true;
            doorModelHashes.push(modelHash);
        }
    }
}

function buildActiveAnchors() {
    const episode = getCurrentEpisode();
    activeAnchors = [];

    for (let i = 0; i < FIXED_ANCHORS.length; i++) {
        const anchor = FIXED_ANCHORS[i];
        if (!anchorAppliesToEpisode(anchor, episode)) continue;

        let modelHash = anchor.hash;
        if (!modelHash && anchor.hashName) modelHash = getHash(anchor.hashName);
        if (!modelHash) continue;

        activeAnchors.push({
            hash: modelHash,
            x: anchor.x,
            y: anchor.y,
            z: anchor.z
        });
    }
}

function initializeOnce() {
    if (initialized) return;
    buildDoorModelHashes();
    buildActiveAnchors();
    initialized = true;
}

// --- Hot paths ---

function unlockFixedAnchors() {
    for (let i = 0; i < activeAnchors.length; i++) {
        const anchor = activeAnchors[i];
        setDoorUnlockedAt(anchor.hash, anchor.x, anchor.y, anchor.z);
    }
}

function unlockGlobalSweepFullOnce() {
    if (!doorModelHashes.length || typeof globalSweepAnchors === "undefined" || !globalSweepAnchors.length) {
        return;
    }

    const offsets = [
        [0.0, 0.0, 0.0],
        [2.0, 0.0, 0.0], [-2.0, 0.0, 0.0],
        [0.0, 2.0, 0.0], [0.0, -2.0, 0.0],
        [4.0, 0.0, 0.0], [-4.0, 0.0, 0.0],
        [0.0, 4.0, 0.0], [0.0, -4.0, 0.0]
    ];

    for (let anchorIdx = 0; anchorIdx < globalSweepAnchors.length; anchorIdx++) {
        const sweepAnchor = globalSweepAnchors[anchorIdx];
        if (!sweepAnchor) continue;

        for (let modelIdx = 0; modelIdx < doorModelHashes.length; modelIdx++) {
            const modelHash = doorModelHashes[modelIdx];

            for (let offsetIdx = 0; offsetIdx < offsets.length; offsetIdx++) {
                const offset = offsets[offsetIdx];
                setDoorUnlockedAt(
                    modelHash,
                    sweepAnchor.x + offset[0],
                    sweepAnchor.y + offset[1],
                    sweepAnchor.z + offset[2]
                );
            }
        }
    }
}

function applyBrainKillCycle() {
    initializeOnce();
    killLockBrains();
    unlockFixedAnchors();
}

// --- Event handlers ---

addEventHandler("OnResourceStart", function (event, resource) {
    try {
        if (resource && resource !== thisResource) return;

        initializeOnce();

        if (TEST_SINGLE_SWEEP_NO_REAPPLY) {
            killLockBrains();
            unlockFixedAnchors();
            unlockGlobalSweepFullOnce();
            showMsg("Door unlock test mode: one sweep applied (no reapply).");
            return;
        }

        killLockBrains();
        unlockFixedAnchors();
        unlockGlobalSweepFullOnce();
        nextBrainKillAt = getNowMs() + LOCK_BRAIN_KILL_INTERVAL_MS;
    } catch (e) {
        console.log(`[err]  OnResourceStart threw: ${e && e.message}`);
    }
});

addEventHandler("OnProcess", function () {
    if (TEST_SINGLE_SWEEP_NO_REAPPLY) return;

    const nowMs = getNowMs();
    if (!isIntervalDue(nowMs, nextBrainKillAt)) return;

    try {
        applyBrainKillCycle();
        nextBrainKillAt = nowMs + LOCK_BRAIN_KILL_INTERVAL_MS;
    } catch (e) {
        console.log(`[err]  OnProcess threw: ${e && e.message}`);
    }
});
