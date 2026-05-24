/**
 * @file formatting.js
 * @brief Display formatting utilities for telemetry data.
 * @description Provides helpers to format values and determine display units
 *              based on telemetry data key names.
 */

/**
 * @brief Get the display unit for a telemetry data key.
 * @description Infers the appropriate unit string based on the key name.
 *              Uses pattern matching on common telemetry naming conventions.
 * 
 * @param {string} key - The telemetry data key (e.g., 'speed', 'voltage', 'temp1')
 * @returns {string} The unit string (e.g., 'mph', 'V', '°C') or empty string if unknown
 */
export const getUnit = (key) => {
    const k = key.toLowerCase()
    if (k.includes('rpm')) return 'RPM'
    if (k.includes('gear')) return ''
    if (k.includes('lap')) return ''
    if (k.includes('speed')) return 'mph'
    if (k.includes('volt') || k.includes('batt') || k === 'v') return 'V'
    if (k.includes('amph')) return 'Ah'
    if (k.includes('curr') || k.includes('amp')) return 'A'
    if (k.includes('temp')) return '°C'
    if (k.includes('throttle') || k.includes('soc')) return '%'
    if (k.includes('press')) return 'psi'
    return ''
}

/**
 * @brief Format a telemetry value for display.
 * @description Applies appropriate formatting based on the data type and key name.
 *              Handles null/undefined gracefully, formats timestamps as time strings,
 *              GPS coordinates with high precision, and general numbers with 2 decimal places.
 * 
 * @param {string} key - The telemetry data key used to determine formatting rules
 * @param {*} value - The value to format (number, string, null, undefined)
 * @returns {string} Formatted string representation of the value
 */
export const formatValue = (key, value, opts = {}) => {
    if (value === null || value === undefined) return '-'
    if (typeof value !== 'number') return value

    const k = key.toLowerCase()

    // Special formats — precision override does not apply to these
    if (k === 'lastlaptime') {
        const m = Math.floor(value / 60)
        const s = (value % 60).toFixed(1).padStart(4, '0')
        return `${m}:${s}`
    }
    if (k === 'updated' || k === 'timestamp' || k.includes('time')) {
        return new Date(value).toLocaleTimeString()
    }
    if (k === 'lat' || k === 'lon' || k.includes('gps')) {
        return value.toFixed(5)
    }

    // Per-metric precision override
    if (opts.precision !== null && opts.precision !== undefined) {
        return value.toFixed(opts.precision)
    }

    // Default: integers for rpm/gear/lap/brake, 2 dp for everything else
    if (k.includes('rpm') || k.includes('gear') || k.includes('lap') || k.includes('brake')) {
        return value.toFixed(0)
    }
    return value.toFixed(2)
}
