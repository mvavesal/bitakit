'use client';
import { useServiceState } from '@bitakit/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@bitakit/ui/components';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

// The first card on the dashboard.
export const order = 10;

const euros = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const monthName = (month: string) =>
  new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(`${month}-01T00:00:00`));

export default function SalesWidget() {
  const months = useServiceState('sales.monthly', (state) => state.months, []);
  const status = useServiceState('sales.monthly', (state) => state.status, 'loading');
  const total = months.reduce((sum, month) => sum + month.revenue, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue</CardTitle>
        <CardDescription>
          <span aria-label="Revenue in six months">{euros.format(total)}</span> in six months
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === 'loading' ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          // Colors come from the theme's chart tokens, so the chart follows light and dark mode.
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={months} accessibilityLayer>
              <XAxis
                dataKey="month"
                tickFormatter={monthName}
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
                fontSize={12}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)' }}
                formatter={(value) => euros.format(Number(value))}
                labelFormatter={(label) => monthName(String(label))}
                contentStyle={{
                  background: 'var(--popover)',
                  color: 'var(--popover-foreground)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
              <Bar dataKey="revenue" name="Revenue" fill="var(--chart-1)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
