// planner.struct.extractor.js
// Handles extractor on mineral (RCL6+)

/**
 * Extractor planner: places a single extractor on the room's mineral (RCL 6+).
 */
const ExtractorPlanner = {
    /**
     * @param {Room} room
     * @param {object} layout
     * @param {number} rcl
     */
    plan(room, layout, rcl) {
        if (rcl < 6) return;

        const mineral = room.find(FIND_MINERALS)[0];
        if (!mineral) return;

        const pos = mineral.pos;

        const hasExtractor = room.lookForAt(LOOK_STRUCTURES, pos)
            .some(s => s.structureType === STRUCTURE_EXTRACTOR);

        const hasSite = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos)
            .some(s => s.structureType === STRUCTURE_EXTRACTOR);

        if (!hasExtractor && !hasSite) {
            room.createConstructionSite(pos, STRUCTURE_EXTRACTOR);
        }
    }
};

module.exports = ExtractorPlanner;
