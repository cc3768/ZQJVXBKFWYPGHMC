// role.builder.js (optimized)

const Pathing    = require('util.pathing');
const Fallback   = require('behavior.fallback');
const EnergyUtil = require('util.energy');
const BuilderUtil = require('util.builder');

module.exports = {
    run(creep) {

        // --- ENERGY ACQUISITION ---
        if (EnergyUtil.needsEnergy(creep)) {
            const src = EnergyUtil.findEnergySource(creep) ||
                        creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);

            if (!src) return;

            const res = EnergyUtil.getEnergyFrom(creep, src);
            if (res === ERR_NOT_IN_RANGE) Pathing.moveTo(creep, src);
            return;
        }

        // --- ACTIVE CONSTRUCTION ---
        const sites = creep.room.find(FIND_CONSTRUCTION_SITES);

        if (sites.length) {
            const target = BuilderUtil.findBuildTarget(creep);

            if (target) {
                creep.memory.buildTarget = target.id;

                const res = creep.build(target);
                if (res === ERR_NOT_IN_RANGE) Pathing.moveTo(creep, target);

                // Team building hint
                if (res === OK) {
                    const nearby = BuilderUtil.getNearbyBuilders(creep, target);
                    if (nearby.length > 0) creep.say('🔨');
                }
                return;
            }
        }

        // --- HELP OTHER BUILDERS ---
        if (BuilderUtil.shouldHelpOtherBuilder(creep)) {
            const help = BuilderUtil.getMostHelpfulSite(creep);

            if (help) {
                creep.memory.buildTarget = help.id;

                const res = creep.build(help);
                if (res === ERR_NOT_IN_RANGE) Pathing.moveTo(creep, help);
                return;
            }
        }

        delete creep.memory.buildTarget;

        // --- FALLBACK (upgrade/supply) ---
        Fallback.run(creep);
    }
};
