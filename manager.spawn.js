// manager.spawn.js
// Handles spawn decisions per spawn.

const Config = require("config");

/**
 * Calculate the total energy cost of a body array.
 * @param {BodyPartConstant[]} body
 * @returns {number}
 */
function bodyCost(body) {
    return body.reduce((sum, part) => sum + BODYPART_COST[part], 0);
}

/**
 * Count creeps by role.
 * @param {Creep[]} creeps
 */
function countByRole(creeps) {
    const counts = {
        [Config.ROLES.HARVESTER]: 0,
        [Config.ROLES.UPGRADER]:  0,
        [Config.ROLES.BUILDER]:   0
    };

    for (let i = 0; i < creeps.length; i++) {
        const role = creeps[i].memory.role;
        if (counts[role] !== undefined) {
            counts[role]++;
        }
    }

    return counts;
}

/**
 * Try to spawn a body for a role, respecting room capacity.
 * If the standard body is too expensive, fall back to emergency (if defined).
 *
 * @param {StructureSpawn} spawn
 * @param {string} role
 */
function attemptStandardSpawn(spawn, role) {
    const room = spawn.room;
    const energyAvailable = room.energyAvailable;
    const energyCapacity  = room.energyCapacityAvailable;

    const standardBody = Config.SPAWN.BODY[role.toLowerCase()];
    let bodyToUse = standardBody;

    if (!standardBody) {
        console.log(`[Spawn ${spawn.name}] No standard body defined for role ${role}`);
        return;
    }

    let cost = bodyCost(standardBody);

    // If standard body doesn't fit capacity, fall back to emergency (for that role)
    if (cost > energyCapacity) {
        const emergencyBody = Config.SPAWN.EMERGENCY_BODY[role];
        if (emergencyBody) {
            const emergencyCost = bodyCost(emergencyBody);
            if (emergencyCost <= energyCapacity) {
                bodyToUse = emergencyBody;
                cost = emergencyCost;
            } else {
                // Even emergency body doesn't fit; bail out
                return;
            }
        } else {
            // No emergency body defined for this role, nothing we can do
            return;
        }
    }

    // Only spawn if we currently have enough energy to pay for chosen body
    if (energyAvailable < cost) {
        return;
    }

    const name = `${role}-${Game.time}`;
    const res = spawn.spawnCreep(bodyToUse, name, {
        memory: {
            role,
            working: false
        }
    });

    if (res === OK) {
        console.log(`[Spawn ${spawn.name}] Spawning ${role} (${name}) in ${room.name}`);
    } else if (res !== ERR_BUSY && res !== ERR_NOT_ENOUGH_ENERGY) {
        console.log(`[Spawn ${spawn.name}] Failed to spawn ${role} in ${room.name}: ${res}`);
    }
}

/**
 * Try to spawn an emergency harvester when we have no harvesters/creeps.
 *
 * @param {StructureSpawn} spawn
 */
function spawnEmergencyHarvester(spawn) {
    const room = spawn.room;
    const energyAvailable = room.energyAvailable;

    const body = Config.SPAWN.EMERGENCY_BODY[Config.ROLES.HARVESTER];
    if (!body) {
        console.log(`[Spawn ${spawn.name}] No emergency body defined for harvester`);
        return;
    }

    const cost = bodyCost(body);
    if (energyAvailable < cost) {
        return;
    }

    const name = `E-harvester-${Game.time}`;
    const res = spawn.spawnCreep(body, name, {
        memory: {
            role: Config.ROLES.HARVESTER,
            working: false,
            emergency: true
        }
    });

    if (res === OK) {
        console.log(`[Spawn ${spawn.name}] EMERGENCY harvester (${name}) in ${room.name}`);
    } else if (res !== ERR_BUSY && res !== ERR_NOT_ENOUGH_ENERGY) {
        console.log(
            `[Spawn ${spawn.name}] Failed to spawn emergency harvester in ${room.name}: ${res}`
        );
    }
}

const SpawnManager = {
    /**
     * Per-spawn logic. Called from manager.room with a precomputed creep list.
     *
     * @param {StructureSpawn} spawn
     * @param {Creep[]} creepsInRoom
     */
    run(spawn, creepsInRoom) {
        const room = spawn.room;
        if (!room || !room.controller || !room.controller.my) return;

        if (spawn.spawning) return;

        const creeps = creepsInRoom || room.find(FIND_MY_CREEPS);
        const { HARVESTER, UPGRADER, BUILDER } = Config.ROLES;
        const counts = countByRole(creeps);

        const rcl       = room.controller.level;
        const maxCreeps = Config.POPULATION.maxCreepsForRCL(rcl);

        const energyAvailable = room.energyAvailable;
        const criticalEnergy  = energyAvailable < Config.POPULATION.MIN_ROOM_ENERGY_TO_SPAWN;

        // ---------- EMERGENCY: NO HARVESTERS / NO CREEPS ----------
        if (creeps.length === 0 || counts[HARVESTER] === 0) {
            if (
                energyAvailable >= Config.POPULATION.EMERGENCY_MIN_ENERGY &&
                counts[HARVESTER] < Config.POPULATION.EMERGENCY_HARVESTERS
            ) {
                spawnEmergencyHarvester(spawn);
            }
            return;
        }

        if (creeps.length >= maxCreeps) {
            return;
        }

        // ---------- NORMAL PRIORITY ----------
        let roleToSpawn = null;

        if (counts[HARVESTER] < Config.POPULATION.MIN_HARVESTERS) {
            roleToSpawn = HARVESTER;
        } else if (counts[UPGRADER] < Config.POPULATION.MIN_UPGRADERS) {
            roleToSpawn = UPGRADER;
        } else {
            const hasConstruction = room.find(FIND_CONSTRUCTION_SITES).length > 0;
            if (hasConstruction && counts[BUILDER] < Config.POPULATION.MIN_BUILDERS) {
                roleToSpawn = BUILDER;
            }
        }

        // extra upgrader if we're healthy & below max
        if (!roleToSpawn && creeps.length < maxCreeps && !criticalEnergy) {
            roleToSpawn = UPGRADER;
        }

        if (!roleToSpawn) return;

        attemptStandardSpawn(spawn, roleToSpawn);
    }
};

module.exports = SpawnManager;
