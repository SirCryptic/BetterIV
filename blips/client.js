"use strict";

let blips = []; // Array to store blip handles and positions for dynamic scaling

bindEventHandler("OnResourceStart", thisResource, function(event, resource) {
    // Strip Clubs with BLIP_STRIP_CLUB (66)
    const stripClubs = [
        { name: "The Triangle Club", pos: new Vec3(1192.071, 1698.383, 17.727) }, // Algonquin
        { name: "Honkers", pos: new Vec3(-1581.589, 24.834, 10.036) } // Alderney
    ];

    stripClubs.forEach(club => {
        try {
            let blipHandle = natives.addBlipForCoord(club.pos);
            natives.changeBlipSprite(blipHandle, 66); // BLIP_STRIP_CLUB
            natives.changeBlipColour(blipHandle, 0); // Default color
            natives.changeBlipScale(blipHandle, 1.0); // Initial scale
            natives.changeBlipDisplay(blipHandle, 2); // Show on radar and map
            natives.setBlipAsShortRange(blipHandle, false); // Always visible
            blips.push({ handle: blipHandle, pos: club.pos });
            console.log(`[BLIPS] Created strip club blip for ${club.name} at (${club.pos.x}, ${club.pos.y}, ${club.pos.z})`);
        } catch (e) {
            console.log(`[BLIPS] Error creating strip club blip for ${club.name}: ${e.message}`);
        }
    });
});

addEventHandler("OnProcess", function(event, deltaTime) {
    if (localPlayer == null) return;

    const playerPos = localPlayer.position;
    const maxDistance = 1000.0; // Distance at which scale starts to decrease (adjust as needed)
    const minScale = 0.5; // Minimum scale when far away
    const maxScale = 1.0; // Maximum scale when close

    blips.forEach(blip => {
        const distance = playerPos.distance(blip.pos);
        let scale = maxScale - (distance / maxDistance) * (maxScale - minScale);
        scale = Math.max(minScale, Math.min(maxScale, scale)); // Clamp between min and max
        natives.changeBlipScale(blip.handle, scale);
    });
});

bindEventHandler("OnResourceStop", thisResource, function(event, resource) {
    console.log("[BLIPS] Blips resource stopped.");
});
