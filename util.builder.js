// util.builder.js
// Cooperative builder assistance and task coordination

/**
 * Utility helpers for coordinating builder creeps.
 * All functions are pure (no Memory writes) and safe to call frequently.
 */
const BuilderUtil = {
    /**
     * Find the best construction site for this builder.
     * Preference order:
     *  1. Sites other builders are already targeting (cooperative focus)
     *  2. Closest site by path
     *
     * @param {Creep} creep
     * @returns {ConstructionSite|null}
     */
    findBuildTarget(creep) {
        const room = creep.room;
        const sites = /** @type {ConstructionSite[]} */ (room.find(FIND_CONSTRUCTION_SITES));

        if (sites.length === 0) return null;

        // Get other builders in the room once
        const builders = /** @type {Creep[]} */ (room.find(FIND_MY_CREEPS, {
            filter: c => c.memory.role === 'builder' && c.name !== creep.name
        }));

        if (builders.length === 0) {
            // No other builders, just find closest site
            return creep.pos.findClosestByPath(sites) || sites[0] || null;
        }

        // Track sites that other builders are already working on
        const targetedSites = new Set();
        for (let i = 0; i < builders.length; i++) {
            const targetId = builders[i].memory.buildTarget;
            if (targetId) targetedSites.add(targetId);
        }

        let cooperativeBest = null;
        let cooperativeBestDistance = Infinity;

        // First pass: find nearest site that's already targeted by someone else
        for (let i = 0; i < sites.length; i++) {
            const site = sites[i];
            if (!targetedSites.has(site.id)) continue;

            const distance = creep.pos.getRangeTo(site);
            if (distance < cooperativeBestDistance) {
                cooperativeBest = site;
                cooperativeBestDistance = distance;
            }
        }

        if (cooperativeBest) {
            return cooperativeBest;
        }

        // Fallback: nearest site overall
        return creep.pos.findClosestByPath(sites) || sites[0] || null;
    },

    /**
     * Get the progress of a construction site.
     *
     * @param {ConstructionSite|null} site
     * @returns {{current:number,total:number,percent:number}}
     */
    getSiteProgress(site) {
        if (!site) {
            return { current: 0, total: 0, percent: 0 };
        }

        const current = site.progress;
        const total = site.progressTotal || 1;
        const percent = Math.round((current / total) * 100);

        return { current, total, percent };
    },

    /**
     * Find nearby builders working on the same site.
     *
     * @param {Creep} creep
     * @param {ConstructionSite} targetSite
     * @param {number} range
     * @returns {Creep[]}
     */
    getNearbyBuilders(creep, targetSite, range = 5) {
        if (!targetSite) return [];

        const builders = /** @type {Creep[]} */ (creep.room.find(FIND_MY_CREEPS, {
            filter: c =>
                c.memory.role === 'builder' &&
                c.name !== creep.name &&
                c.memory.buildTarget === targetSite.id &&
                c.pos.inRangeTo(targetSite, range)
        }));

        return builders;
    },

    /**
     * Estimate ticks to complete a site with N builders.
     *
     * Assumes each builder has at least one WORK part and is working full time.
     *
     * @param {ConstructionSite|null} site
     * @param {number} builderCount
     * @returns {number} estimated ticks to complete, Infinity if no site
     */
    estimateCompletionTime(site, builderCount = 1) {
        if (!site || builderCount <= 0) return Infinity;

        const remaining = Math.max(0, site.progressTotal - site.progress);
        // 5 build power per WORK part per tick. We assume "builderCount" effective WORK-equivalents.
        const workPerTick = 5 * builderCount;

        if (workPerTick <= 0) return Infinity;
        return Math.ceil(remaining / workPerTick);
    },

    /**
     * Get all construction sites sorted by priority for this creep.
     *
     * Priority:
     *  1) Sites with more builders already targeting them (cooperative)
     *  2) Sites with higher completion percentage (finish-near-complete first)
     *  3) Shortest range from this creep
     *
     * @param {Creep} creep
     * @returns {ConstructionSite[]}
     */
    getPrioritizedSites(creep) {
        const room = creep.room;
        const sites = /** @type {ConstructionSite[]} */ (room.find(FIND_CONSTRUCTION_SITES));
        if (sites.length === 0) return [];

        const builders = /** @type {Creep[]} */ (room.find(FIND_MY_CREEPS, {
            filter: c => c.memory.role === 'builder'
        }));

        /** @type {Record<string, number>} */
        const targetCounts = Object.create(null);
        for (let i = 0; i < builders.length; i++) {
            const targetId = builders[i].memory.buildTarget;
            if (!targetId) continue;
            targetCounts[targetId] = (targetCounts[targetId] || 0) + 1;
        }

        // Return a new sorted array (do not mutate original "sites" reference elsewhere)
        return sites
            .slice()
            .sort((a, b) => {
                const countA = targetCounts[a.id] || 0;
                const countB = targetCounts[b.id] || 0;

                if (countA !== countB) {
                    return countB - countA; // more builders first
                }

                const progressA = a.progress / (a.progressTotal || 1);
                const progressB = b.progress / (b.progressTotal || 1);
                if (progressA !== progressB) {
                    return progressB - progressA; // further along first
                }

                // tie-breaker: range to this creep
                return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
            });
    },

    /**
     * Check if a builder should help on another builder's active site.
     * Returns true if there exists at least one in-progress site (<90% done)
     * that another builder is already working on.
     *
     * @param {Creep} creep
     * @returns {boolean}
     */
    shouldHelpOtherBuilder(creep) {
        const room = creep.room;
        const builders = /** @type {Creep[]} */ (room.find(FIND_MY_CREEPS, {
            filter: c => c.memory.role === 'builder' && c.name !== creep.name
        }));

        if (builders.length === 0) return false;

        for (let i = 0; i < builders.length; i++) {
            const targetId = builders[i].memory.buildTarget;
            if (!targetId) continue;

            const site = /** @type {ConstructionSite|null} */ (Game.getObjectById(targetId));
            if (!site) continue;

            if (site.progress < site.progressTotal * 0.9) {
                return true;
            }
        }

        return false;
    },

    /**
     * Get the most "helpful" site to work on:
     *  - site with the most builders already targeting it
     *  - ties are broken by proximity to this creep
     *
     * @param {Creep} creep
     * @returns {ConstructionSite|null}
     */
    getMostHelpfulSite(creep) {
        const room = creep.room;
        const sites = /** @type {ConstructionSite[]} */ (room.find(FIND_CONSTRUCTION_SITES));
        if (sites.length === 0) return null;

        const builders = /** @type {Creep[]} */ (room.find(FIND_MY_CREEPS, {
            filter: c => c.memory.role === 'builder' && c.name !== creep.name
        }));

        /** @type {Record<string, number>} */
        const targetCounts = Object.create(null);
        for (let i = 0; i < builders.length; i++) {
            const targetId = builders[i].memory.buildTarget;
            if (!targetId) continue;
            targetCounts[targetId] = (targetCounts[targetId] || 0) + 1;
        }

        let bestSite = null;
        let bestScore = -1;

        for (let i = 0; i < sites.length; i++) {
            const site = sites[i];
            const count = targetCounts[site.id] || 0;
            if (count === 0) continue; // only consider sites with at least one builder

            // Higher count is better, lower range is better
            const range = creep.pos.getRangeTo(site);
            const score = count * 100 - range; // simple combined heuristic

            if (score > bestScore) {
                bestScore = score;
                bestSite = site;
            }
        }

        return bestSite;
    }
};

module.exports = BuilderUtil;
