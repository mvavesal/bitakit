import type { FoundationApp } from '../app/types.js';
import type { ConfigContext } from '../config-service.js';
import type { PlainDefinition, Services } from '../definitions.js';

export interface ActionInstance<State extends object> {
  readonly app: FoundationApp;
  readonly services: Services;
  readonly config: ConfigContext;
  readonly state: {
    get(): Readonly<State>;
    update(change: (current: Readonly<State>) => State): boolean;
  };
}
export interface StatefulDefinition<Input, State extends object, Result, Id extends string>
  extends PlainDefinition<Input, Result> {
  kind: 'action';

  id?: Id;
  initialState: State;
}
type StatefulOptions<Input, State extends object, Result, Id extends string> = Omit<
  PlainDefinition<Input, Result>,
  'kind' | 'execute' | 'id' | 'initialState'
> & {
  id?: Id;
  title?: string;
  initialState: State;
  execute(input: Input): Result | Promise<Result>;
} & ThisType<ActionInstance<NoInfer<State>>>;

export interface StatefulBuilder<Input> {
  <State extends object, Result, const Id extends string = string>(
    options: StatefulOptions<Input, State, Result, Id>,
  ): StatefulDefinition<Input, State, Result, Id>;
}
/** Adapts instance-style authoring to the existing command and registration lifetime. */
export function statefulAction<Input>(): StatefulBuilder<Input> {
  return <State extends object, Result, const Id extends string = string>(
    options: StatefulOptions<Input, State, Result, Id>,
  ): StatefulDefinition<Input, State, Result, Id> => {
    const { execute, ...definition } = options;
    const adapted: PlainDefinition<Input, Result> & { id?: Id; initialState: State } = {
      ...definition,
      kind: 'action',
      execute(context) {
        const read = () => {
          const snapshot = context.get();
          if (!snapshot) throw new Error('This Action registration is no longer active.');
          return snapshot.state as Readonly<State>;
        };
        const instance: ActionInstance<State> = Object.freeze({
          app: context.app,
          services: context.services,
          config: context.config,
          state: Object.freeze({
            get: read,
            update: (change: (current: Readonly<State>) => State) => {
              if (!context.get()) return false;
              return context.update({ state: Object.freeze(change(read())) });
            },
          }),
        });
        return execute.call(instance, context.input);
      },
    };
    return adapted;
  };
}
