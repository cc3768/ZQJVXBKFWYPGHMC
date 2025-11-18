// planner.road.js
// Thin façade that exposes the road planner API

const RoadUsage  = require("planner.road.usage");
const RoadLayout = require("planner.road.layout");

/**
 * High-level road planner interface, used by main loop / room manager.
 */
const RoadPlanner = {
    /**
     * Plan static road layout (spawn <-> sources/controller/storage).
     *
     * @param {Room} room
     */
    planLayout(room) {
        return RoadLayout.planLayout(room);
    },

    /**
     * Run dynamic, usage-based road placement.
     *
     * @param {Room} room
     */
    run(room) {
        return RoadUsage.run(room);
    },

    /**
     * Track a creep step for heatmap-based road planning.
     *
     * @param {Creep} creep
     */
    trackStep(creep) {
        return RoadUsage.trackStep(creep);
    }
};

module.exports = RoadPlanner;
