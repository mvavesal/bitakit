import type { ReactNode } from 'react';

/** A lightweight window frame around interactive content, without an overlay. */
export function MacWindow({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-window">
      <div className="app-window-bar">
        <span aria-hidden="true" className="window-dots">
          <span />
          <span />
          <span />
        </span>
        <span className="window-title">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}
