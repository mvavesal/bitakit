'use client';
import TrendUpIcon from 'reicon-react/icons/TrendUp';
import TrendDownIcon from 'reicon-react/icons/TrendDown';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { useServiceState, useSetting, useTranslation } from '@bitakit/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@bitakit/ui/components';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { lastQuarter, stages } from '../../services/deals';

export const order = 20;

/** Deal value per stage, this quarter (live) against last quarter. */
export default function PipelineWidget() {
  const t = useTranslation();
  const deals = useServiceState('pipeline.deals', (state) => state.deals, []);
  const currency = String(useSetting('currency').value);
  const money = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    notation: 'compact',
  });
  const config = {
    thisQuarter: {
      label: t('pipeline.widget.thisQuarter', undefined, 'This quarter'),
      color: 'var(--chart-1)',
    },
    lastQuarter: {
      label: t('pipeline.widget.lastQuarter', undefined, 'Last quarter'),
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig;
  const data = stages.map((stage) => ({
    stage: t(`pipeline.stages.${stage}`, undefined, stage),
    thisQuarter: deals
      .filter((deal) => deal.stage === stage)
      .reduce((sum, deal) => sum + deal.amount, 0),
    lastQuarter: lastQuarter[stage],
  }));
  const now = data.reduce((sum, entry) => sum + entry.thisQuarter, 0);
  const before = data.reduce((sum, entry) => sum + entry.lastQuarter, 0);
  const percent = Math.round(((now - before) / before) * 100);
  const Trend = percent >= 0 ? TrendUpIcon : TrendDownIcon;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t('pipeline.widget.title', undefined, 'Pipeline')}</CardTitle>
        <CardDescription className="text-xs">
          {t(
            'pipeline.widget.description',
            undefined,
            'Deal value per stage, this and last quarter',
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-36 w-full">
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="stage" tickLine={false} axisLine={false} tickMargin={6} fontSize={10} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dashed"
                  formatter={(value, name) =>
                    `${config[name as keyof typeof config]?.label ?? name}: ${money.format(Number(value))}`
                  }
                />
              }
            />
            <Bar dataKey="thisQuarter" fill="var(--color-thisQuarter)" radius={4} />
            <Bar dataKey="lastQuarter" fill="var(--color-lastQuarter)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 text-xs">
        <div className="flex items-center gap-1.5 font-medium">
          {t(
            percent >= 0 ? 'pipeline.widget.trendUp' : 'pipeline.widget.trendDown',
            { percent: Math.abs(percent) },
            `${percent}%`,
          )}
          <Trend aria-hidden="true" className="size-3.5" />
        </div>
        <div className="text-muted-foreground">
          {t('pipeline.widget.count', { count: deals.length }, `${deals.length} deals`)}
        </div>
      </CardFooter>
    </Card>
  );
}
