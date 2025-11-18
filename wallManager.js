// managers/wallManager.js

const WallManager = {
    run(context) {
        const { room, mem } = context;
        if (Game.time % 50 !== 0) return; // run occasionally

        if (!mem.wallTargetHits) mem.wallTargetHits = 200_000;
        if (!mem.rampartTargetHits) mem.rampartTargetHits = 200_000;

        // Gradually raise targets as controller levels up
        const lvl = room.controller && room.controller.level || 1;

        const desired = 200_000 * lvl; // e.g. RCL8 = 1.6m
        mem.wallTargetHits    = Math.min(desired, 3_000_000);
        mem.rampartTargetHits = Math.min(desired, 3_000_000);

        // OPTIONAL: ensure ramparts on important structures
        this.ensureCriticalRamparts(room);
    },

    ensureCriticalRamparts(room) {
        const important = room.find(FIND_MY_STRUCTURES, {
            filter: s => (
                s.structureType === STRUCTURE_SPAWN ||
                s.structureType === STRUCTURE_STORAGE ||
                s.structureType === STRUCTURE_TERMINAL ||
                s.structureType === STRUCTURE_TOWER
            )
        });

        for (const s of important) {
            const hasRampart = s.pos.lookFor(LOOK_STRUCTURES).some(
                st => st.structureType === STRUCTURE_RAMPART
            );

            if (!hasRampart) {
                // Place construction site if not already; don't spam
                const existing = s.pos.lookFor(LOOK_CONSTRUCTION_SITES).some(
                    cs => cs.structureType === STRUCTURE_RAMPART
                );
                if (!existing) {
                    const result = room.createConstructionSite(s.pos, STRUCTURE_RAMPART);
                    if (result === OK) {
                        console.log(`[Defense] Placed rampart site at ${room.name} ${s.pos.x},${s.pos.y} around ${s.structureType}`);
                    }
                }
            }
        }
    }
};

module.exports = WallManager;
