// managers/towerManager.js

const TowerManager = {
    run(context) {
        const { room, towers, hostiles, mem } = context;
        if (!towers || !towers.length) return;

        // 1. ATTACK hostiles
        const target = this.getAttackTarget(room, hostiles);
        if (target) {
            for (const tower of towers) {
                if (tower.store[RESOURCE_ENERGY] > 10) {
                    tower.attack(target);
                }
            }
            return; // if we attacked, skip healing/repairs this tick
        }

        // 2. HEAL damaged creeps
        const healTarget = this.getHealTarget(room);
        if (healTarget) {
            for (const tower of towers) {
                if (tower.store[RESOURCE_ENERGY] > 10) {
                    tower.heal(healTarget);
                }
            }
            return;
        }

        // 3. REPAIR critical structures (walls/ramparts/roads)
        if (Game.cpu.bucket < 800) return; // throttle in low bucket

        const repairTarget = this.getRepairTarget(room, mem);
        if (repairTarget) {
            for (const tower of towers) {
                if (tower.store[RESOURCE_ENERGY] > 500) { // don't dump when low
                    tower.repair(repairTarget);
                }
            }
        }
    },

    getAttackTarget(room, hostiles) {
        if (!hostiles || !hostiles.length) return null;

        // Prioritize by: HEAL parts → ranged/attack → closest to spawn/controller
        let target = _.max(hostiles, h => this.hostileScore(h, room));
        return target instanceof Object ? target : null;
    },

    hostileScore(hostile, room) {
        let healParts = hostile.getActiveBodyparts(HEAL);
        let attackParts = hostile.getActiveBodyparts(ATTACK) + hostile.getActiveBodyparts(RANGED_ATTACK);
        let score = healParts * 4 + attackParts * 3;

        const origin = room.controller || _.first(room.find(FIND_MY_SPAWNS));
        if (origin) {
            const range = hostile.pos.getRangeTo(origin);
            score += Math.max(0, 20 - range); // closer = higher score
        }

        return score;
    },

    getHealTarget(room) {
        const injured = room.find(FIND_MY_CREEPS, {
            filter: c => c.hits < c.hitsMax
        });
        if (!injured.length) return null;
        return injured[0]; // first is fine; you can sort by missing hits
    },

    getRepairTarget(room, mem) {
        const wallTargetHits    = mem.wallTargetHits || 500_000;
        const rampartTargetHits = mem.rampartTargetHits || 500_000;

        // Cache target per room per few ticks to save CPU
        if (!room._towerRepairTarget || Game.time % 5 === 0) {
            let structures = room.find(FIND_STRUCTURES, {
                filter: s => (
                    (s.structureType === STRUCTURE_WALL   && s.hits < wallTargetHits) ||
                    (s.structureType === STRUCTURE_RAMPART && s.hits < rampartTargetHits) ||
                    (s.structureType === STRUCTURE_ROAD  && s.hits < s.hitsMax * 0.5)
                )
            });

            if (!structures.length) {
                room._towerRepairTarget = null;
            } else {
                // repair lowest hits first
                structures.sort((a, b) => a.hits - b.hits);
                room._towerRepairTarget = structures[0];
            }
        }

        return room._towerRepairTarget || null;
    }
};

module.exports = TowerManager;
