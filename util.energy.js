// util.energy.js
// Centralized energy source finding logic to reduce code duplication

/**
 * Energy helper utilities:
 *  - Find optimal sources for withdrawing/harvesting
 *  - Find optimal targets for delivering energy
 *  - Simple state checks for worker "needsEnergy" / "isFull"
 */
const EnergyUtil = {
    /**
     * Find energy source prioritizing: storage > containers > dropped > sources.
     *
     * @param {Creep} creep
     * @param {Object} [options]
     * @param {boolean} [options.includeDropped=true]
     * @returns {Structure|Source|Resource|null}
     */
    findEnergySource(creep, options = {}) {
        const room = creep.room;
        const includeDropped = options.includeDropped !== false;

        // 1) Storage first (if it exists and has energy)
        if (room.storage && room.storage.store[RESOURCE_ENERGY] > 0) {
            return room.storage;
        }

        // 2) Containers with energy
        const containers = /** @type {StructureContainer[]} */ (room.find(FIND_STRUCTURES, {
            filter: s =>
                s.structureType === STRUCTURE_CONTAINER &&
                s.store &&
                s.store[RESOURCE_ENERGY] > 0
        }));

        if (containers.length > 0) {
            const closestContainer = creep.pos.findClosestByPath(containers);
            if (closestContainer) return closestContainer;
        }

        // 3) Dropped energy (optional, often useful for haulers / builders)
        if (includeDropped) {
            const drops = /** @type {Resource[]} */ (room.find(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 20
            }));
            if (drops.length > 0) {
                const closestDrop = creep.pos.findClosestByPath(drops);
                if (closestDrop) return closestDrop;
            }
        }

        // 4) Finally, active sources
        const source = /** @type {Source|null} */ (creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE));
        return source || null;
    },

    /**
     * Find energy delivery target (spawn/extensions/containers/storage).
     *
     * Priority:
     *  - Spawns & extensions
     *  - Containers
     *  - Storage
     *
     * @param {Creep} creep
     * @param {Object} [options]
     * @param {boolean} [options.includeSpawn=true]
     * @param {boolean} [options.includeContainers=true]
     * @param {boolean} [options.includeStorage=true]
     * @returns {Structure|null}
     */
    findEnergyTarget(creep, options = {}) {
        const room = creep.room;
        const includeSpawn = options.includeSpawn !== false;
        const includeContainers = options.includeContainers !== false;
        const includeStorage = options.includeStorage !== false;

        /** @type {Structure[]} */
        const candidates = room.find(FIND_STRUCTURES, {
            filter: s => {
                if (!s.store || s.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) return false;

                if (includeSpawn &&
                    (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION)) {
                    return true;
                }
                if (includeContainers && s.structureType === STRUCTURE_CONTAINER) {
                    return true;
                }
                if (includeStorage && s.structureType === STRUCTURE_STORAGE) {
                    return true;
                }
                return false;
            }
        });

        if (candidates.length === 0) return null;
        return creep.pos.findClosestByPath(candidates) || candidates[0] || null;
    },

    /**
     * Check if creep currently has no energy.
     *
     * @param {Creep} creep
     * @returns {boolean}
     */
    needsEnergy(creep) {
        return creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0;
    },

    /**
     * Check if creep is full of energy (no free capacity).
     *
     * @param {Creep} creep
     * @returns {boolean}
     */
    isFull(creep) {
        return creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0;
    },

    /**
     * Attempt to obtain energy from a target.
     *
     * This handles:
     *  - withdrawing from structures with .store
     *  - picking up dropped resources
     *  - harvesting sources
     *
     * @param {Creep} creep
     * @param {Structure|Source|Resource|null} target
     * @returns {number} Screeps return code
     */
    getEnergyFrom(creep, target) {
        if (!target) return ERR_INVALID_TARGET;

        // Dropped resource
        if (target instanceof Resource) {
            if (target.resourceType !== RESOURCE_ENERGY) return ERR_INVALID_TARGET;
            return creep.pickup(target);
        }

        // Structure with store
        if ('store' in target && target.store && target.store[RESOURCE_ENERGY] !== undefined) {
            return creep.withdraw(target, RESOURCE_ENERGY);
        }

        // Source (or something harvestable)
        return creep.harvest(/** @type {Source} */ (target));
    }
};

module.exports = EnergyUtil;
