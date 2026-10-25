'use client';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { useServiceState, useSetting, useTranslation } from '@bitakit/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@bitakit/ui/components';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const order = 10;

/**
 * Revenue split into new business and renewals. The range select is the `revenue.range`
 * setting itself: changing it here changes it on the Settings page too.
 */
export default function RevenueWidget() {
  const t = useTranslation();
  const weeks = useServiceState('revenue.data', (state) => state.weeks, []);
  const range = useSetting('revenue.range');
  const currency = String(useSetting('currency').value);
  const money = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  const count = Number(range.value);
  const config = {
    newBusiness: {
      label: t('revenue.widget.newBusiness', undefined, 'New business'),
      color: 'var(--chart-1)',
    },
    renewals: {
      label: t('revenue.widget.renewals', undefined, 'Renewals'),
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig;
  return (
    <Card size="sm" className="pt-0">
      <CardHeader className="flex items-center gap-2 border-b py-3">
        <div className="grid flex-1 gap-0.5">
          <CardTitle>{t('revenue.widget.title', undefined, 'Revenue')}</CardTitle>
          <CardDescription className="text-xs">
            {t(
              'revenue.widget.description',
              { months: count },
              `New business and renewals, last ${count} months`,
            )}
          </CardDescription>
        </div>
        <Select
          value={String(range.value)}
          onValueChange={(value) => range.set(value as never)}
          disabled={range.disabled}
        >
          <SelectTrigger
            size="sm"
            className="w-36"
            aria-label={t('revenue.settings.range.label', undefined, 'Months shown')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['3', '6', '12'].map((value) => (
              <SelectItem key={value} value={value}>
                {t(
                  `revenue.settings.range.options.${value}.label`,
                  undefined,
                  `Last ${value} months`,
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-3 sm:px-4">
        <ChartContainer config={config} className="aspect-auto h-44 w-full">
          <AreaChart data={weeks.slice(-Math.round((count * 52) / 12))}>
            <defs>
              <linearGradient id="fill-new-business" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-newBusiness)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="var(--color-newBusiness)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fill-renewals" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-renewals)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="var(--color-renewals)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              minTickGap={28}
              fontSize={10}
              tickFormatter={(value: string) =>
                new Date(value).toLocaleDateString(undefined, { month: 'short' })
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(String(value)).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                  indicator="dot"
                  formatter={(value, name) =>
                    `${config[name as keyof typeof config]?.label ?? name}: ${money.format(Number(value))}`
                  }
                />
              }
            />
            <Area
              dataKey="renewals"
              type="natural"
              fill="url(#fill-renewals)"
              stroke="var(--color-renewals)"
              stackId="a"
            />
            <Area
              dataKey="newBusiness"
              type="natural"
              fill="url(#fill-new-business)"
              stroke="var(--color-newBusiness)"
              stackId="a"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
