// planner.road.usage.js
// Handles movement heatmap + dynamic usage-based road placement

const Config = require("config");

/**
 * Dynamic road planner:
 *  - Tracks how often creeps step on tiles.
 *  - Periodically converts high-usage tiles into roads.
 */
const RoadUsagePlanner = {
    // ---------------- INTERNAL: USAGE MEMORY ----------------

    /**
     * Get or initialize usage object for a room.
     *
     * @param {string} roomName
     * @returns {Record<string, number>}
     * @private
     */
    _getRoomUsage(roomName) {
        if (!Memory.roadUsage) Memory.roadUsage = {};
        if (!Memory.roadUsage[roomName]) Memory.roadUsage[roomName] = {};
        return Memory.roadUsage[roomName];
    },

    // ---------------- PUBLIC: TRACK MOVEMENT ----------------

    /**
     * Call once per tick per creep (after its behavior).
     * Builds a "heatmap" of how often tiles are walked on.
     *
     * @param {Creep} creep
     */
    trackStep(creep) {
        if (!creep || !creep.room || !creep.pos) return;

        const roomName = creep.room.name;
        const usage = this._getRoomUsage(roomName);

        const pos = creep.pos;
        const last = creep.memory._lastPos;
        const key = `${pos.x}:${pos.y}`;

        // Only count when the creep moved onto a NEW tile
        if (
            !last ||
            last.x !== pos.x ||
            last.y !== pos.y ||
            last.roomName !== roomName
        ) {
            usage[key] = (usage[key] || 0) + 1;
        }

        creep.memory._lastPos = {
            x: pos.x,
            y: pos.y,
            roomName
        };
    },

    // ---------------- PUBLIC: DYNAMIC ROADS (HEATMAP) ----------------

    /**
     * Uses the movement heatmap to place road construction sites
     * on heavily-used tiles. Runs periodically.
     *
     * @param {Room} room
     */
    run(room) {
        if (!room.controller || !room.controller.my) return;

        // Only tick every N ticks to save CPU
        if (Game.time % Config.ROADS.TICK_INTERVAL !== 0) return;

        const roomName = room.name;
        const usage = this._getRoomUsage(roomName);
        const terrain = room.getTerrain();
        const maxCreeps = Config.POPULATION.maxCreepsForRCL(room.controller.level);

        // Raise threshold as room gets more populated
        const dynamicMinUsage =
            Config.ROADS.MIN_USAGE_FOR_ROAD + Math.max(0, maxCreeps - 10) * 5;

        let created = 0;
        let entries = Object.entries(usage);

        // Hard cap number of tracked tiles for memory sanity
        if (entries.length > Config.ROADS.MAX_TILES_PER_ROOM) {
            entries.sort((a, b) => a[1] - b[1]); // least used first
            const toDrop = entries.length - Config.ROADS.MAX_TILES_PER_ROOM;
            for (let i = 0; i < toDrop; i++) {
                delete usage[entries[i][0]];
            }
            entries = entries.slice(toDrop);
        }

        const spawns = room.find(FIND_MY_SPAWNS);
        const controller = room.controller;

        for (const [key, count] of entries) {
            if (created >= Config.ROADS.MAX_CONSTRUCTION_SITES_PER_RUN) break;

            // Decay usage value each run
            const decayed = Math.max(0, count - Config.ROADS.DECAY_PER_RUN);
            usage[key] = decayed;

            if (decayed < dynamicMinUsage) continue;

            const [xs, ys] = key.split(":");
            const x = Number(xs);
            const y = Number(ys);

            if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                delete usage[key];
                continue;
            }

            // Skip controller tile
            if (controller &&
                controller.pos.x === x &&
                controller.pos.y === y) {
                continue;
            }

            // Skip spawn tiles
            if (spawns.some(s => s.pos.x === x && s.pos.y === y)) continue;

            const pos = new RoomPosition(x, y, roomName);

            const structures = room.lookForAt(LOOK_STRUCTURES, pos);
            if (structures.some(s => s.structureType === STRUCTURE_ROAD)) {
                delete usage[key];
                continue;
            }

            const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
            if (sites.some(s => s.structureType === STRUCTURE_ROAD)) continue;

            const res = room.createConstructionSite(pos, STRUCTURE_ROAD);
            if (res === OK) {
                created++;
                usage[key] = 0;
            }
        }
    }
};

module.exports = RoadUsagePlanner;
