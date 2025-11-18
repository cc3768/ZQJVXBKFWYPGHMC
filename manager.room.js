// manager.room.js
// Per-room orchestration: spawn logic, caching and basic logging.

const SpawnManager = require("manager.spawn");
const TowerManager = require("manager.tower");
const MemoryUtil   = require("util.memory");
const RoomManager = {
    /**
     * Main entry point, call once per tick.
     */
    run() {
        const roomNames = Object.keys(Game.rooms);
        const isLogTick   = Game.time % 50 === 0;
        const isCacheTick = Game.time % 20 === 0;

        for (let i = 0; i < roomNames.length; i++) {
            const room = Game.rooms[roomNames[i]];
            if (!room || !room.controller || !room.controller.my) continue;

            // Pre-fetch creeps for this room once and reuse
            const creeps = room.find(FIND_MY_CREEPS);

            // Run spawn logic for all spawns in the room
            const spawns = room.find(FIND_MY_SPAWNS);
            for (let j = 0; j < spawns.length; j++) {
                SpawnManager.run(spawns[j], creeps);
            }

            // Operate towers (defense/repairs)
            TowerManager.run(room);

            // Periodic logging and memory updates
            if (isLogTick) {
                this._logRoomStatus(room, creeps);
            }

            // Cache structures periodically for faster lookups
            if (isCacheTick) {
                MemoryUtil.cacheRoomStructures(room);
            }
        }

        // Cleanup memory every tick (cheap and keeps Memory tidy)
        MemoryUtil.cleanup();
    },

    /**
     * Log room status information.
     *
     * @param {Room} room
     * @param {Creep[]} creepsInRoom
     * @private
     */
    _logRoomStatus(room, creepsInRoom) {
        const rcl       = room.controller.level;
        const energy    = room.energyAvailable;
        const capacity  = room.energyCapacityAvailable;
        const creepCount = creepsInRoom.length;

        console.log(
            `[Room ${room.name}] ` +
            `RCL ${rcl} | ` +
            `Energy ${energy}/${capacity} | ` +
            `Creeps ${creepCount}`
        );
    }
};

module.exports = RoomManager;
