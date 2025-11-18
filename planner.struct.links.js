// planner.struct.links.js
// Handles controller/storage/source links (RCL5+)

/**
 * Links planner:
 *  - One link near controller
 *  - One link near storage
 *  - One link near each source container (if allowed)
 */
const LinksPlanner = {
    /**
     * @param {Room} room
     * @param {object} layout - Memory.storageLayout[room.name]
     * @param {number} rcl
     */
    plan(room, layout, rcl) {
        const allowed = CONTROLLER_STRUCTURES[STRUCTURE_LINK][rcl] || 0;
        if (allowed === 0 || rcl < 5) return;

        const existing = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK
        }).length;

        const pending = room.find(FIND_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_LINK
        }).length;

        let remaining = allowed - existing - pending;
        if (remaining <= 0) return;

        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return;

        const terrain = room.getTerrain();
        layout.links = layout.links || {};

        /**
         * Check if a position is valid for a link.
         *
         * @param {RoomPosition} pos
         * @returns {boolean}
         */
        const validSpot = pos => {
            const { x, y } = pos;
            if (x < 0 || x > 49 || y < 0 || y > 49) return false;
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) return false;

            const structures = room.lookForAt(LOOK_STRUCTURES, pos);
            // Only allow empty/roads/containers; no other structure
            if (structures.some(s =>
                s.structureType !== STRUCTURE_ROAD &&
                s.structureType !== STRUCTURE_CONTAINER
            )) {
                return false;
            }

            const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
            if (sites.length > 0) return false;

            return true;
        };

        /**
         * Choose a position around a target (3x3) for a link, biased toward spawn.
         *
         * @param {RoomPosition} targetPos
         * @returns {RoomPosition|null}
         */
        const chooseNear = targetPos => {
            let best = null;
            let bestDist = Infinity;

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;

                    const pos = new RoomPosition(
                        targetPos.x + dx,
                        targetPos.y + dy,
                        room.name
                    );

                    if (!validSpot(pos)) continue;

                    const d = spawn.pos.getRangeTo(pos);
                    if (d < bestDist) {
                        bestDist = d;
                        best = pos;
                    }
                }
            }

            return best;
        };

        // ---------- 1) CONTROLLER LINK ----------
        if (remaining > 0 && room.controller) {
            if (!layout.links.controller) {
                const basePos = layout.controllerContainer
                    ? new RoomPosition(layout.controllerContainer.x, layout.controllerContainer.y, room.name)
                    : room.controller.pos;

                const pos = chooseNear(basePos);
                if (pos) {
                    const res = room.createConstructionSite(pos, STRUCTURE_LINK);
                    if (res === OK) {
                        remaining--;
                        layout.links.controller = { x: pos.x, y: pos.y };
                    }
                }
            }
        }

        // ---------- 2) STORAGE LINK ----------
        if (remaining > 0 && layout.storagePos) {
            if (!layout.links.storage) {
                const basePos = new RoomPosition(layout.storagePos.x, layout.storagePos.y, room.name);
                const pos = chooseNear(basePos);
                if (pos) {
                    const res = room.createConstructionSite(pos, STRUCTURE_LINK);
                    if (res === OK) {
                        remaining--;
                        layout.links.storage = { x: pos.x, y: pos.y };
                    }
                }
            }
        }

        // ---------- 3) SOURCE LINKS ----------
        if (remaining > 0 && layout.sourceContainers) {
            layout.links.sources = layout.links.sources || {};

            for (const srcId in layout.sourceContainers) {
                if (remaining <= 0) break;
                if (layout.links.sources[srcId]) continue;

                const cPos = layout.sourceContainers[srcId];
                const basePos = new RoomPosition(cPos.x, cPos.y, room.name);
                const pos = chooseNear(basePos);
                if (!pos) continue;

                const res = room.createConstructionSite(pos, STRUCTURE_LINK);
                if (res === OK) {
                    remaining--;
                    layout.links.sources[srcId] = { x: pos.x, y: pos.y };
                }
            }
        }
    }
};

module.exports = LinksPlanner;
