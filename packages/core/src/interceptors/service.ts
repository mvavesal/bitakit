import type { PublicServiceMap } from '../app/types.js';
import type { ServiceMap } from '../definitions.js';

type Contracts = PublicServiceMap & ServiceMap;
type Methods<S> = {
  [K in keyof S & string]: S[K] extends (...args: any[]) => any ? K : never;
}[keyof S & string];
type Service<Name extends string> = Name extends keyof Contracts
  ? NonNullable<Contracts[Name]>
  : Record<string, (...args: any[]) => unknown>;
type Method<Name extends string, Key extends string> = Key extends keyof Service<Name>
  ? Extract<Service<Name>[Key], (...args: any[]) => any>
  : (...args: any[]) => unknown;
type Call<Name extends string, Key extends string> = {
  readonly service: Name;
  readonly method: Key;
  readonly args: Readonly<Parameters<Method<Name, Key>>>;
};
export type ServiceInterceptor = {
  readonly kind: 'service';
  readonly service: string;
  readonly method?: string;
  readonly order?: number;
  before?: (call: any) => void;
  after?: (call: any) => void;
  onError?: (call: any) => void;
};

/** Observes one method or all public methods; callbacks never replace arguments or results. */
export function defineServiceInterceptor<
  const Name extends string,
  const Key extends Methods<Service<Name>> = Methods<Service<Name>>,
>(definition: {
  service: Name;
  method?: Key;
  order?: number;
  before?: (call: Call<Name, Key>) => void;
  after?: (
    call: Call<Name, Key> & { readonly result: Awaited<ReturnType<Method<Name, Key>>> },
  ) => void;
  onError?: (call: Call<Name, Key> & { readonly error: unknown }) => void;
}): ServiceInterceptor {
  return { ...definition, kind: 'service' };
}
export function isServiceInterceptor(value: object): value is ServiceInterceptor {
  return 'kind' in value && value.kind === 'service';
}
