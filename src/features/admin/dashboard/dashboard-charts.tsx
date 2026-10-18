import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import { monthLabel } from './dashboard-chart-utils'
import { formatIdr } from '@/lib/format'
import type { DashboardTrendMonth } from './dashboard-schema'

const config = {
  reportedCount: { label: 'Reported', color: 'var(--chart-2)' },
  closedCount: { label: 'Closed', color: 'var(--primary)' },
  cost: { label: 'Maintenance cost', color: 'var(--primary)' },
} satisfies ChartConfig

export function DashboardTrendChart({
  months,
  cost = false,
}: {
  months: DashboardTrendMonth[]
  cost?: boolean
}) {
  const data = months.map((month) => ({
    ...month,
    cost: Number(month.closedCost),
  }))
  if (cost && data.some((month) => !Number.isFinite(month.cost))) {
    return (
      <p className="dashboard-chart-empty">
        Cost values exceed the chart display range.
      </p>
    )
  }
  const hasData = months.some((month) =>
    cost
      ? BigInt(month.closedCost.replace('.', '')) > 0n
      : month.reportedCount > 0 || month.closedCount > 0,
  )
  if (!hasData)
    return (
      <p className="dashboard-chart-empty">
        {cost
          ? 'No closed maintenance costs in this period.'
          : 'No reports in this period.'}
      </p>
    )
  return (
    <ChartContainer
      config={config}
      className="dashboard-chart h-60 w-full aspect-auto"
      role="group"
      aria-label={
        cost
          ? 'Monthly maintenance cost chart'
          : 'Monthly reported and closed reports chart'
      }
    >
      <BarChart
        accessibilityLayer
        data={data}
        margin={{ top: 12, right: 4, left: 0, bottom: 0 }}
        barGap={3}
      >
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
        <XAxis
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          dataKey="month"
          tickFormatter={(value) => monthLabel(String(value), true)}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          interval={0}
        />
        <YAxis
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          width={cost ? 72 : 36}
          tickLine={false}
          axisLine={false}
          allowDecimals={cost}
          tickCount={4}
          tickFormatter={(value) =>
            cost
              ? `Rp ${new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value))}`
              : String(value)
          }
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)' }}
          content={({ active, label }) => {
            const month =
              active && typeof label === 'string'
                ? months.find((month) => month.month === label)
                : undefined
            return month ? (
              <div className="dashboard-chart-tooltip">
                <strong>{monthLabel(month.month)}</strong>
                <dl>
                  {cost ? (
                    <div>
                      <dt>Maintenance cost</dt>
                      <dd>{formatIdr(month.closedCost)}</dd>
                    </div>
                  ) : (
                    <>
                      <div>
                        <dt>Reported</dt>
                        <dd>{month.reportedCount.toLocaleString('en-GB')}</dd>
                      </div>
                      <div>
                        <dt>Closed</dt>
                        <dd>{month.closedCount.toLocaleString('en-GB')}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>
            ) : null
          }}
        />
        {cost ? (
          <Bar
            dataKey="cost"
            name="Maintenance cost"
            fill="var(--color-cost)"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            isAnimationActive={false}
          />
        ) : (
          <>
            <Bar
              dataKey="reportedCount"
              name="Reported"
              fill="var(--color-reportedCount)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
            <Bar
              dataKey="closedCount"
              name="Closed"
              fill="var(--color-closedCount)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
          </>
        )}
      </BarChart>
    </ChartContainer>
  )
}
