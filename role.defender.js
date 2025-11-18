// roles/defender.js

module.exports = {
    run(creep) {
        if (creep.fatigue > 0) return;

        const room = Game.rooms[creep.memory.targetRoom] || creep.room;

        // 1. If not in target room, move there
        if (creep.room.name !== room.name) {
            const exitDir = creep.room.findExitTo(room.name);
            const exitPos = creep.pos.findClosestByRange(exitDir);
            if (exitPos) creep.moveTo(exitPos, { reusePath: 10, range: 0 });
            return;
        }

        // 2. Attack hostiles
        const hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if (hostile) {
            if (creep.pos.inRangeTo(hostile, 1)) {
                creep.attack(hostile);
            } else if (creep.pos.inRangeTo(hostile, 3) && creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
                creep.rangedAttack(hostile);
                creep.moveTo(hostile, { reusePath: 5, range: 3 });
            } else {
                creep.moveTo(hostile, { reusePath: 5, range: 1 });
            }
            return;
        }

        // 3. Fallback: patrol near important objects
        const anchor = room.controller || _.first(room.find(FIND_MY_SPAWNS));
        if (anchor) {
            if (!creep.pos.inRangeTo(anchor, 4)) {
                creep.moveTo(anchor, { reusePath: 10, range: 3 });
            }
        } else {
            // Lazy random walk
            if (Game.time % 10 === 0) {
                const dir = Math.floor(Math.random() * 8) + 1;
                creep.move(dir);
            }
        }
    }
};
