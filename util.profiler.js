// util.profiler.js
// CPU profiling and performance monitoring for Screeps

/**
 * Lightweight in-process profiler.
 * Usage:
 *   Profiler.start('loop');
 *   // ...work...
 *   Profiler.end('loop');
 *
 * Then occasionally:
 *   Profiler.report();
 */
const Profiler = {
    data: {},
    enabled: true,

    /**
     * Start timing a section.
     *
     * @param {string} label
     */
    start(label) {
        if (!this.enabled) return;

        if (!this.data[label]) {
            this.data[label] = {
                calls: 0,
                totalTime: 0,
                minTime: Infinity,
                maxTime: 0,
                lastTime: 0,
                _startTime: 0
            };
        }

        this.data[label]._startTime = Game.cpu.getUsed();
    },

    /**
     * End timing a section.
     *
     * @param {string} label
     */
    end(label) {
        if (!this.enabled || !this.data[label]) return;

        const stats = this.data[label];
        const start = stats._startTime;
        if (start === undefined) return;

        const elapsed = Game.cpu.getUsed() - start;

        stats.calls++;
        stats.totalTime += elapsed;
        stats.lastTime = elapsed;
        stats.minTime = Math.min(stats.minTime, elapsed);
        stats.maxTime = Math.max(stats.maxTime, elapsed);
    },

    /**
     * Get average time for a label.
     *
     * @param {string} label
     * @returns {number}
     */
    getAverage(label) {
        const stats = this.data[label];
        if (!stats || stats.calls === 0) return 0;
        return stats.totalTime / stats.calls;
    },

    /**
     * Get all stats as simple JSON-friendly object.
     *
     * @returns {Record<string,{calls:number,total:string,avg:string,min:string,max:string,last:string}>}
     */
    getStats() {
        /** @type {Record<string, any>} */
        const statsOut = {};

        for (const label in this.data) {
            const d = this.data[label];
            const calls = d.calls || 0;

            const avg = calls > 0 ? (d.totalTime / calls) : 0;

            statsOut[label] = {
                calls,
                total: d.totalTime.toFixed(2),
                avg: avg.toFixed(2),
                min: (d.minTime === Infinity ? 0 : d.minTime).toFixed(2),
                max: d.maxTime.toFixed(2),
                last: d.lastTime.toFixed(2)
            };
        }

        return statsOut;
    },

    /**
     * Print performance report to console.
     */
    report() {
        if (!this.enabled) return;

        const stats = this.getStats();
        console.log('=== PERFORMANCE REPORT ===');
        console.log(`CPU Used: ${Game.cpu.getUsed().toFixed(2)} / ${Game.cpu.limit}`);
        console.log('');

        for (const label in stats) {
            const s = stats[label];
            console.log(
                `${label}: ${s.calls} calls | ` +
                `avg: ${s.avg}ms | ` +
                `total: ${s.total}ms | ` +
                `[${s.min}-${s.max}]ms | ` +
                `last: ${s.last}ms`
            );
        }
    },

    /**
     * Reset all profiler data.
     */
    reset() {
        this.data = {};
    },

    /**
     * Clear old data periodically (keep stats bounded).
     * Call once per tick from main loop.
     */
    cleanup() {
        // Reset stats every 100 ticks to prevent memory bloat.
        if (Game.time % 100 === 0) {
            this.reset();
        }
    }
};

module.exports = Profiler;
