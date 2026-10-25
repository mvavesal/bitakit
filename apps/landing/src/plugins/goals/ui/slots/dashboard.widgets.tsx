'use client';
import TrendUpIcon from 'reicon-react/icons/TrendUp';
import { LabelList, PolarAngleAxis, RadialBar, RadialBarChart } from 'recharts';
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

export const order = 30;

/** Three quarter goals as labelled rings; the value target is the `goals.target` setting. */
export default function GoalsWidget() {
  const t = useTranslation();
  const deals = useServiceState('pipeline.deals', (state) => state.deals, []);
  const target = Number(useSetting('goals.target').value);
  const won = deals.filter((deal) => deal.stage === 'won');
  const value = won.reduce((sum, deal) => sum + deal.amount, 0);
  const average = deals.length
    ? deals.reduce((sum, deal) => sum + deal.amount, 0) / deals.length
    : 0;
  const percent = (part: number, whole: number) => Math.min(100, Math.round((part / whole) * 100));
  const config = {
    progress: { label: t('goals.widget.progress', undefined, 'Progress') },
    value: { label: t('goals.widget.value', undefined, 'Value'), color: 'var(--chart-1)' },
    deals: { label: t('goals.widget.deals', undefined, 'Deals won'), color: 'var(--chart-2)' },
    size: { label: t('goals.widget.size', undefined, 'Deal size'), color: 'var(--chart-3)' },
  } satisfies ChartConfig;
  const data = [
    { goal: 'size', progress: percent(average, 30000), fill: 'var(--color-size)' },
    { goal: 'deals', progress: percent(won.length, 6), fill: 'var(--color-deals)' },
    { goal: 'value', progress: percent(value, target), fill: 'var(--color-value)' },
  ];
  return (
    <Card size="sm" className="flex flex-col">
      <CardHeader>
        <CardTitle>{t('goals.widget.title', undefined, 'Quarter goals')}</CardTitle>
        <CardDescription className="text-xs">
          {t('goals.widget.description', undefined, 'Progress towards this quarter’s targets')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer config={config} className="mx-auto aspect-square h-40">
          <RadialBarChart
            data={data}
            startAngle={-90}
            endAngle={270}
            innerRadius={24}
            outerRadius={76}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="goal" />}
            />
            <RadialBar dataKey="progress" background cornerRadius={6}>
              <LabelList
                position="insideStart"
                dataKey="goal"
                formatter={(goal) => config[goal as keyof typeof config]?.label}
                className="fill-white mix-blend-luminosity"
                fontSize={9}
              />
            </RadialBar>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 text-xs">
        <div className="flex items-center gap-1.5 font-medium">
          {t(
            'goals.widget.reached',
            { percent: percent(value, target) },
            `${percent(value, target)}% of the value target`,
          )}
          <TrendUpIcon aria-hidden="true" className="size-3.5" />
        </div>
      </CardFooter>
    </Card>
  );
}
