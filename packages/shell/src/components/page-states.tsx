'use client';
import type { ReactNode } from 'react';
import { useTranslation } from '@bitakit/ui';
import SearchIcon from 'reicon-react/icons/SearchNormal';
import WarningIcon from 'reicon-react/icons/Warning';
import LockIcon from 'reicon-react/icons/Lock';
import { Button } from '@bitakit/ui/components';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from './ui/empty.js';

export type PageStateProps = {
  title?: ReactNode;
  description?: ReactNode;
  /** Host-owned links and controls; these components do not navigate. */
  children?: ReactNode;
};

function PageState({
  title,
  description,
  children,
  icon,
  loading = false,
}: PageStateProps & {
  icon?: ReactNode;
  loading?: boolean;
}) {
  return (
    <Empty role={loading ? 'status' : undefined} aria-busy={loading || undefined}>
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle role="heading" aria-level={1}>
          {title}
        </EmptyTitle>
        {description != null && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children != null && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}

/** Presentation only: use the framework's native not-found route to set the HTTP status. */
export function NotFoundPage({ title, description, ...props }: PageStateProps) {
  const t = useTranslation();
  return (
    <PageState
      {...props}
      icon={<SearchIcon aria-hidden="true" />}
      title={title ?? t('shell.pages.notFound.title', undefined, 'Page not found')}
      description={
        description ??
        t(
          'shell.pages.notFound.description',
          undefined,
          'The page you are looking for is unavailable.',
        )
      }
    />
  );
}

/** Safe error presentation: raw errors are never rendered. The host owns recovery. */
export function ErrorPage({
  title,
  description,
  reset,
  children,
}: PageStateProps & {
  reset?: () => void;
}) {
  const t = useTranslation();
  return (
    <PageState
      icon={<WarningIcon aria-hidden="true" />}
      title={title ?? t('shell.pages.error.title', undefined, 'Something went wrong')}
      description={
        description ?? t('shell.pages.error.description', undefined, 'Please try again.')
      }
    >
      {reset && (
        <Button type="button" onClick={reset}>
          {t('shell.pages.error.retry', undefined, 'Try again')}
        </Button>
      )}
      {children}
    </PageState>
  );
}

export function LoadingPage({ title, description, ...props }: PageStateProps) {
  const t = useTranslation();
  return (
    <PageState
      {...props}
      loading
      title={title ?? t('shell.pages.loading.title', undefined, 'Loading')}
      description={
        description ?? t('shell.pages.loading.description', undefined, 'Please wait a moment.')
      }
    />
  );
}

export function AccessDeniedPage({ title, description, ...props }: PageStateProps) {
  const t = useTranslation();
  return (
    <PageState
      {...props}
      icon={<LockIcon aria-hidden="true" />}
      title={title ?? t('shell.pages.accessDenied.title', undefined, 'Access denied')}
      description={
        description ??
        t('shell.pages.accessDenied.description', undefined, 'You do not have access to this page.')
      }
    />
  );
}
