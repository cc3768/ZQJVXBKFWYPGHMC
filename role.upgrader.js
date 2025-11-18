// role.upgrader.js (fixed so they ALWAYS upgrade)

const Fallback   = require('behavior.fallback');
const Pathing    = require('util.pathing');
const EnergyUtil = require('util.energy');

module.exports = {
    run(creep) {
        const room = creep.room;

        // --- STATE MACHINE (upgrade vs refill) ---
        if (creep.memory.working && EnergyUtil.needsEnergy(creep)) {
            creep.memory.working = false;
        }

        if (!creep.memory.working && EnergyUtil.isFull(creep)) {
            creep.memory.working = true;
        }

        if (creep.fatigue > 0) return;

        // --- UPGRADE MODE ---
        if (creep.memory.working) {
            if (room.controller) {
                const res = creep.upgradeController(room.controller);
                if (res === ERR_NOT_IN_RANGE) {
                    Pathing.moveTo(creep, room.controller);
                } else if (res === ERR_NOT_ENOUGH_RESOURCES) {
                    // somehow ran dry mid-upgrade → go refill
                    creep.memory.working = false;
                }
            } else {
                // no controller? just do generic worker stuff
                Fallback.run(creep);
            }
            return;
        }

        // --- REFILL MODE (get energy WITHOUT touching spawn/ext directly) ---
        const src = EnergyUtil.findEnergySource(creep);
        if (src) {
            const res = EnergyUtil.getEnergyFrom(creep, src);

            if (res === ERR_NOT_IN_RANGE) {
                Pathing.moveTo(creep, src);
            } else if (res === ERR_NOT_ENOUGH_RESOURCES) {
                // source/container empty → fall back to generic worker behavior
                Fallback.run(creep);
            }
        } else {
            // no energy sources – do *something* useful instead of idle
            Fallback.run(creep);
        }
    }
};
