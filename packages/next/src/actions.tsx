'use client';
import { useActionNavigation } from './routing/use-action-navigation.js';
import { ActionProvider as Provider, type ActionProviderProps } from '@bitakit/ui/actions';
/** Optional framework adapter. Application actions do not depend on Next.js. */
export function ActionProvider(props: ActionProviderProps) {
  const navigation = useActionNavigation();
  return (
    <Provider {...props} navigate={navigation.navigate} Link={props.Link ?? navigation.Link} />
  );
}
