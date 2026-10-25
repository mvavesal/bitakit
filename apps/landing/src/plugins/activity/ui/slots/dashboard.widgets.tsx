'use client';
import { useServiceState, useTranslation } from '@bitakit/ui';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@bitakit/ui/components';

export const order = 40;

const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/**
 * Events per day over the last twelve weeks as a heatmap, and the latest events from
 * `pipeline.added`, `pipeline.won` and `pipeline.removed`. Recharts has no heatmap, so the cells
 * are a plain grid in the first chart color.
 */
export default function ActivityWidget() {
  const t = useTranslation();
  const entries = useServiceState('activity.feed', (state) => state.entries, []);
  const weeks = useServiceState('activity.feed', (state) => state.weeks, []);
  const max = Math.max(1, ...weeks.flat());
  const total = weeks.flat().reduce((sum, count) => sum + count, 0);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t('activity.widget.title', undefined, 'Activity')}</CardTitle>
        <CardDescription className="text-xs">
          {t('activity.widget.heatmap', { count: total }, `${total} events in 12 weeks`)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          role="img"
          aria-label={t('activity.widget.heatmap', { count: total }, `${total} events in 12 weeks`)}
          className="grid grid-cols-[auto_1fr] gap-x-2"
        >
          <div className="grid grid-rows-7 gap-1 text-[9px] leading-none text-muted-foreground">
            {weekdays.map((day) => (
              <span key={day} className="flex items-center">
                {t(`activity.weekdays.${day}`, undefined, day)}
              </span>
            ))}
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-1">
            {weeks.flatMap((week, column) =>
              week.map((count, day) => (
                <span
                  key={`${column}-${day}`}
                  title={`${count}`}
                  className="aspect-square rounded-[3px] bg-muted"
                  style={
                    count
                      ? {
                          background: `color-mix(in oklab, var(--chart-1) ${Math.round(15 + (count / max) * 85)}%, transparent)`,
                        }
                      : undefined
                  }
                />
              )),
            )}
          </div>
        </div>
        {entries.length ? (
          <ul className="flex flex-col gap-1.5 text-xs">
            {entries.slice(0, 3).map((entry, index) => (
              <li key={index} className="flex items-center justify-between gap-2">
                <span className="truncate">{entry.name}</span>
                <Badge variant={entry.kind === 'won' ? 'default' : 'secondary'}>
                  {t(`activity.kinds.${entry.kind}`, undefined, entry.kind)}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('activity.widget.empty', undefined, 'Add or win a deal to see it here.')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
