import { useSettingsStore } from '../stores/settings'
import { formatValue } from '../utils/formatting'

export const useFormatValue = () => {
  const settings = useSettingsStore()
  return (key, value) => formatValue(key, value, {
    precision: settings.metricPrecision[key] ?? null,
  })
}
