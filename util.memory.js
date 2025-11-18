// util.memory.js
// Memory management and cleanup utilities for Screeps

/**
 * Helpers for keeping Memory in a sane state:
 *  - Removing dead creep/flag memory
 *  - Initializing room memory
 *  - Caching structures by type
 *  - Simple memory statistics
 */
const MemoryUtil = {
    /**
     * Clean up dead creep & flag memory and ensure room memory shape.
     * Call once per tick from main loop.
     */
    cleanup() {
        // --- Creeps ---
        if (Memory.creeps) {
            for (const name in Memory.creeps) {
                if (!Game.creeps[name]) {
                    delete Memory.creeps[name];
                }
            }
        }

        // --- Flags ---
        if (Memory.flags) {
            for (const name in Memory.flags) {
                if (!Game.flags[name]) {
                    delete Memory.flags[name];
                }
            }
        }

        // --- Rooms ---
        if (!Memory.rooms) Memory.rooms = {};

        for (const roomName in Game.rooms) {
            if (!Memory.rooms[roomName]) {
                Memory.rooms[roomName] = {
                    lastUpdate: Game.time,
                    structures: {},
                    creeps: {}
                };
            }
        }
    },

    /**
     * Get or initialize room memory.
     *
     * @param {string} roomName
     * @returns {{lastUpdate:number,structures:Object,creeps:Object}}
     */
    getRoomMemory(roomName) {
        if (!Memory.rooms) Memory.rooms = {};

        if (!Memory.rooms[roomName]) {
            Memory.rooms[roomName] = {
                lastUpdate: Game.time,
                structures: {},
                creeps: {}
            };
        }

        return Memory.rooms[roomName];
    },

    /**
     * Cache structure positions by type for faster lookups.
     * Call periodically (e.g. every 20 ticks) from main loop.
     *
     * @param {Room} room
     */
    cacheRoomStructures(room) {
        const mem = this.getRoomMemory(room.name);

        // Only update cache every 20 ticks to save CPU
        if (mem.lastStructureCache && Game.time - mem.lastStructureCache < 20) {
            return;
        }

        /** @type {Record<string, Array<{id:string,x:number,y:number}>>} */
        const byType = Object.create(null);
        const structures = room.find(FIND_STRUCTURES);

        for (let i = 0; i < structures.length; i++) {
            const s = structures[i];
            const type = s.structureType;

            if (!byType[type]) {
                byType[type] = [];
            }

            byType[type].push({
                id: s.id,
                x: s.pos.x,
                y: s.pos.y
            });
        }

        mem.structures = byType;
        mem.lastStructureCache = Game.time;
    },

    /**
     * Get cached structures by type for a room.
     *
     * @param {string} roomName
     * @param {string} structureType
     * @returns {Array<{id:string,x:number,y:number}>}
     */
    getCachedStructures(roomName, structureType) {
        const mem = this.getRoomMemory(roomName);
        const bucket = mem.structures && mem.structures[structureType];
        return bucket || [];
    },

    /**
     * Get simple memory usage statistics.
     *
     * @returns {{creeps:number,rooms:number,total:number}}
     */
    getMemoryStats() {
        let creepCount = 0;
        let roomCount = 0;

        if (Memory.creeps) {
            for (const name in Memory.creeps) creepCount++;
        }
        if (Memory.rooms) {
            for (const name in Memory.rooms) roomCount++;
        }

        // Note: JSON.stringify is CPU-expensive; only call this in diagnostics.
        const totalSize = JSON.stringify(Memory).length;

        return {
            creeps: creepCount,
            rooms: roomCount,
            total: totalSize
        };
    },

    /**
     * Clear old path caches from creep memory (older than 100 ticks).
     * Designed to work with util.pathing.
     */
    cleanPathCaches() {
        const currentTick = Game.time;

        if (!Memory.creeps) return;

        for (const name in Memory.creeps) {
            const mem = Memory.creeps[name];

            if (mem._pathTarget && mem._pathSetTick && currentTick - mem._pathSetTick > 100) {
                delete mem._path;
                delete mem._pathTarget;
                delete mem._pathSetTick;
            }
        }
    }
};

module.exports = MemoryUtil;
