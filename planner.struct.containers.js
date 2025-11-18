// planner.struct.containers.js
// Handles source + controller containers

/**
 * Container placement around sources and controller.
 * Stores positions in Memory.storageLayout[roomName].
 */
const ContainersPlanner = {
    /**
     * Plan source & controller containers for a room.
     *
     * @param {Room} room
     * @param {object} layout - Memory.storageLayout[room.name]
     */
    plan(room, layout) {
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return;

        const terrain = room.getTerrain();
        layout.sourceContainers = layout.sourceContainers || {};

        /**
         * Choose a container position adjacent to a given target position.
         * Preference: walkable, not occupied by important structures,
         * and closer to preferPos (spawn by default).
         *
         * @param {RoomPosition} targetPos
         * @param {RoomPosition} preferPos
         * @returns {RoomPosition|null}
         */
        const chooseContainerPos = (targetPos, preferPos) => {
            let best = null;
            let bestDist = Infinity;

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;

                    const x = targetPos.x + dx;
                    const y = targetPos.y + dy;

                    if (x < 0 || x > 49 || y < 0 || y > 49) continue;
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

                    const pos = new RoomPosition(x, y, room.name);

                    // Structures: allow empty / road / container / rampart
                    const structures = room.lookForAt(LOOK_STRUCTURES, pos);
                    if (structures.some(s =>
                        s.structureType !== STRUCTURE_ROAD &&
                        s.structureType !== STRUCTURE_CONTAINER &&
                        s.structureType !== STRUCTURE_RAMPART
                    )) {
                        continue;
                    }

                    // Sites: allow only road/container/rampart
                    const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
                    if (sites.some(s =>
                        s.structureType !== STRUCTURE_ROAD &&
                        s.structureType !== STRUCTURE_CONTAINER &&
                        s.structureType !== STRUCTURE_RAMPART
                    )) {
                        continue;
                    }

                    const ref = preferPos || spawn.pos;
                    const dist = ref.getRangeTo(pos);
                    if (dist < bestDist) {
                        bestDist = dist;
                        best = pos;
                    }
                }
            }

            return best;
        };

        // ---------------- SOURCE CONTAINERS ----------------

        const sources = room.find(FIND_SOURCES);
        for (const source of sources) {
            const srcId = source.id;
            const existingDef = layout.sourceContainers[srcId];

            if (existingDef) {
                // Ensure structure/site still exists at stored position
                const posObj = new RoomPosition(existingDef.x, existingDef.y, room.name);
                const structs = room.lookForAt(LOOK_STRUCTURES, posObj);
                const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, posObj);

                const hasContainer = structs.some(s => s.structureType === STRUCTURE_CONTAINER);
                const hasSite = sites.some(s => s.structureType === STRUCTURE_CONTAINER);

                if (!hasContainer && !hasSite) {
                    room.createConstructionSite(posObj, STRUCTURE_CONTAINER);
                }
                continue;
            }

            // Need a new container position for this source
            const containerPos = chooseContainerPos(source.pos, spawn.pos);
            if (!containerPos) continue;

            layout.sourceContainers[srcId] = {
                x: containerPos.x,
                y: containerPos.y
            };
            room.createConstructionSite(containerPos, STRUCTURE_CONTAINER);
        }

        // ---------------- CONTROLLER CONTAINER ----------------

        if (!room.controller) return;

        if (layout.controllerContainer) {
            const posDef = layout.controllerContainer;
            const posObj = new RoomPosition(posDef.x, posDef.y, room.name);

            const structs = room.lookForAt(LOOK_STRUCTURES, posObj);
            const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, posObj);

            const hasContainer = structs.some(s => s.structureType === STRUCTURE_CONTAINER);
            const hasSite = sites.some(s => s.structureType === STRUCTURE_CONTAINER);

            if (!hasContainer && !hasSite) {
                room.createConstructionSite(posObj, STRUCTURE_CONTAINER);
            }
        } else {
            const ctrlPos = room.controller.pos;
            const ctrlContainerPos = chooseContainerPos(ctrlPos, spawn.pos);
            if (!ctrlContainerPos) return;

            layout.controllerContainer = {
                x: ctrlContainerPos.x,
                y: ctrlContainerPos.y
            };
            room.createConstructionSite(ctrlContainerPos, STRUCTURE_CONTAINER);
        }
    }
};

module.exports = ContainersPlanner;
