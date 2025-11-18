// util.pathing.js
// Centralized move / pathing helper built on top of PathFinder.

const Config = require('config');

const Pathing = {
    /**
     * Smart moveTo wrapper with:
     *  - basic stuck detection
     *  - cached paths (with TTL)
     *  - cost matrix that prefers roads and avoids creeps
     *
     * @param {Creep} creep
     * @param {RoomPosition|{pos:RoomPosition}} target
     * @param {Object} [opts]
     * @param {number} [opts.range=1]
     * @param {number} [opts.maxOps=Config.PATHING.MAX_OPS]
     * @param {number} [opts.reusePath=10] - ticks to reuse cached path
     * @returns {number}
     */
    moveTo(creep, target, opts = {}) {
        if (!creep || !target) return ERR_INVALID_TARGET;

        const targetPos = target.pos || target;
        if (!targetPos || typeof targetPos.x !== 'number') return ERR_INVALID_TARGET;

        const range = typeof opts.range === 'number' ? opts.range : 1;
        const maxOps = typeof opts.maxOps === 'number' ? opts.maxOps : Config.PATHING.MAX_OPS;
        const reusePath = typeof opts.reusePath === 'number' ? opts.reusePath : 10;

        // Stuck detection & random nudge
        this._checkStuck(creep);

        // Try cached path if still valid
        if (this._useCachedPath(creep, targetPos, reusePath)) {
            return OK;
        }

        // Compute new path using PathFinder
        const result = PathFinder.search(
            creep.pos,
            { pos: targetPos, range },
            {
                plainCost: 2,
                swampCost: 10,
                maxOps,
                roomCallback: roomName => {
                    const room = Game.rooms[roomName];
                    if (!room) return;

                    const costs = new PathFinder.CostMatrix();
                    const structures = room.find(FIND_STRUCTURES);
                    const creeps = room.find(FIND_CREEPS);

                    // Prefer roads, block impassable structures
                    for (let i = 0; i < structures.length; i++) {
                        const s = structures[i];
                        if (s.structureType === STRUCTURE_ROAD) {
                            costs.set(s.pos.x, s.pos.y, 1); // super cheap
                        } else if (
                            s.structureType !== STRUCTURE_CONTAINER &&
                            (s.structureType !== STRUCTURE_RAMPART || !s.my)
                        ) {
                            costs.set(s.pos.x, s.pos.y, 0xff); // block tile
                        }
                    }

                    // Avoid creeps by treating their tile as blocked
                    const creepName = creep.name;
                    const owner = creep.owner && creep.owner.username;
                    for (let i = 0; i < creeps.length; i++) {
                        const c = creeps[i];
                        if (c.owner && owner && c.owner.username === owner && c.name === creepName) continue;
                        costs.set(c.pos.x, c.pos.y, 0xff);
                    }

                    return costs;
                }
            }
        );

        if (!result.path || result.path.length === 0) {
            // No path found
            delete creep.memory._path;
            delete creep.memory._pathTarget;
            delete creep.memory._pathSetTick;
            return ERR_NO_PATH;
        }

        this._setCachedPath(creep, targetPos, result.path);
        creep.moveByPath(creep.memory._path);
        return OK;
    },

    /**
     * Try to follow a cached path if it's still valid and not too old.
     *
     * @param {Creep} creep
     * @param {RoomPosition} targetPos
     * @param {number} reusePath
     * @returns {boolean}
     * @private
     */
    _useCachedPath(creep, targetPos, reusePath) {
        const cached = creep.memory._path;
        const cachedTarget = creep.memory._pathTarget;
        const setTick = creep.memory._pathSetTick;

        if (
            !cached ||
            !Array.isArray(cached) ||
            !cachedTarget ||
            typeof cachedTarget.x !== 'number' ||
            typeof cachedTarget.y !== 'number' ||
            cachedTarget.roomName !== targetPos.roomName ||
            cachedTarget.x !== targetPos.x ||
            cachedTarget.y !== targetPos.y
        ) {
            return false;
        }

        // Path too old? Recalculate.
        if (typeof setTick === 'number' && Game.time - setTick > reusePath) {
            delete creep.memory._path;
            delete creep.memory._pathTarget;
            delete creep.memory._pathSetTick;
            return false;
        }

        const res = creep.moveByPath(cached);
        if (res === OK || res === ERR_TIRED) {
            return true;
        }

        // Path broken, clear it.
        delete creep.memory._path;
        delete creep.memory._pathTarget;
        delete creep.memory._pathSetTick;
        return false;
    },

    /**
     * Store a newly computed path in creep memory.
     *
     * @param {Creep} creep
     * @param {RoomPosition} targetPos
     * @param {RoomPosition[]} path
     * @private
     */
    _setCachedPath(creep, targetPos, path) {
        creep.memory._path = path;
        creep.memory._pathTarget = {
            x: targetPos.x,
            y: targetPos.y,
            roomName: targetPos.roomName
        };
        creep.memory._pathSetTick = Game.time;
    },

    /**
     * Basic stuck detection:
     *  - If creep hasn't moved for Config.PATHING.STUCK_TICKS, clear its cached path
     *  - Attempt a random step to break traffic jams
     *
     * @param {Creep} creep
     * @private
     */
    _checkStuck(creep) {
        const last = creep.memory._lastMovePos;
        const pos = creep.pos;

        if (
            !last ||
            last.x !== pos.x ||
            last.y !== pos.y ||
            last.roomName !== pos.roomName
        ) {
            creep.memory._lastMovePos = {
                x: pos.x,
                y: pos.y,
                roomName: pos.roomName
            };
            creep.memory._stuckTicks = 0;
            return;
        }

        const stuckTicks = (creep.memory._stuckTicks || 0) + 1;
        creep.memory._stuckTicks = stuckTicks;

        if (stuckTicks >= Config.PATHING.STUCK_TICKS) {
            // Clear path cache
            delete creep.memory._path;
            delete creep.memory._pathTarget;
            delete creep.memory._pathSetTick;

            // Attempt a random nudge move to break jams
            const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
            const dir = directions[Math.floor(Math.random() * directions.length)];
            creep.move(dir);

            // Reset counter
            creep.memory._stuckTicks = 0;
        }
    }
};

module.exports = Pathing;
