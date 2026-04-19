// Author: SirCryptic - for GTA Connected IV & EFLC 
// Description: Force unlocks all known locked doors by hash and position, and terminates known lock script brains.
"use strict";

const LOCK_BRAINS = [
  "ambJimsLocks",
  "ambjimslocks",
  "ambgerry3doorlock",
  "ambCabaret",
  "ambcabaret"
];

// All known locked door model names.
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

// Hardcoded anchors known to be re-locked by script brains
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
  { hash: -308312378, x: 95.0, y: 64854.0, z: 15.0 },
  { hash: 487482787, x: 95.0, y: 64851.0, z: 15.0 },
  { hash: 693041505, x: 815.0, y: 65278.0, z: 16.0 },
  { hash: 693041505, x: 821.0, y: 65271.0, z: 16.0 },
  { hash: 804737190, x: 561.9761, y: 1391.626, z: 30.855 },
  { hash: 387699963, x: 943.0, y: -493.0, z: 16.0 },
  { hash: 261592072, x: 597.0, y: 1400.0, z: 12.0 },
  { hash: 1033979537, x: -126.0, y: 1500.0, z: 23.0 },
  { hash: 1135556036, x: 1283.0, y: 400.0, z: 23.0 },
  { hash: -842872319, x: 1286.0, y: 400.0, z: 23.0 },
  { hash: 880887899, x: 64395.0, y: 65164.0, z: 4.0 },
  { hash: 641313740, x: 64395.0, y: 65158.0, z: 4.0 },
  { hash: -269541707, x: 64296.0, y: 1072.0, z: 20.0 },
  { hash: -269541707, x: 64293.0, y: 1074.0, z: 20.0 },
  { hash: -1413798865, x: 1143.0, y: 1670.0, z: 17.0 },

  // Conrad/Cabaret front and near-front anchors.
  { hashName: "cabaret_door_L", x: 965.7597, y: -274.3801, z: 17.2717 },
  { hashName: "cabaret_door_R", x: 966.3721, y: -277.2479, z: 17.3736 },
  { hashName: "cabaret_door_L", x: 965.8656, y: -274.3706, z: 17.2718 },
  { hashName: "cabaret_door_R", x: 966.4907, y: -276.1051, z: 17.2730 },
  { hashName: "cabaret_door_L", x: 957.5000, y: -273.4200, z: 18.4700 },
  { hashName: "cabaret_door_R", x: 957.5000, y: -273.4200, z: 18.4700 },
  { hashName: "cabaret_door_L", x: 965.0354, y: -271.3837, z: 18.1729 },
  { hashName: "cabaret_door_R", x: 965.0354, y: -271.3837, z: 18.1729 },

  // Additional scripted lock hashes found in mission/ambient scripts.
  { hash: -1212308722, x: 65008.0, y: 1262.0, z: 18.0 },
  { hash: -1212308722, x: -528.3, y: 1262.2, z: 17.7 },

  { hash: 790510853, x: 65065.0, y: 148.0, z: 10.0 },
  { hash: -175426899, x: 65068.0, y: 153.0, z: 10.0 },
  { hash: -175426899, x: -468.0, y: 153.0, z: 10.0 },

  { hash: 1461381085, x: 65387.0, y: 65281.0, z: 36.0 },

  { hash: 1643309849, x: 63810.0, y: 342.0, z: 27.0 },
  { hash: 1643309849, x: 63821.0, y: 354.0, z: 26.0 },

  { hash: 1292729623, x: 64913.0, y: 1207.0, z: 6.0 },
  { hash: 566666890, x: 64909.0, y: 1207.0, z: 6.0 },

  { hash: 2124429686, x: 63586.0, y: 65458.0, z: 7.0 },

  { hash: -397503281, x: -474.0, y: 162.0, z: 10.0 },

  { hash: 2140720422, x: -390.2, y: 1487.7, z: 10.8 },
  { hash: 2140720422, x: -387.503, y: 1486.445, z: 10.847 },
  { hash: 2140720422, x: -386.9, y: 1486.4, z: 9.9 }
];

const APPLY_INTERVAL_MS = 150;
const GLOBAL_SWEEP_ANCHORS_PER_TICK = 6;
let lastApply = 0;
let modelHashes = [];
let initialized = false;
let globalSweepIndex = 0;
let globalSweepAnchors = [];

function showMsg(msg) {
  try {
    if (typeof showMessage === "function") {
      showMessage(msg);
      return;
    }
    if (typeof natives !== "undefined" && typeof natives.printStringWithLiteralStringNow === "function") {
      natives.printStringWithLiteralStringNow("STRING", msg, 2500, true);
    }
  } catch (e) {}
}

