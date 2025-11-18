// main.js
// Central game loop: room management, planning, creep behavior, profiling.

const Config         = require('config');
const RoomManager    = require('manager.room');
const MemoryUtil     = require('util.memory');
const Profiler       = require('util.profiler');

const roleHarvester  = require('role.harvester');
const roleUpgrader   = require('role.upgrader');
const roleBuilder    = require('role.builder');
const Fallback       = require('behavior.fallback');

const RoadPlanner    = require('planner.road');
const StoragePlanner = require('planner.storage');
const DefensePlanner = require('planner.defense'); // 👈 IMPORTANT

/**
 * Main Screeps loop.
 */
module.exports.loop = function () {
    Profiler.start('main-loop');

    try {
        // --- ROOM-LEVEL MANAGEMENT (spawns, logging, structure caches) ---
        Profiler.start('room-manager');
        RoomManager.run();
        Profiler.end('room-manager');

        // --- STRUCTURE / ROAD / DEFENSE PLANNING ---
        Profiler.start('planning');
        module.exports._runPlanning();
        Profiler.end('planning');

        // --- CREEP BEHAVIOR + ROAD USAGE TRACKING ---
        Profiler.start('creep-behavior');
        module.exports._runCreepBehavior();
        Profiler.end('creep-behavior');

        // --- MEMORY / PROFILER MAINTENANCE ---
        MemoryUtil.cleanPathCaches && MemoryUtil.cleanPathCaches();
        Profiler.cleanup && Profiler.cleanup();

        if (Game.time % 100 === 0 && Profiler.report) {
            Profiler.report();
        }

    } catch (e) {
        console.log('[MAIN] ERROR in main loop:', e.stack || e);
    }

    Profiler.end('main-loop');
};

/**
 * Run planning logic for all owned rooms.
 */
module.exports._runPlanning = function () {
    const roomNames = Object.keys(Game.rooms);

    for (let i = 0; i < roomNames.length; i++) {
        const room = Game.rooms[roomNames[i]];
        if (!room.controller || !room.controller.my) continue;

        // 1) Economy / structure layout
        StoragePlanner.planLayout(room);

        // 2) Roads: static + usage-based
        RoadPlanner.planLayout(room);
        RoadPlanner.run(room);

        // 3) Defenses: borders + towers
        DefensePlanner.planLayout(room);
    }
};

/**
 * Run creep behavior for all creeps.
 */
module.exports._runCreepBehavior = function () {
    const creeps = Game.creeps;

    for (const name in creeps) {
        const creep = creeps[name];
        const role  = creep.memory.role;

        if (role === Config.ROLES.HARVESTER) {
            roleHarvester.run(creep);
        } else if (role === Config.ROLES.UPGRADER) {
            roleUpgrader.run(creep);
        } else if (role === Config.ROLES.BUILDER) {
            roleBuilder.run(creep);
        } else {
            Fallback.run(creep);
        }

        // Track movement for road usage
        RoadPlanner.trackStep(creep);
    }
};
