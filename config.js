// config.js
// Centralized configuration for roles, population, spawning, pathing and roads.

const ROLES = Object.freeze({
    HARVESTER: "harvester",
    UPGRADER:  "upgrader",
    BUILDER:   "builder"
});

const POPULATION = {
    // Target minimums per room
    MIN_HARVESTERS: 3,
    MIN_UPGRADERS:  4,
    MIN_BUILDERS:   1,

    // In an emergency (no harvesters), we want at least this many ASAP
    EMERGENCY_HARVESTERS: 2,

    /**
     * Max creeps per room, scaled by controller level.
     * @param {number} rcl
     * @returns {number}
     */
    maxCreepsForRCL(rcl) {
        if (rcl <= 1) return 8;
        if (rcl === 2) return 12;
        if (rcl === 3) return 16;
        if (rcl === 4) return 20;
        if (rcl === 5) return 24;
        if (rcl === 6) return 28;
        if (rcl === 7) return 32;
        return 36; // RCL 8
    },

    // Threshold for "econ is critical, be conservative" for jobs
    MIN_ROOM_ENERGY_TO_SPAWN: 200,

    // Minimum energy to allow an emergency cheap harvester
    EMERGENCY_MIN_ENERGY: 200
};

const SPAWN = {
    // Standard bodies keyed by lowercase role name
    BODY: Object.freeze({
        [ROLES.HARVESTER]: [WORK, WORK, CARRY, MOVE, MOVE],
        [ROLES.UPGRADER]:  [WORK, CARRY, CARRY, MOVE, MOVE],
        [ROLES.BUILDER]:   [WORK, CARRY, CARRY, MOVE, MOVE]
    }),

    // Super-cheap emergency body when we have zero harvesters
    EMERGENCY_BODY: Object.freeze({
        [ROLES.HARVESTER]: [WORK, CARRY, MOVE] // 200 energy
    }),

    // Relative priorities if you later want a more advanced spawn scoring system
    PRIORITY: Object.freeze({
        [ROLES.HARVESTER]: 1,
        [ROLES.UPGRADER]:  2,
        [ROLES.BUILDER]:   3
    })
};

const PATHING = Object.freeze({
    STUCK_TICKS: 3,
    MAX_OPS: 2000
});

const ROADS = Object.freeze({
    // Slightly lower so heatmap roads appear earlier
    MIN_USAGE_FOR_ROAD: 20,
    DECAY_PER_RUN: 1,
    MAX_TILES_PER_ROOM: 500,
    MAX_CONSTRUCTION_SITES_PER_RUN: 3,
    TICK_INTERVAL: 5
});

const DEFENSE = Object.freeze({
    ENABLED: true,
    START_RCL: 3,                 // Start planning defenses once ramparts are allowed
    MAX_RAMPART_SITES_PER_RUN: 8, // Ramparts per planning tick
    MAX_TOWER_SITES_PER_RUN: 1,   // Towers are expensive, trickle-build them
    REPAIR: Object.freeze({
        MIN_TOWER_ENERGY: 300,     // Don't repair if towers are too low on energy
        NON_WALL_THRESHOLD: 0.8,   // Repair other structures when below 80%
        RAMPART_TARGET_HITS: 150000,
        WALL_TARGET_HITS: 250000
    })
});

const UPGRADE = Object.freeze({
    STORAGE_ENERGY_THRESHOLD: 50000, // Start spawning bonus upgraders once storage is healthy
    MAX_BONUS_UPGRADERS: 2
});

module.exports = {
    ROLES,
    POPULATION,
    SPAWN,
    PATHING,
    ROADS,
    DEFENSE,
    UPGRADE
};
