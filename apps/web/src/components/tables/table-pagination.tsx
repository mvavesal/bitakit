'use client';

import { useTranslations } from 'next-intl';
import ChevronLeft from 'reicon-react/icons/ChevronLeft';
import ChevronRight from 'reicon-react/icons/ChevronRight';
import ChevronDown from 'reicon-react/icons/ChevronDown';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const t = useTranslations('Pagination');
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label={t('label')} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('rowsPerPage')}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label={t('rowsPerPage')}>
              {pageSize}
              <ChevronDown data-icon="inline-end" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              {[5, 10, 20, 50].map((size) => (
                <DropdownMenuRadioItem key={size} value={String(size)}>
                  {size}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {t('range', {
            from: total ? (page - 1) * pageSize + 1 : 0,
            to: Math.min(page * pageSize, total),
            total,
          })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('previous')}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="text-sm tabular-nums">{t('page', { page, pages })}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('next')}
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
