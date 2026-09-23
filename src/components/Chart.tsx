export interface ChartDatum {
  label: string
  value: number
}

const SLOT_W = 56
const BAR_GAP = 16
const AXIS_H = 20
const TOP_PAD = 16
const VALUE_LABEL_MIN_W = 30

export function BarChart({
  data,
  height = 220,
  valueFormat,
  showAxis = true,
}: {
  data: ChartDatum[]
  height?: number
  valueFormat?: (n: number) => string
  showAxis?: boolean
}) {
  const max = data.reduce((m, d) => Math.max(m, d.value), 0)

  if (data.length === 0 || max <= 0) {
    return (
      <div className="chart-wrap">
        <div className="empty">
          <div className="empty-title">Belum ada data</div>
        </div>
      </div>
    )
  }

  const fmt = valueFormat ?? ((n: number) => String(n))
  const width = data.length * SLOT_W
  const axisH = showAxis ? AXIS_H : 2
  const plotTop = TOP_PAD
  const plotH = height - axisH - plotTop
  const barW = Math.max(6, SLOT_W - BAR_GAP)

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet">
        {data.map((d, i) => {
          const cx = i * SLOT_W + SLOT_W / 2
          const barH = d.value > 0 ? (d.value / max) * plotH : 0
          const barY = plotTop + plotH - barH
          const showValue = d.value > 0 && barW >= VALUE_LABEL_MIN_W
          return (
            <g key={i}>
              <rect className="chart-bar" x={cx - barW / 2} y={barY} width={barW} height={barH} rx={4} />
              {showValue && (
                <text className="chart-axis" x={cx} y={barY - 5} textAnchor="middle">
                  {fmt(d.value)}
                </text>
              )}
              {showAxis && (
                <text className="chart-axis" x={cx} y={height - 5} textAnchor="middle">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function RankList({
  items,
}: {
  items: Array<{ name: string; label?: string; value: number; valueText?: string }>
}) {
  const max = Math.max(1, ...items.map((it) => it.value))

  if (items.length === 0) {
    return (
      <div className="empty">
        <div className="empty-title">Belum ada data</div>
      </div>
    )
  }

  return (
    <div className="row-list">
      {items.map((it, i) => {
        const pct = it.value > 0 ? Math.min(100, (it.value / max) * 100) : 0
        return (
          <div className="row" key={i}>
            <div className="row-main">
              <div className="row-title">{it.name}</div>
              {it.label && <div className="row-sub">{it.label}</div>}
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: 'var(--bg-soft)',
                  overflow: 'hidden',
                  marginTop: 8,
                }}
              >
                <div style={{ width: pct + '%', height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
              </div>
            </div>
            <div className="num" style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
              {it.valueText ?? String(it.value)}
            </div>
          </div>
        )
      })}
    </div>
  )
}