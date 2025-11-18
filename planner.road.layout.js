// planner.road.layout.js
// Handles static "blueprint" roads (spawn plaza, spawn/source/controller/storage triangle)

const Config = require("config");

/**
 * Static road layout planner.
 * Uses PathFinder to create basic "infrastructure" roads that never go away.
 */
const RoadLayoutPlanner = {
    /**
     * Static "blueprint" roads:
     *  - Spawn plaza
     *  - Spawn <-> Controller
     *  - Spawn <-> Sources
     *  - Sources <-> Controller
     *  - Storage-centric roads (when storage exists or is planned)
     *
     * Re-runs when RCL changes or layout version changes.
     *
     * @param {Room} room
     */
    planLayout(room) {
        if (!room.controller || !room.controller.my) return;

        if (!Memory.roadLayout) Memory.roadLayout = {};
        if (!Memory.roadLayout[room.name]) {
            Memory.roadLayout[room.name] = { plannedVersion: 0, lastRCL: 0 };
        }

        const layout = Memory.roadLayout[room.name];
        const LAYOUT_VERSION = 2; // bump when algorithm changes
        const currentRCL = room.controller.level;

        // Skip if layout already planned for this RCL & version
        if (layout.lastRCL === currentRCL && layout.plannedVersion >= LAYOUT_VERSION) {
            return;
        }

        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return;

        const sources = room.find(FIND_SOURCES);
        const controller = room.controller;

        // Determine storage position (built or planned)
        let storagePos = null;
        if (room.storage) {
            storagePos = room.storage.pos;
        } else if (
            Memory.storageLayout &&
            Memory.storageLayout[room.name] &&
            Memory.storageLayout[room.name].storagePos
        ) {
            const sp = Memory.storageLayout[room.name].storagePos;
            storagePos = new RoomPosition(sp.x, sp.y, room.name);
        }

        // 1) Spawn “plaza” around spawn
        this._planSpawnPlaza(room, spawn.pos);

        // 2) Spawn <-> Controller
        if (controller) {
            this._planRoadBetween(room, spawn.pos, controller.pos);
        }

        // 3) Spawn <-> each source
        for (const source of sources) {
            this._planRoadBetween(room, spawn.pos, source.pos);
        }

        // 4) Sources <-> Controller
        if (controller) {
            for (const source of sources) {
                this._planRoadBetween(room, source.pos, controller.pos);
            }
        }

        // 5) Storage-centric roads
        if (storagePos) {
            // spawn <-> storage
            this._planRoadBetween(room, spawn.pos, storagePos);
            // storage <-> controller
            if (controller) {
                this._planRoadBetween(room, storagePos, controller.pos);
            }
            // storage <-> sources
            for (const source of sources) {
                this._planRoadBetween(room, storagePos, source.pos);
            }
            // storage <-> mineral
            const mineral = room.find(FIND_MINERALS)[0];
            if (mineral) {
                this._planRoadBetween(room, storagePos, mineral.pos);
            }
        }

        layout.lastRCL = currentRCL;
        layout.plannedVersion = LAYOUT_VERSION;

        console.log(
            `[RoadPlanner] Planned v${LAYOUT_VERSION} road layout (RCL ${currentRCL}) in room ${room.name}`
        );
    },

    // ---------------- INTERNAL: SPAWN PLAZA ----------------

    /**
     * Build a “plaza” of roads around spawn:
     *  - 3x3 ring around spawn
     *  - ring at radius 2
     *
     * @param {Room} room
     * @param {RoomPosition} spawnPos
     * @private
     */
    _planSpawnPlaza(room, spawnPos) {
        const terrain = room.getTerrain();

        // Ring radius 1 around spawn (3x3 minus center)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const x = spawnPos.x + dx;
                const y = spawnPos.y + dy;
                this._tryPlaceRoad(room, terrain, x, y);
            }
        }

        // Ring radius 2
        const r = 2;
        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                const x = spawnPos.x + dx;
                const y = spawnPos.y + dy;
                this._tryPlaceRoad(room, terrain, x, y);
            }
        }
    },

    /**
     * Try to place a road at x,y if free / appropriate.
     */
    _tryPlaceRoad(room, terrain, x, y) {
        if (x < 0 || x > 49 || y < 0 || y > 49) return;
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) return;

        const pos = new RoomPosition(x, y, room.name);

        const structures = room.lookForAt(LOOK_STRUCTURES, pos);
        // No overwriting important structures; only empty / roads / containers
        if (structures.some(s =>
            s.structureType !== STRUCTURE_ROAD &&
            s.structureType !== STRUCTURE_CONTAINER
        )) {
            return;
        }

        const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
        if (sites.some(s => s.structureType === STRUCTURE_ROAD)) return;

        room.createConstructionSite(pos, STRUCTURE_ROAD);
    },

    /**
     * Path between two positions and place roads along the path.
     *
     * @param {Room} room
     * @param {RoomPosition} fromPos
     * @param {RoomPosition} toPos
     * @private
     */
    _planRoadBetween(room, fromPos, toPos) {
        if (!fromPos || !toPos) return;

        const terrain = room.getTerrain();

        const result = PathFinder.search(
            fromPos,
            { pos: toPos, range: 1 },
            {
                plainCost: 2,
                swampCost: 5,
                maxOps: Config.PATHING.MAX_OPS || 2000,
                roomCallback: roomName => {
                    if (roomName !== room.name) return;
                    const costs = new PathFinder.CostMatrix();

                    room.find(FIND_STRUCTURES).forEach(s => {
                        if (s.structureType === STRUCTURE_ROAD) {
                            costs.set(s.pos.x, s.pos.y, 1);
                        } else if (
                            s.structureType !== STRUCTURE_CONTAINER &&
                            (s.structureType !== STRUCTURE_RAMPART || !s.my)
                        ) {
                            costs.set(s.pos.x, s.pos.y, 0xff);
                        }
                    });

                    return costs;
                }
            }
        );

        if (!result.path || result.path.length === 0) return;

        const spawns = room.find(FIND_MY_SPAWNS);
        const controller = room.controller;

        for (const step of result.path) {
            const x = step.x;
            const y = step.y;

            if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

            // Avoid controller tile
            if (controller &&
                controller.pos.x === x &&
                controller.pos.y === y) {
                continue;
            }

            // Avoid spawn tiles
            if (spawns.some(s => s.pos.x === x && s.pos.y === y)) continue;

            const pos = new RoomPosition(x, y, room.name);

            const structures = room.lookForAt(LOOK_STRUCTURES, pos);
            if (structures.some(s => s.structureType === STRUCTURE_ROAD)) continue;

            const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
            if (sites.some(s => s.structureType === STRUCTURE_ROAD)) continue;

            room.createConstructionSite(pos, STRUCTURE_ROAD);
        }
    }
};

module.exports = RoadLayoutPlanner;
