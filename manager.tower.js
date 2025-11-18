// manager.tower.js
// Operate owned towers: attack, heal and maintain defensive structures.

const Config = require('config');

const DefenseConfig = Config.DEFENSE || {};
const RepairConfig  = DefenseConfig.REPAIR || {};

const MIN_TOWER_ENERGY     = RepairConfig.MIN_TOWER_ENERGY || 300;
const NON_WALL_THRESHOLD   = RepairConfig.NON_WALL_THRESHOLD || 0.8;
const RAMPART_TARGET_HITS  = RepairConfig.RAMPART_TARGET_HITS || 150000;
const WALL_TARGET_HITS     = RepairConfig.WALL_TARGET_HITS || 250000;

const TowerManager = {
    /**
     * Run tower logic for a single room.
     *
     * @param {Room} room
     */
    run(room) {
        const towers = /** @type {StructureTower[]} */ (room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        }));

        if (towers.length === 0) return;

        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        const wounded  = room.find(FIND_MY_CREEPS, { filter: c => c.hits < c.hitsMax });

        let repairTargets = null;
        if (!hostiles.length) {
            repairTargets = this._collectRepairTargets(room);
        }

        for (let i = 0; i < towers.length; i++) {
            const tower = towers[i];

            if (hostiles.length > 0) {
                const target = tower.pos.findClosestByRange(hostiles);
                if (target) {
                    tower.attack(target);
                    continue;
                }
            }

            if (wounded.length > 0) {
                const target = tower.pos.findClosestByRange(wounded);
                if (target) {
                    tower.heal(target);
                    continue;
                }
            }

            if (!repairTargets || tower.store[RESOURCE_ENERGY] < MIN_TOWER_ENERGY) {
                continue;
            }

            const structure = this._chooseRepairTarget(repairTargets);
            if (structure) {
                tower.repair(structure);
            }
        }
    },

    /**
     * Pre-compute sets of structures that need repairs.
     *
     * @param {Room} room
     * @returns {{ ramparts: StructureRampart[], walls: StructureWall[], general: Structure[] }}
     */
    _collectRepairTargets(room) {
        const ramparts = /** @type {StructureRampart[]} */ (room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_RAMPART && s.hits < RAMPART_TARGET_HITS
        })).sort((a, b) => a.hits - b.hits);

        const walls = /** @type {StructureWall[]} */ (room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_WALL && s.hits < WALL_TARGET_HITS
        })).sort((a, b) => a.hits - b.hits);

        const general = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType !== STRUCTURE_WALL &&
                        s.structureType !== STRUCTURE_RAMPART &&
                        s.hits < s.hitsMax * NON_WALL_THRESHOLD
        }).sort((a, b) => (a.hits / a.hitsMax) - (b.hits / b.hitsMax));

        return { ramparts, walls, general };
    },

    /**
     * Select the highest-priority structure from the cached buckets.
     *
     * @param {{ ramparts: StructureRampart[], walls: StructureWall[], general: Structure[] }} targets
     * @returns {Structure|null}
     */
    _chooseRepairTarget(targets) {
        if (targets.ramparts.length > 0) {
            return targets.ramparts[0];
        }
        if (targets.walls.length > 0) {
            return targets.walls[0];
        }
        if (targets.general.length > 0) {
            return targets.general[0];
        }
        return null;
    }
};

module.exports = TowerManager;