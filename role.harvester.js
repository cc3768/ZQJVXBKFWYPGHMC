// role.harvester.js
// Harvesters: mine first, feed core, then cooperatively help builders.

const Fallback    = require('behavior.fallback');
const Pathing     = require('util.pathing');
const BuilderUtil = require('util.builder');

module.exports = {
    run(creep) {

        // --- STATE MACHINE: harvesting vs delivering ---
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0)
            creep.memory.working = false;

        if (!creep.memory.working &&
            creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0)
            creep.memory.working = true;

        if (creep.fatigue > 0) return;

        const room = creep.room;

        // ----------------------------
        //  HARVEST MODE
        // ----------------------------
        if (!creep.memory.working) {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);

            if (source) {
                const res = creep.harvest(source);
                if (res === ERR_NOT_IN_RANGE) Pathing.moveTo(creep, source);
            } else {
                // No sources available → generic worker behavior
                Fallback.run(creep);
            }
            return;
        }

        // ----------------------------
        //  DELIVERY MODE (primary job)
        // ----------------------------

        // 1) CORE FIRST: spawn + extensions
        const coreTargets = room.find(FIND_STRUCTURES, {
            filter: s =>
                (s.structureType === STRUCTURE_SPAWN ||
                 s.structureType === STRUCTURE_EXTENSION) &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        if (coreTargets.length > 0) {
            const target = creep.pos.findClosestByPath(coreTargets);
            const res = creep.transfer(target, RESOURCE_ENERGY);
            if (res === ERR_NOT_IN_RANGE) Pathing.moveTo(creep, target);
            return;
        }

        // 1b) Keep towers charged so defense/healing always works
        const towerTargets = room.find(FIND_MY_STRUCTURES, {
            filter: s =>
                s.structureType === STRUCTURE_TOWER &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        if (towerTargets.length > 0) {
            const target = creep.pos.findClosestByPath(towerTargets);
            const res = creep.transfer(target, RESOURCE_ENERGY);
            if (res === ERR_NOT_IN_RANGE) Pathing.moveTo(creep, target);
            return;
        }

        // 2) ECONOMY BUFFERS: containers + storage
        const econTargets = room.find(FIND_STRUCTURES, {
            filter: s =>
                (s.structureType === STRUCTURE_CONTAINER ||
                 s.structureType === STRUCTURE_STORAGE) &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        if (econTargets.length > 0) {
            const target = creep.pos.findClosestByPath(econTargets);
            const res = creep.transfer(target, RESOURCE_ENERGY);
            if (res === ERR_NOT_IN_RANGE) Pathing.moveTo(creep, target);
            return;
        }

        // At this point:
        // - Harvester is full
        // - Spawn/extensions do NOT need energy
        // - Containers/storage do NOT need energy
        // → they would be "just standing by" without this next section.

        // ----------------------------
        //  COOPERATIVE BUILDER ASSIST
        //  (only if builders exist + there are sites)
        // ----------------------------
        const sites = room.find(FIND_CONSTRUCTION_SITES);
        if (sites.length > 0) {
            const builders = room.find(FIND_MY_CREEPS, {
                filter: c => c.memory.role === 'builder'
            });

            if (builders.length > 0) {
                // Use the SAME cooperative logic as real builders
                let target = BuilderUtil.findBuildTarget(creep);

                // If builder logic says "help others", use that
                if (!target && BuilderUtil.shouldHelpOtherBuilder(creep)) {
                    target = BuilderUtil.getMostHelpfulSite(creep);
                }

                // Fallback: still do *something* if there are sites
                if (!target) {
                    target = creep.pos.findClosestByPath(sites) || sites[0];
                }

                if (target) {
                    creep.memory.buildTarget = target.id;

                    const res = creep.build(target);
                    if (res === ERR_NOT_IN_RANGE) {
                        Pathing.moveTo(creep, target, { range: 1 });
                    } else if (res === OK) {
                        creep.say('🛠 assist');
                    }
                    return;
                }
            }
        }

        // No core to feed, no econ to fill, no sites (or no builders) →
        // Let generic worker logic handle upgrade, etc.
        delete creep.memory.buildTarget;
        Fallback.run(creep);
    }
};
