// planner.defense.js
// Defensive layout planner:
// - RCL < 3: no automated defenses (engine is restrictive at low RCL)
// - RCL >= 3: ramparts just inside all exits + towers near spawn

const Config = require('config');
const DefenseConfig = Config.DEFENSE || {};

const DEBUG = DefenseConfig.DEBUG === true;

const MIN_RCL = DefenseConfig.START_RCL || 3;
const MAX_BORDER_SITES_PER_TICK = DefenseConfig.MAX_RAMPART_SITES_PER_RUN || 12;
const MAX_TOWER_SITES_PER_TICK  = DefenseConfig.MAX_TOWER_SITES_PER_RUN || 1;

const DefensePlanner = {
    /**
     * Main entrypoint.
     *
     * @param {Room} room
     */
    planLayout(room) {
        const ctrl = room.controller;
        if (!ctrl || !ctrl.my) return;

        const rcl = ctrl.level;
        if (!DefenseConfig.ENABLED || rcl < MIN_RCL) {
            if (DEBUG && Game.time % 100 === 0) {
                console.log(
                    `[DefensePlanner] defenses disabled or RCL ${rcl} < ${MIN_RCL} in ${room.name}`
                );
            }
            return;
        }

        const terrain   = room.getTerrain();
        const roomName  = room.name;

        if (DEBUG && Game.time % 50 === 0) {
            console.log(
                `[DefensePlanner] running in ${roomName} at RCL ${rcl} (ramparts+towers)`
            );
        }

        this._planRampartBorders(room, terrain, roomName, rcl);
        this._planTowers(room, rcl);
    },

    /**
     * Plan ramparts along all room entry edges (one tile inward).
     */
    _planRampartBorders(room, terrain, roomName, rcl) {
        let created = 0;

        const allowed = (CONTROLLER_STRUCTURES[STRUCTURE_RAMPART] || {})[rcl] || 0;
        if (allowed <= 0) {
            if (DEBUG && Game.time % 100 === 0) {
                console.log(
                    `[DefensePlanner] no ramparts allowed at RCL ${rcl} in ${roomName}`
                );
            }
            return;
        }

        const existing = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_RAMPART
        }).length;

        const pending = room.find(FIND_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_RAMPART
        }).length;

        let remaining = allowed - existing - pending;
        if (remaining <= 0) {
            if (DEBUG && Game.time % 100 === 0) {
                console.log(
                    `[DefensePlanner] ramparts already at limit in ${roomName} (RCL ${rcl})`
                );
            }
            return;
        }

        const used = new Set();

        const tryPlace = (x, y) => {
            if (created >= MAX_BORDER_SITES_PER_TICK || remaining <= 0) return;
            if (x < 0 || x > 49 || y < 0 || y > 49) return;
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) return;

            const key = `${x}:${y}`;
            if (used.has(key)) return;
            used.add(key);

            const pos = new RoomPosition(x, y, roomName);

            const structs = room.lookForAt(LOOK_STRUCTURES, pos);
            const sites   = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);

            // If there's already a rampart or site here, skip
            if (structs.some(s => s.structureType === STRUCTURE_RAMPART)) return;
            if (sites.some(s => s.structureType === STRUCTURE_RAMPART)) return;

            const res = room.createConstructionSite(pos, STRUCTURE_RAMPART);

            if (DEBUG) {
                console.log(
                    `[DefensePlanner] try RAMPART at ${roomName} ${x},${y} -> ${res}`
                );
            }

            if (res === OK) {
                created++;
                remaining--;
            }
        };

        // Top (y=0) / Bottom (y=49) edges → build inward at y=1 / y=48
        for (let x = 0; x < 50 && created < MAX_BORDER_SITES_PER_TICK && remaining > 0; x++) {
            if (terrain.get(x, 0) !== TERRAIN_MASK_WALL) {
                tryPlace(x, 1);
            }
            if (terrain.get(x, 49) !== TERRAIN_MASK_WALL) {
                tryPlace(x, 48);
            }
        }

        // Left (x=0) / Right (x=49) edges → build inward at x=1 / x=48
        for (let y = 1; y < 49 && created < MAX_BORDER_SITES_PER_TICK && remaining > 0; y++) {
            if (terrain.get(0, y) !== TERRAIN_MASK_WALL) {
                tryPlace(1, y);
            }
            if (terrain.get(49, y) !== TERRAIN_MASK_WALL) {
                tryPlace(48, y);
            }
        }

        if (created > 0 && DEBUG) {
            console.log(
                `[DefensePlanner] placed ${created} rampart site(s) on borders in ${roomName} (RCL ${rcl}, remaining allowed: ${remaining})`
            );
        }
    },

    /**
     * Plan tower construction around spawn.
     */
    _planTowers(room, rcl) {
        const allowed = (CONTROLLER_STRUCTURES[STRUCTURE_TOWER] || {})[rcl] || 0;
        if (allowed <= 0) return;

        const existing = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        }).length;

        const pending = room.find(FIND_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        }).length;

        let remaining = allowed - existing - pending;
        if (remaining <= 0) return;

        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return;

        const terrain = room.getTerrain();
        const roomName = room.name;
        let created = 0;

        const offsets = [
            { dx: 2, dy: 0 },
            { dx: -2, dy: 0 },
            { dx: 0, dy: 2 },
            { dx: 0, dy: -2 },
            { dx: 2, dy: 2 },
            { dx: 2, dy: -2 },
            { dx: -2, dy: 2 },
            { dx: -2, dy: -2 }
        ];

        for (let i = 0; i < offsets.length &&
                        created < MAX_TOWER_SITES_PER_TICK &&
                        remaining > 0; i++) {
            const { dx, dy } = offsets[i];
            const x = spawn.pos.x + dx;
            const y = spawn.pos.y + dy;

            if (x < 0 || x > 49 || y < 0 || y > 49) continue;
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

            const pos = new RoomPosition(x, y, roomName);

            const structs = room.lookForAt(LOOK_STRUCTURES, pos);
            const sites   = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);

            // Allow only on empty/road/container (no other structure)
            if (structs.some(s =>
                    s.structureType !== STRUCTURE_ROAD &&
                    s.structureType !== STRUCTURE_CONTAINER
            )) {
                continue;
            }

            if (sites.length > 0) continue;

            const res = room.createConstructionSite(pos, STRUCTURE_TOWER);

            if (DEBUG) {
                console.log(
                    `[DefensePlanner] try TOWER at ${roomName} ${x},${y} -> ${res}`
                );
            }

            if (res === OK) {
                created++;
                remaining--;
            }
        }

        if (created > 0 && DEBUG) {
            console.log(
                `[DefensePlanner] placed ${created} tower site(s) in ${roomName} (RCL ${rcl})`
            );
        }
    }
};

module.exports = DefensePlanner;
