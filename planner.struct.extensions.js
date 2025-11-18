// planner.struct.extensions.js
// Handles auto-placing extensions near spawn, obeying controller limits

/**
 * Extensions planner: keeps extensions around spawn in ring layers.
 */
const ExtensionsPlanner = {
    /**
     * Plan extension construction for a room.
     *
     * @param {Room} room
     * @param {object} layout - Memory.storageLayout[room.name]
     * @param {number} rcl    - room.controller.level
     */
    plan(room, layout, rcl) {
        const allowed = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][rcl] || 0;
        if (allowed <= 0) return;

        const existing = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        }).length;

        const pending = room.find(FIND_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        }).length;

        let remaining = allowed - existing - pending;
        if (remaining <= 0) return;

        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return;

        const terrain = room.getTerrain();

        /**
         * Validate that a tile can host an extension.
         *
         * @param {number} x
         * @param {number} y
         * @returns {boolean}
         */
        const isGoodExtensionSpot = (x, y) => {
            if (x < 0 || x > 49 || y < 0 || y > 49) return false;
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) return false;

            if (spawn.pos.x === x && spawn.pos.y === y) return false;

            const pos = new RoomPosition(x, y, room.name);

            // Existing structures: only allow roads/containers (we can place on empty)
            const structures = room.lookForAt(LOOK_STRUCTURES, pos);
            if (structures.some(s =>
                s.structureType !== STRUCTURE_ROAD &&
                s.structureType !== STRUCTURE_CONTAINER
            )) {
                return false;
            }

            // No existing construction site at all
            const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
            if (sites.length > 0) return false;

            return true;
        };

        // Place extensions on diamond rings around spawn
        for (let radius = 2; radius <= 6 && remaining > 0; radius++) {
            for (let dx = -radius; dx <= radius && remaining > 0; dx++) {
                for (let dy = -radius; dy <= radius && remaining > 0; dy++) {
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

                    const x = spawn.pos.x + dx;
                    const y = spawn.pos.y + dy;

                    if (!isGoodExtensionSpot(x, y)) continue;

                    const res = room.createConstructionSite(x, y, STRUCTURE_EXTENSION);
                    if (res === OK) {
                        remaining--;
                    }
                }
            }
        }
    }
};

module.exports = ExtensionsPlanner;
