'use client';

import { useTheme } from '@/hooks/use-theme';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import CircleCheckIcon from 'reicon-react/icons/Check';
import InfoIcon from 'reicon-react/icons/InfoCircle';
import TriangleAlertIcon from 'reicon-react/icons/Warning';
import OctagonXIcon from 'reicon-react/icons/CloseCircle';
import Loader2Icon from 'reicon-react/icons/Refresh';
import { useTranslations } from 'next-intl';

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolved } = useTheme();
  const t = useTranslations('Notifications');

  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      richColors
      closeButton
      duration={4000}
      containerAriaLabel={t('label')}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" aria-hidden="true" />,
        info: <InfoIcon className="size-4" aria-hidden="true" />,
        warning: <TriangleAlertIcon className="size-4" aria-hidden="true" />,
        error: <OctagonXIcon className="size-4" aria-hidden="true" />,
        loading: <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />,
      }}
      style={
        {
          '--warning-bg': 'var(--warning-surface)',
          '--warning-text': 'var(--warning-foreground)',
          '--warning-border': 'var(--status-warning-border)',
          '--info-bg': 'var(--popover)',
          '--info-text': 'var(--popover-foreground)',
          '--info-border': 'var(--border)',
          '--success-bg': 'var(--success-surface)',
          '--success-text': 'var(--success-foreground)',
          '--success-border': 'var(--status-success-border)',
          '--error-bg': 'var(--error-surface)',
          '--error-text': 'var(--error-foreground)',
          '--error-border': 'var(--status-error-border)',
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