function getHash(name) {
  try {
    if (natives && typeof natives.getHashKey === "function") {
      return natives.getHashKey(name);
    }
  } catch (e) {}
  return 0;
}

function killLockBrains() {
  try {
    if (!natives || typeof natives.terminateAllScriptsWithThisName !== "function") return;
    for (let i = 0; i < LOCK_BRAINS.length; i++) {
      try { natives.terminateAllScriptsWithThisName(LOCK_BRAINS[i]); } catch (e) {}
    }
  } catch (e) {}
}

function setDoorUnlockedAt(hash, x, y, z) {
  try {
    if (!natives || typeof natives.setStateOfClosestDoorOfType !== "function") return false;

    if (typeof Vec3 !== "undefined") {
      natives.setStateOfClosestDoorOfType(hash, new Vec3(x, y, z), 0, 0.0);
      return true;
    }

    natives.setStateOfClosestDoorOfType(hash, x, y, z, 0, 0.0);
    return true;
  } catch (e) {
    return false;
  }
}

function buildHashes() {
  const uniq = {};
  modelHashes = [];

  for (let i = 0; i < DOOR_MODEL_NAMES.length; i++) {
    const h = getHash(DOOR_MODEL_NAMES[i]);
    if (h && !uniq[h]) {
      uniq[h] = true;
      modelHashes.push(h);
    }
  }

  initialized = true;
}

function buildGlobalSweepAnchors() {
  const uniq = {};
  globalSweepAnchors = [];

  for (let i = 0; i < FIXED_ANCHORS.length; i++) {
    const a = FIXED_ANCHORS[i];
    if (!a) continue;

    const x = Number(a.x);
    const y = Number(a.y);
    const z = Number(a.z);
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;

    const key = `${Math.round(x * 10) / 10}|${Math.round(y * 10) / 10}|${Math.round(z * 10) / 10}`;
    if (uniq[key]) continue;

    uniq[key] = true;
    globalSweepAnchors.push({ x: x, y: y, z: z });
  }

  if (!globalSweepAnchors.length) {
    globalSweepAnchors.push({ x: 0.0, y: 0.0, z: 0.0 });
  }
}

function unlockFixedAnchors() {
  let count = 0;

  for (let i = 0; i < FIXED_ANCHORS.length; i++) {
    const a = FIXED_ANCHORS[i];
    let hash = a.hash;

    if (!hash && a.hashName) hash = getHash(a.hashName);
    if (!hash) continue;

    if (setDoorUnlockedAt(hash, a.x, a.y, a.z)) count++;
  }

  return count;
}

// Force unlock by sweeping static world anchors (no player-position dependency)
function unlockGlobalSweepBatch() {
  if (!modelHashes.length || !globalSweepAnchors.length) return 0;

  const offsets = [
    [0.0, 0.0, 0.0],
    [2.0, 0.0, 0.0], [-2.0, 0.0, 0.0],
    [0.0, 2.0, 0.0], [0.0, -2.0, 0.0],
    [4.0, 0.0, 0.0], [-4.0, 0.0, 0.0],
    [0.0, 4.0, 0.0], [0.0, -4.0, 0.0]
  ];

  let count = 0;
  const anchorCount = globalSweepAnchors.length;
  const steps = Math.min(GLOBAL_SWEEP_ANCHORS_PER_TICK, anchorCount);

  for (let a = 0; a < steps; a++) {
    const idx = (globalSweepIndex + a) % anchorCount;
    const p = globalSweepAnchors[idx];
    if (!p) continue;

    for (let i = 0; i < modelHashes.length; i++) {
      const h = modelHashes[i];

      for (let j = 0; j < offsets.length; j++) {
        const o = offsets[j];
        const x = p.x + o[0];
        const y = p.y + o[1];
        const z = p.z + o[2];

        if (setDoorUnlockedAt(h, x, y, z)) count++;
      }
    }
  }

  globalSweepIndex = (globalSweepIndex + steps) % anchorCount;

  return count;
}

function applyIfDue(force) {
  const now = Date.now ? Date.now() : (new Date()).getTime();
  if (!force && (now - lastApply) < APPLY_INTERVAL_MS) return;
  lastApply = now;

  if (!initialized) buildHashes();
  if (!globalSweepAnchors.length) buildGlobalSweepAnchors();

  killLockBrains();
  unlockFixedAnchors();
  unlockGlobalSweepBatch();
}

addEventHandler("OnResourceStart", function(event, resource) {
  try {
    if (resource && resource !== thisResource) return;
    buildHashes();
    buildGlobalSweepAnchors();
    applyIfDue(true);
  } catch (e) {}
});

addEventHandler("OnProcess", function() {
  try { applyIfDue(false); } catch (e) {}
});
