// util.error.js
// Error handling and logging utilities for Screeps

/**
 * Centralized error logging.
 * Uses Game.time-based timestamps instead of Date() to remain CPU-safe.
 */
const ErrorHandler = {
    /**
     * Log an error with context.
     *
     * @param {string} context - Where the error occurred (e.g. 'role.harvester')
     * @param {any} error - Error object or value
     * @param {Creep|null} [creep] - Optional creep involved
     */
    log(context, error, creep = null) {
        const tick = Game.time;
        let message = `[T${tick}] ERROR in ${context}`;
        
        if (creep) {
            message += ` (Creep: ${creep.name})`;
        }

        const errMsg = (error && error.message) || String(error);
        message += `: ${errMsg}`;

        if (error && error.stack) {
            message += `\n${error.stack}`;
        }

        console.log(message);

        // Store error in memory for analysis
        this._storeError(context, errMsg, creep);
    },

    /**
     * Store error in Memory for later analysis.
     *
     * @param {string} context
     * @param {string} msg
     * @param {Creep|null} creep
     * @private
     */
    _storeError(context, msg, creep) {
        if (!Memory.errors) Memory.errors = [];

        Memory.errors.push({
            tick: Game.time,
            context,
            message: msg,
            creep: creep ? creep.name : null
        });

        // Keep only last 100 errors to avoid memory bloat
        if (Memory.errors.length > 100) {
            Memory.errors.splice(0, Memory.errors.length - 100);
        }
    },

    /**
     * Get error statistics.
     *
     * @returns {{total:number,byContext:Record<string,number>,recent:Array}}
     */
    getStats() {
        if (!Memory.errors || Memory.errors.length === 0) {
            return { total: 0, byContext: {}, recent: [] };
        }

        /** @type {Record<string, number>} */
        const stats = Object.create(null);
        const errors = Memory.errors;

        for (let i = 0; i < errors.length; i++) {
            const err = errors[i];
            stats[err.context] = (stats[err.context] || 0) + 1;
        }

        return {
            total: errors.length,
            byContext: stats,
            recent: errors.slice(-5)
        };
    },

    /**
     * Clear error log.
     */
    clear() {
        Memory.errors = [];
    },

    /**
     * Safely execute a function with automatic error logging.
     *
     * @template T
     * @param {() => T} fn
     * @param {string} context
     * @param {Creep|null} [creep]
     * @returns {T|null} - Returns fn() result or null on error
     */
    safeExecute(fn, context, creep = null) {
        try {
            return fn();
        } catch (e) {
            this.log(context, e, creep);
            return null;
        }
    }
};

module.exports = ErrorHandler;
