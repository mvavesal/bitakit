'use client';
import { Action, useServiceState, useSetting, useTranslation } from '@bitakit/ui';
import {
  Badge,
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
  PageHeader,
} from '@bitakit/ui/components';

/** Every deal, with the Actions this plugin defines bound to each row. */
export default function PipelinePage() {
  const t = useTranslation();
  const deals = useServiceState('pipeline.deals', (state) => state.deals, []);
  const currency = String(useSetting('currency').value);
  const money = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  return (
    <>
      <PageHeader
        title={t('pipeline.page.title', undefined, 'Pipeline')}
        subtitle={t(
          'pipeline.page.subtitle',
          undefined,
          'Deals, with Actions that guard and confirm.',
        )}
        trailing={
          <Action id="pipeline.add">
            <Button size="sm" />
          </Action>
        }
      />
      <ul className="flex flex-col gap-2">
        {deals.map((deal) => (
          <li key={deal.id}>
            <Item variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>
                  {deal.company}: {deal.name}
                  <Badge variant={deal.stage === 'won' ? 'default' : 'secondary'}>
                    {t(`pipeline.stages.${deal.stage}`, undefined, deal.stage)}
                  </Badge>
                </ItemTitle>
                <ItemDescription>{money.format(deal.amount)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Action id="pipeline.win" input={deal.id}>
                  <Button size="sm" variant="outline" />
                </Action>
                <Action id="pipeline.remove" input={deal.id}>
                  <Button size="sm" variant="ghost" />
                </Action>
              </ItemActions>
            </Item>
          </li>
        ))}
      </ul>
    </>
  );
}
