import { safeHref } from './navigation.js';
import { brand } from './brand.js';
import type { Feedback } from './feedback.js';
import type {
  ActionContext,
  ActionShortcut,
  ActionDefinition,
  ActionIcon,
  ActionPresentation,
} from './types.js';

/** Context handed to the `success` feedback of a class-based action. */
export type ActionOutcome<Input, Result> = { result: Result; input: Input };
/** Context handed to the `failure` feedback of a class-based action. */
export type ActionError<Input> = { error: unknown; input: Input };

export type ActionOptions<Input, Result = unknown> = Omit<
  ActionDefinition,
  'id' | 'execute' | 'resolve' | 'shortcut'
> & {
  id?: string;
  shortcut?: ActionShortcut<Input>;
  value?: Input;
  execute?: (input: Input, context?: ActionContext<Input>) => Result | Promise<Result>;
  /** Optional outcome feedback, resolved and displayed by the foundation runtime. */
  success?: Feedback<ActionOutcome<Input, Result>>;
  failure?: Feedback<ActionError<Input>>;
};

/** Reusable behavior and observable presentation state. No registration or UI. */
export class Action<Input = void, Result = unknown> {
  static {
    brand(this, 'action');
  }
  readonly id?: string;
  /**
   * Opt-in feedback for runtime-registered class actions. Undefined keeps the raw error for the
   * caller and shows no success message, matching direct ActionList usage.
   */
  success?: Feedback<ActionOutcome<Input, Result>>;
  failure?: Feedback<ActionError<Input>>;
  private navigator?: (href: string) => void;
  private state: Omit<ActionOptions<Input, Result>, 'execute' | 'success' | 'failure'>;
  private listeners = new Set<() => void>();
  private handler?: ActionOptions<Input, Result>['execute'];

  constructor(options: ActionOptions<Input, Result> = { title: '' }) {
    const { execute, success, failure, ...state } = options;
    this.id = options.id;
    this.state = { enabled: true, visible: true, ...state };
    this.handler = execute;
    this.success = success;
    this.failure = failure;
  }

  /** The list supplies the invocation context; subclasses may ignore it. */
  execute(input: Input, context?: ActionContext<Input>): unknown {
    return this.handler?.(input, context);
  }
  isEnabled(_input: Input): boolean {
    return true;
  }
  isVisible(_input: Input): boolean {
    return true;
  }
  /** Derived per invocation; never written into shared class state. */
  getPresentation(_input: Input): ActionPresentation {
    return {};
  }
  resolve(input: Input): ActionPresentation {
    return {
      ...this.getPresentation(input),
      enabled: this.isEnabled(input),
      visible: this.isVisible(input),
    };
  }
  get shortcut() {
    return this.state.shortcut;
  }
  set shortcut(value: ActionShortcut<Input> | undefined) {
    this.set('shortcut', value);
  }
  get tooltip() {
    return this.state.tooltip;
  }
  set tooltip(value: string | undefined) {
    this.set('tooltip', value);
  }
  /** Supplied once by the provider; subclasses use the same navigation service. */
  bindNavigation(navigate: (href: string) => void) {
    this.navigator = navigate;
  }
  protected navigate(href: string) {
    if (!safeHref(href)) throw new Error('Invalid navigation target.');
    if (this.navigator) this.navigator(href);
    else throw new Error('Navigation requires a mounted provider.');
  }
  /** Optional external-state subscription, owned by the mounted list. */
  connect(): void | (() => void) {}
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private set<K extends keyof typeof this.state>(key: K, value: (typeof this.state)[K]) {
    if (Object.is(this.state[key], value)) return;
    this.state = { ...this.state, [key]: value };
    this.listeners.forEach((listener) => listener());
  }
  get title() {
    return this.state.title;
  }
  set title(value: string) {
    this.set('title', value);
  }
  get description() {
    return this.state.description;
  }
  set description(value: string | undefined) {
    this.set('description', value);
  }
  get icon() {
    return this.state.icon;
  }
  set icon(value: ActionIcon | undefined) {
    this.set('icon', value);
  }
  get href() {
    return this.state.href;
  }
  set href(value: string | undefined) {
    this.set('href', value);
  }
  get enabled() {
    return this.state.enabled ?? true;
  }
  set enabled(value: boolean) {
    this.set('enabled', value);
  }
  get visible() {
    return this.state.visible ?? true;
  }
  get dependsOn() {
    return this.state.dependsOn;
  }
  set dependsOn(value: readonly string[] | undefined) {
    this.set('dependsOn', value);
  }
  set visible(value: boolean) {
    this.set('visible', value);
  }
  get checked() {
    return this.state.checked;
  }
  set checked(value: boolean | undefined) {
    this.set('checked', value);
  }
  get value() {
    return this.state.value;
  }
  set value(value: Input | undefined) {
    this.set('value', value);
  }
  get metadata() {
    return this.state.metadata;
  }
  set metadata(value: unknown) {
    this.set('metadata', value);
  }
  snapshot() {
    return { ...this.state };
  }
}
