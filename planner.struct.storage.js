// planner.struct.storage.js
// Handles storage placement (RCL4+)

/**
 * Storage planner: positions storage relative to spawn with simple heuristics.
 */
const StorageStructPlanner = {
    /**
     * @param {Room} room
     * @param {object} layout - Memory.storageLayout[room.name]
     * @param {number} rcl
     */
    plan(room, layout, rcl) {
        // Storage unlocks at RCL 4
        if (rcl < 4) return;

        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return;

        const terrain = room.getTerrain();

        /**
         * Is this tile acceptable for storage?
         *
         * @param {number} x
         * @param {number} y
         * @returns {boolean}
         */
        const isWalkableForStorage = (x, y) => {
            if (x < 0 || x > 49 || y < 0 || y > 49) return false;
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) return false;

            const pos = new RoomPosition(x, y, room.name);

            const structures = room.lookForAt(LOOK_STRUCTURES, pos);
            // Allow empty / roads / containers only
            if (structures.some(s =>
                s.structureType !== STRUCTURE_ROAD &&
                s.structureType !== STRUCTURE_CONTAINER
            )) {
                return false;
            }

            const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
            if (sites.length > 0) return false;

            return true;
        };

        let storagePos = null;

        // 1) Prefer built storage
        if (room.storage) {
            storagePos = room.storage.pos;
        }
        // 2) Next, previously planned layout position
        else if (layout.storagePos) {
            storagePos = new RoomPosition(layout.storagePos.x, layout.storagePos.y, room.name);
        }
        // 3) Otherwise, search around spawn
        else {
            // Immediate neighbors first
            const offsets = [
                { dx: 1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: -1 },
                { dx: 1, dy: 1 },
                { dx: 1, dy: -1 },
                { dx: -1, dy: 1 },
                { dx: -1, dy: -1 }
            ];

            for (const off of offsets) {
                const x = spawn.pos.x + off.dx;
                const y = spawn.pos.y + off.dy;
                if (isWalkableForStorage(x, y)) {
                    storagePos = new RoomPosition(x, y, room.name);
                    break;
                }
            }

            // If nothing close, search a small ring
            for (let radius = 2; radius <= 3 && !storagePos; radius++) {
                for (let dx = -radius; dx <= radius && !storagePos; dx++) {
                    for (let dy = -radius; dy <= radius && !storagePos; dy++) {
                        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

                        const x = spawn.pos.x + dx;
                        const y = spawn.pos.y + dy;

                        if (isWalkableForStorage(x, y)) {
                            storagePos = new RoomPosition(x, y, room.name);
                            break;
                        }
                    }
                }
            }
        }

        if (!storagePos) return;

        // Persist position in layout so road planner etc can use it
        layout.storagePos = { x: storagePos.x, y: storagePos.y };

        // If storage not yet built, ensure a construction site exists
        if (!room.storage) {
            const structs = room.lookForAt(LOOK_STRUCTURES, storagePos);
            const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, storagePos);

            const hasStorage = structs.some(s => s.structureType === STRUCTURE_STORAGE);
            const hasSite = sites.some(s => s.structureType === STRUCTURE_STORAGE);

            if (!hasStorage && !hasSite) {
                room.createConstructionSite(storagePos, STRUCTURE_STORAGE);
            }
        }
    }
};

module.exports = StorageStructPlanner;
