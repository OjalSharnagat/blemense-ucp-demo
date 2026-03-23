import { Badge } from '../../../ui/badge'
import { formatCompactCurrency } from './format'

export type ChartSeries = {
  label: string
  color: string
  values: Array<number | null>
}

export type CohortRow = {
  label: string
  date: Date
  size: number
  repeatRate: number
  averageOrders: number
  averageSpend: number
  bands: Record<'1' | '2-3' | '4-5' | '6+', number>
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function buildSegments(values: Array<number | null>): number[][] {
  const segments: number[][] = []
  let current: number[] = []

  values.forEach((value, index) => {
    if (value === null || Number.isNaN(value)) {
      if (current.length > 0) {
        segments.push(current)
        current = []
      }
      return
    }

    current.push(index)
  })

  if (current.length > 0) {
    segments.push(current)
  }

  return segments
}

function getLineChartTicks(min: number, max: number): number[] {
  if (min === max) return [min]

  const span = max - min
  const step = span / 4
  return Array.from({ length: 5 }, (_, index) => round2(min + step * index))
}

export function MultiLineChart({
  labels,
  series,
  forecastStartIndex,
  yFormatter = formatCompactCurrency,
  height = 280,
  ariaLabel
}: {
  labels: string[]
  series: ChartSeries[]
  forecastStartIndex?: number
  yFormatter?: (value: number) => string
  height?: number
  ariaLabel: string
}) {
  const width = 860
  const padding = { top: 24, right: 20, bottom: 44, left: 68 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const step = labels.length > 1 ? innerWidth / (labels.length - 1) : 0
  const values = series.flatMap((item) => item.values.filter((value): value is number => value !== null && !Number.isNaN(value)))
  const min = Math.min(0, ...values)
  const max = Math.max(...values, 1)
  const range = Math.max(max - min, 1)
  const shouldShowLabel = (index: number): boolean => labels.length <= 8 || index % 2 === 0 || index === labels.length - 1

  const xAt = (index: number): number =>
    labels.length === 1 ? padding.left + innerWidth / 2 : padding.left + index * step

  const yAt = (value: number): number => padding.top + ((max - value) / range) * innerHeight

  return (
    <div className="space-y-4">
      <div className="analytics-legend">
        {series.map((item) => (
          <Badge key={item.label} variant="secondary" className="analytics-legend-chip">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </Badge>
        ))}
      </div>

      <div className="analytics-chart-frame overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[280px] w-full min-w-[760px]"
          role="img"
          aria-label={ariaLabel}
        >
          {forecastStartIndex !== undefined && forecastStartIndex >= 0 && forecastStartIndex < labels.length ? (
            <rect
              x={xAt(forecastStartIndex)}
              y={padding.top}
              width={width - padding.right - xAt(forecastStartIndex)}
              height={innerHeight}
              fill="rgba(148, 163, 184, 0.14)"
            />
          ) : null}

          {getLineChartTicks(min, max).map((tick) => {
            const y = yAt(tick)
            return (
              <g key={tick}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(148, 163, 184, 0.22)" />
                <text x={padding.left - 10} y={y + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
                  {yFormatter(tick)}
                </text>
              </g>
            )
          })}

          {series.map((item, seriesIndex) => {
            const segments = buildSegments(item.values)
            return (
              <g key={item.label}>
                {segments.map((segment, segmentIndex) => {
                  const points = segment
                    .map((index) => {
                      const value = item.values[index]
                      if (value === null || Number.isNaN(value)) return null
                      return `${xAt(index)},${yAt(value)}`
                    })
                    .filter(Boolean)
                    .join(' ')

                  if (!points) return null

                  return (
                    <polyline
                      key={`${item.label}-${segmentIndex}`}
                      points={points}
                      fill="none"
                      stroke={item.color}
                      strokeWidth={seriesIndex === 2 ? 3.5 : 2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={item.label.toLowerCase().includes('forecast') ? '7 6' : undefined}
                    />
                  )
                })}

                {item.values.map((value, index) => {
                  if (value === null || Number.isNaN(value)) return null

                  return (
                    <circle
                      key={`${item.label}-${index}`}
                      cx={xAt(index)}
                      cy={yAt(value)}
                      r={seriesIndex === 2 ? 4 : 3}
                      fill="white"
                      stroke={item.color}
                      strokeWidth="2"
                    />
                  )
                })}
              </g>
            )
          })}

          {labels.map((label, index) => {
            if (!shouldShowLabel(index)) return null
            return (
              <text
                key={label}
                x={xAt(index)}
                y={height - 14}
                textAnchor="middle"
                className="fill-slate-500 text-[11px]"
              >
                {label}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export function HorizontalBarChart({
  items
}: {
  items: Array<{
    label: string
    category: string
    units: number
    revenue: number
    share: number
    color: string
  }>
}) {
  const maxUnits = Math.max(...items.map((item) => item.units), 1)

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const width = (item.units / maxUnits) * 100

        return (
          <div key={item.label} className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  <p className="truncate text-sm font-medium text-slate-900">{item.label}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.category}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p className="font-semibold text-slate-900">{item.units} units</p>
                <p>{formatCompactCurrency(item.revenue)}</p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${Math.max(width, 6)}%`,
                  background: `linear-gradient(90deg, ${item.color}, rgba(255,255,255,0.9))`
                }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>{Math.round(item.share * 100)}% of sold units</span>
              <span>{formatCompactCurrency(item.revenue)} attributed</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function CohortHeatmap({ rows }: { rows: CohortRow[] }) {
  const columns: Array<{ key: keyof CohortRow['bands'] | 'size' | 'repeatRate' | 'averageOrders' | 'averageSpend'; label: string; type: 'band' | 'metric' }> = [
    { key: '1', label: '1 order', type: 'band' },
    { key: '2-3', label: '2-3 orders', type: 'band' },
    { key: '4-5', label: '4-5 orders', type: 'band' },
    { key: '6+', label: '6+ orders', type: 'band' },
    { key: 'size', label: 'Size', type: 'metric' },
    { key: 'repeatRate', label: 'Repeat rate', type: 'metric' },
    { key: 'averageOrders', label: 'Avg orders', type: 'metric' },
    { key: 'averageSpend', label: 'Avg spend', type: 'metric' }
  ]

  return (
    <div className="overflow-x-auto">
      <table className="analytics-cohort-table min-w-[920px] w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-2 py-3">Cohort</th>
            {columns.map((column) => (
              <th key={column.label} className="px-2 py-3">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const bandValues = Object.values(row.bands)
            const maxBand = Math.max(...bandValues, 1)

            return (
              <tr key={row.label} className="border-b last:border-0">
                <td className="px-2 py-4 align-middle font-medium text-slate-900">{row.label}</td>
                {columns.map((column) => {
                  if (column.type === 'band') {
                    const value = row.bands[column.key as keyof CohortRow['bands']]
                    const opacity = clamp(value / maxBand, 0.05, 1)
                    return (
                      <td key={`${row.label}-${column.label}`} className="px-2 py-4 align-middle">
                        <div
                          className="rounded-md px-3 py-2 text-center text-xs font-semibold"
                          style={{
                            backgroundColor: `rgba(37, 99, 235, ${0.08 + opacity * 0.78})`,
                            color: opacity > 0.52 ? 'white' : 'rgb(30, 41, 59)'
                          }}
                        >
                          {Math.round((value / row.size) * 100)}%
                        </div>
                      </td>
                    )
                  }

                  const value =
                    column.key === 'size'
                      ? row.size
                      : column.key === 'repeatRate'
                        ? row.repeatRate
                        : column.key === 'averageOrders'
                          ? row.averageOrders
                          : row.averageSpend

                  return (
                    <td key={`${row.label}-${column.label}`} className="px-2 py-4 align-middle">
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-800">
                        {column.key === 'size'
                          ? value.toLocaleString('en-IN')
                          : column.key === 'repeatRate'
                            ? `${Math.round(value * 100)}%`
                            : column.key === 'averageSpend'
                              ? formatCompactCurrency(value)
                              : value.toFixed(1)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
