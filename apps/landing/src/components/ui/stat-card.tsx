'use client';
import { useId, type ComponentType, type SVGProps } from 'react';
import { Area, AreaChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@bitakit/ui/components';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';

/**
 * Shared KPI composition. Container width places the sparkline below narrow metrics,
 * so long localized values remain in normal flow. Standard Card and chart own the visuals.
 */
export function StatCard({
  icon: Icon,
  title,
  caption,
  value,
  series,
  color,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  caption: string;
  value: string;
  series: number[];
  color: `var(--chart-${1 | 2 | 3 | 4 | 5})`;
}) {
  const config = { value: { label: title, color } } satisfies ChartConfig;
  const data = series.map((point, index) => ({ index, value: point }));
  const id = useId();
  return (
    <Card size="sm" className="@container/stat min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon aria-hidden="true" className="size-4 shrink-0" style={{ color }} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid min-w-0 flex-1 grid-rows-[1fr_auto] gap-3 @xs/stat:grid-cols-[minmax(0,1fr)_6rem] @xs/stat:grid-rows-1 @xs/stat:items-end">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-foreground">{caption}</span>
          <span className="text-xl font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere]">
            {value}
          </span>
        </div>
        <ChartContainer config={config} className="aspect-auto h-10 w-full min-w-0">
          <AreaChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              dataKey="value"
              type="natural"
              stroke="var(--color-value)"
              strokeWidth={2}
              fill={`url(#${id})`}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
