'use client';

import { createContext, useContext, type ComponentProps } from 'react';
import Link from 'next/link';

export const SettingsDialogContext = createContext(false);

// A dialog occupies one history entry, so closing returns to its original page.
export function SettingsLink(props: ComponentProps<typeof Link>) {
  const inDialog = useContext(SettingsDialogContext);
  if (props['aria-disabled'])
    return (
      <a
        role="link"
        aria-disabled="true"
        tabIndex={-1}
        className={props.className}
        title={props.title}
      >
        {props.children}
      </a>
    );
  return (
    <Link {...props} replace={inDialog || props.replace} scroll={inDialog ? false : props.scroll} />
  );
}
