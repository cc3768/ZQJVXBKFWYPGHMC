// behavior.fallback.js (optimized)
// Generic worker behavior when a role has nothing else to do.

const Pathing   = require('util.pathing');
const EnergyUtil = require('util.energy');

module.exports = {
    run(creep) {
        const room = creep.room;

        // --- 1) ACQUIRE ENERGY (never from spawn/ext) ---
        if (EnergyUtil.needsEnergy(creep)) {
            const src = EnergyUtil.findEnergySource(creep);

            if (src) {
                const res = EnergyUtil.getEnergyFrom(creep, src);
                if (res === ERR_NOT_IN_RANGE) Pathing.moveTo(creep, src);
            } else {
                creep.say('no ⚡');
            }
            return;
        }

        // --- 2) FILL SPAWN/EXTENSIONS ---
   const needy = room.find(FIND_MY_STRUCTURES, {
            filter: s =>
                (s.structureType === STRUCTURE_SPAWN ||
                 s.structureType === STRUCTURE_EXTENSION) &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        if (needy.length) {
            const target = creep.pos.findClosestByPath(needy);
            const res = creep.transfer(target, RESOURCE_ENERGY);

            if (res === ERR_NOT_IN_RANGE) Pathing.moveTo(creep, target);
            return;
        }

        // --- 2b) KEEP TOWERS FED ---
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s =>
                s.structureType === STRUCTURE_TOWER &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        if (towers.length) {
            const target = creep.pos.findClosestByPath(towers);
            const res = creep.transfer(target, RESOURCE_ENERGY);

            if (res === ERR_NOT_IN_RANGE) Pathing.moveTo(creep, target);
            return;
        }

        // --- 3) BUILD ---
        const sites = room.find(FIND_CONSTRUCTION_SITES);
        if (sites.length) {
            const site = creep.pos.findClosestByPath(sites);
            const res = creep.build(site);

            if (res === ERR_NOT_IN_RANGE) Pathing.moveTo(creep, site);
            return;
        }

        // --- 4) UPGRADE ---
        if (room.controller) {
            const res = creep.upgradeController(room.controller);
            if (res === ERR_NOT_IN_RANGE) Pathing.moveTo(creep, room.controller);
        }
    }
};
