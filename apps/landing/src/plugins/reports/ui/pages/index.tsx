'use client';
import { useFormatter } from 'next-intl';
import { useSetting, useTranslation } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import months from '../../data/months.json';

export default function ReportsPage() {
  const t = useTranslation();
  const format = useFormatter();
  const currency = String(useSetting('currency').value);
  return (
    <>
      <PageHeader title={t('reports.page.title')} subtitle={t('reports.page.subtitle')} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('reports.columns.month')}</TableHead>
            <TableHead>{t('reports.columns.revenue')}</TableHead>
            <TableHead>{t('reports.columns.deals')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {months.map((row) => (
            <TableRow key={row.month}>
              <TableCell>
                {format.dateTime(new Date(row.month), { month: 'long', year: 'numeric' })}
              </TableCell>
              <TableCell>
                {format.number(row.revenue, {
                  style: 'currency',
                  currency,
                  maximumFractionDigits: 0,
                })}
              </TableCell>
              <TableCell>{format.number(row.deals)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
