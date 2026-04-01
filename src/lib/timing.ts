export interface TimingMetric {
  name: string
  duration: number
  description?: string
}

export function formatServerTiming(metrics: TimingMetric[]) {
  return metrics
    .filter((metric) => Number.isFinite(metric.duration))
    .map((metric) => {
      const base = `${metric.name};dur=${roundTiming(metric.duration)}`
      return metric.description
        ? `${base};desc="${metric.description.replaceAll('"', "'")}"`
        : base
    })
    .join(", ")
}

export function parseServerTiming(header: string | null | undefined): TimingMetric[] {
  if (!header) {
    return []
  }
  return header
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [name, ...parts] = chunk.split(";").map((item) => item.trim())
      const durationPart = parts.find((item) => item.startsWith("dur="))
      const descriptionPart = parts.find((item) => item.startsWith("desc="))
      const duration = Number(durationPart?.slice(4))
      const description = descriptionPart?.slice(5).replace(/^"|"$/g, "")
      return {
        name,
        duration,
        ...(description ? { description } : {})
      }
    })
    .filter((metric) => metric.name && Number.isFinite(metric.duration))
}

function roundTiming(value: number) {
  return Math.round(value * 100) / 100
}
