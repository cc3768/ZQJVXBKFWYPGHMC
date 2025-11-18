// managers/defenseManager.js

const towerManager = require('managers.towerManager');
const wallManager  = require('managers.wallManager');

const DEFENSE_MEMORY_VERSION = 1;

const DefenseManager = {
    run(room) {
        try {
            if (!room || !room.controller || !room.controller.my) return;
            if (Game.cpu.bucket < 500) return; // be gentle on low bucket

            this.initRoomMemory(room);

            const context = this.buildContext(room);

            // 1. Threat assessment
            this.assessThreats(context);

            // 2. Tower control (attack/heal/repair)
            towerManager.run(context);

            // 3. Wall / rampart upkeep
            wallManager.run(context);

            // 4. Defender creep handling (optional)
            this.manageDefenders(context);

            if (Game.time % 50 === 0 && context.threatLevel > 0) {
                console.log(`[Defense] Room ${room.name} threatLevel=${context.threatLevel} hostiles=${context.hostiles.length}`);
            }

        } catch (err) {
            console.log(`[Defense] ERROR in room ${room && room.name}: ${err.stack || err}`);
        }
    },

    initRoomMemory(room) {
        const mem = room.memory;
        if (!mem.defense || mem.defense.version !== DEFENSE_MEMORY_VERSION) {
            mem.defense = {
                version: DEFENSE_MEMORY_VERSION,
                wallTargetHits: 500_000,
                rampartTargetHits: 500_000,
                lastThreatSeen: 0,
                panicModeUntil: 0
            };
        }
    },

    buildContext(room) {
        const mem = room.memory.defense;
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        });

        return {
            room,
            mem,
            hostiles,
            towers,
            threatLevel: 0,
            hasActiveThreat: false,
        };
    },

    assessThreats(context) {
        const { room, mem, hostiles } = context;

        if (!hostiles.length) {
            context.threatLevel = 0;
            context.hasActiveThreat = false;
            return;
        }

        // Simple threat scoring
        let score = 0;
        for (const hostile of hostiles) {
            let bodyScore = 0;
            for (const part of hostile.body) {
                if (part.type === ATTACK || part.type === RANGED_ATTACK) bodyScore += 3;
                else if (part.type === HEAL) bodyScore += 4;
                else if (part.type === TOUGH) bodyScore += 1;
                else bodyScore += 0.5;
            }
            score += bodyScore;
        }

        context.threatLevel = score;
        context.hasActiveThreat = score > 0;

        if (score > 0) {
            mem.lastThreatSeen = Game.time;

            // Panic mode: consider enabling Safe Mode if controller allows
            if (score >= 80 && room.controller.safeModeAvailable && !room.controller.safeMode) {
                console.log(`[Defense] Activating Safe Mode in ${room.name} (score=${score})`);
                room.controller.activateSafeMode();
                mem.panicModeUntil = Game.time + 1000;
            }
        }
    },

    manageDefenders(context) {
        const { room, threatLevel, hostiles } = context;

        if (!threatLevel || hostiles.length === 0) return;

        const spawns = room.find(FIND_MY_SPAWNS, { filter: s => !s.spawning });
        if (!spawns.length) return;

        const DEFENDER_BODY_T1 = [TOUGH, TOUGH, MOVE, MOVE, ATTACK, ATTACK];
        const DEFENDER_BODY_T2 = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK];

        let desiredCount = 0;
        if (threatLevel < 40) desiredCount = 1;
        else if (threatLevel < 80) desiredCount = 2;
        else desiredCount = 3;

        const defenders = _.filter(Game.creeps, c =>
            c.memory.role === 'defender' && c.memory.home === room.name);

        if (defenders.length >= desiredCount) return;

        const body = room.energyCapacityAvailable >= 1000 ? DEFENDER_BODY_T2 : DEFENDER_BODY_T1;
        const name = `Def-${room.name}-${Game.time}`;
        const spawn = _.first(spawns);

        const res = spawn.spawnCreep(body, name, {
            memory: {
                role: 'defender',
                home: room.name,
                targetRoom: room.name
            }
        });

        if (res === OK) {
            console.log(`[Defense] Spawning defender ${name} in ${room.name} (threatLevel=${threatLevel})`);
        }
    }
};

module.exports = DefenseManager;
