/**
 * @file composables/useAlarmState.js
 * @brief Shared alarm state logic for data ribbon cards and dashboard tab.
 *
 * `acknowledgedAlarms` is module-level (singleton) so an alarm acknowledged
 * on the ribbon is also silenced in the dashboard tab and vice-versa.
 *
 * Usage:
 *   const { getCardState, acknowledgeAlarm } = useAlarmState()
 *   getCardState('voltage') // → 'normal' | 'alert' | 'alarm'
 *   acknowledgeAlarm('voltage') // silences flash, reverts to alert glow
 */

import { ref } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useTelemetryStore } from '../stores/telemetry'

// Singleton — shared across every component that calls useAlarmState()
const acknowledgedAlarms = ref([])

export function useAlarmState() {
    const settings = useSettingsStore()
    const telemetry = useTelemetryStore()

    /**
     * @brief Returns the current alarm state for a telemetry key.
     * @param {string} key
     * @returns {'normal'|'alert'|'alarm'}
     */
    const getCardState = (key) => {
        const t = settings.alarmThresholds[key]
        if (!t) return 'normal'

        const raw = telemetry.displayLiveData[key]
        if (raw === null || raw === undefined || isNaN(Number(raw))) return 'normal'
        const v = Number(raw)

        const breaches = (zone) => {
            if (!zone) return false
            const lo = (zone.lower !== null && zone.lower !== undefined && zone.lower !== '')
                ? Number(zone.lower) : null
            const hi = (zone.upper !== null && zone.upper !== undefined && zone.upper !== '')
                ? Number(zone.upper) : null
            return (lo !== null && v < lo) || (hi !== null && v > hi)
        }

        if (breaches(t.alarm)) {
            return acknowledgedAlarms.value.includes(key) ? 'alert' : 'alarm'
        }

        // Left alarm zone — clear acknowledgment so it can flash again next time
        if (acknowledgedAlarms.value.includes(key)) {
            acknowledgedAlarms.value = acknowledgedAlarms.value.filter(k => k !== key)
        }

        if (breaches(t.alert)) return 'alert'
        return 'normal'
    }

    /**
     * @brief Acknowledge a flashing alarm card — silences flash, reverts to alert glow.
     * @param {string} key
     */
    const acknowledgeAlarm = (key) => {
        if (getCardState(key) === 'alarm' && !acknowledgedAlarms.value.includes(key)) {
            acknowledgedAlarms.value = [...acknowledgedAlarms.value, key]
        }
    }

    return { getCardState, acknowledgeAlarm }
}
