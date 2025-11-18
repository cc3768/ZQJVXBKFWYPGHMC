// planner.storage.js
// High-level planner for non-road structures (containers, storage, extensions, links, extractor)

const ContainersPlanner = require("planner.struct.containers");
const StorageStruct     = require("planner.struct.storage");
const ExtensionsPlanner = require("planner.struct.extensions");
const LinksPlanner      = require("planner.struct.links");
const ExtractorPlanner  = require("planner.struct.extractor");

/**
 * High-level structure planner for a room:
 *  - Source / controller containers
 *  - Storage
 *  - Extensions
 *  - Links
 *  - Extractor
 */
const StoragePlanner = {
    /**
     * Plan all non-road layout for a room.
     *
     * @param {Room} room
     */
    planLayout(room) {
        if (!room.controller || !room.controller.my) return;

        if (!Memory.storageLayout) Memory.storageLayout = {};
        if (!Memory.storageLayout[room.name]) {
            Memory.storageLayout[room.name] = {
                plannedVersion: 0,
                lastRCL: 0,
                storagePos: null,
                sourceContainers: {},
                controllerContainer: null,
                links: {}
            };
        }

        const layout = Memory.storageLayout[room.name];
        const rcl = room.controller.level;

        const LAYOUT_VERSION = 1;
        const needsVersionUpdate = layout.plannedVersion < LAYOUT_VERSION;
        const rclChanged = layout.lastRCL !== rcl;

        // Track metadata for debugging / future upgrades
        if (needsVersionUpdate || rclChanged) {
            layout.plannedVersion = LAYOUT_VERSION;
            layout.lastRCL = rcl;
        }

        // Order matters: things that others depend on come first
        ContainersPlanner.plan(room, layout);
        StorageStruct.plan(room, layout, rcl);
        ExtensionsPlanner.plan(room, layout, rcl);
        LinksPlanner.plan(room, layout, rcl);
        ExtractorPlanner.plan(room, layout, rcl);

        Memory.storageLayout[room.name] = layout;
    }
};

module.exports = StoragePlanner;
