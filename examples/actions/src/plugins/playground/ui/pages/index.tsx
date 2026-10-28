'use client';
import { useState, type ReactNode } from 'react';
import { Action, ActionMenu, ActionShortcutLabel, useServiceState } from '@bitakit/ui';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  FieldLabel,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
  PageHeader,
  RadioGroup,
  RadioGroupItem,
  buttonVariants,
} from '@bitakit/ui/components';
import { GroupPills, Pill, type Group } from '../groups';
import { LiveCard } from '../live-card';

/** One card per Action option: what it does, the file that shows it and the live control. */
function Example(props: {
  n: number;
  group: Group;
  title: string;
  file: string;
  children: ReactNode;
  about: string;
}) {
  return (
    <Card id={`example-${props.n}`}>
      <CardHeader>
        <div>
          <Pill n={props.n} group={props.group} />
        </div>
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{props.about}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">{props.children}</div>
      </CardContent>
      <CardFooter>
        <code className="text-xs text-muted-foreground">{props.file}</code>
      </CardFooter>
    </Card>
  );
}

const rows = ['Apple', 'Banana', 'Cherry'];

// Served at /playground. Every button below is an <Action> around a plain component: the
// label, disabled and pending state, confirmation and messages all come from the Action file.
export default function PlaygroundPage() {
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const results = useServiceState('playground.demo', (state) => state.results, []);
  const liked = useServiceState('playground.demo', (state) => state.liked, []);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Actions playground"
        subtitle="Every option of defineAction, one card each. Open the file under a card to see how."
      />
      <GroupPills />
      <div className="grid gap-4 md:grid-cols-2">
        <LiveCard />

        <Example
          n={2}
          group="basics"
          title="Run and confirm"
          file="actions/hello.ts"
          about="execute runs, success shows a message."
        >
          <Action id="playground.hello">
            <Button />
          </Action>
        </Example>

        <Example
          n={3}
          group="basics"
          title="Input with a schema"
          file="actions/greet.ts"
          about="The button stays disabled until the name has two letters."
        >
          <Input
            value={name}
            aria-label="Your name"
            placeholder="Your name"
            className="max-w-48"
            onChange={(event) => setName(event.target.value)}
          />
          <Action id="playground.greet" input={name}>
            <Button />
          </Action>
        </Example>

        <Example
          n={4}
          group="basics"
          title="A title from a service"
          file="actions/count.ts"
          about="The title reads the counter, so it changes after each click."
        >
          <Action id="playground.count">
            <Button variant="outline" />
          </Action>
        </Example>

        <Example
          n={5}
          group="basics"
          title="Visible when"
          file="actions/unlocked.ts"
          about="Hidden until the counter above reaches 3."
        >
          <Action id="playground.unlocked">
            <Button variant="secondary" />
          </Action>
        </Example>

        <Example
          n={6}
          group="running"
          title="Pending state"
          file="actions/slow.ts"
          about="A promise keeps the button busy; clicks while it runs are skipped."
        >
          <Action id="playground.slow" pending="…">
            <Button />
          </Action>
        </Example>

        <Example
          n={7}
          group="running"
          title="Asks first"
          file="actions/reset.ts"
          about="confirm opens a dialog; declining cancels the run."
        >
          <Action id="playground.reset">
            <Button variant="destructive" />
          </Action>
        </Example>

        <Example
          n={8}
          group="running"
          title="When it fails"
          file="actions/fail.ts"
          about="A throw becomes an error message worded by failure."
        >
          <Action id="playground.fail">
            <Button variant="outline" />
          </Action>
        </Example>

        <Example
          n={9}
          group="running"
          title="A dialog"
          file="actions/details.ts"
          about="dialog opens a component in the host's dialog instead of execute."
        >
          <Action id="playground.details">
            <Button variant="outline" />
          </Action>
        </Example>

        <Example
          n={10}
          group="concurrency"
          title="One state per row"
          file="actions/like.ts"
          about="per-input: each row has its own pending state and title."
        >
          <ItemGroup className="w-full">
            {rows.map((row) => (
              <Item key={row} variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>
                    {row} {liked.includes(row) && <Badge variant="secondary">Liked</Badge>}
                  </ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Action id="playground.like" input={row}>
                    <Button variant="outline" size="sm" />
                  </Action>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </Example>

        <Example
          n={11}
          group="concurrency"
          title="Only the latest run"
          file="actions/search.ts"
          about="latest: typing aborts the previous search, only the last one lands."
        >
          {/* Runs on every keystroke; the Action drops the searches that were overtaken. */}
          <Action id="playground.search" input={query}>
            {(control) => (
              <Input
                value={query}
                aria-label="Search fruit"
                placeholder="Search fruit"
                aria-busy={control.pending}
                onChange={(event) => {
                  setQuery(event.target.value);
                  void control.execute(event.target.value);
                }}
              />
            )}
          </Action>
          <p className="w-full text-sm text-muted-foreground">
            {results.length ? results.join(', ') : 'No fruit matches.'}
          </p>
        </Example>

        <Example
          n={12}
          group="controls"
          title="A toggle"
          file="actions/favorite.ts"
          about="checked reads the state; the checkbox passes the new value."
        >
          <Field orientation="horizontal">
            <Action id="playground.favorite" kind="toggle">
              <Checkbox id="favorite" />
            </Action>
            <FieldLabel htmlFor="favorite" className="font-normal">
              Favorite
            </FieldLabel>
          </Field>
        </Example>

        <Example
          n={13}
          group="controls"
          title="A choice"
          file="actions/sort.ts"
          about="value reads the selection; the radio group passes the new one."
        >
          <Action id="playground.sort" kind="choice">
            <RadioGroup aria-label="Sort by" className="flex gap-4">
              <Field orientation="horizontal" className="w-auto">
                <RadioGroupItem value="newest" id="sort-newest" />
                <FieldLabel htmlFor="sort-newest" className="font-normal">
                  Newest
                </FieldLabel>
              </Field>
              <Field orientation="horizontal" className="w-auto">
                <RadioGroupItem value="name" id="sort-name" />
                <FieldLabel htmlFor="sort-name" className="font-normal">
                  Name
                </FieldLabel>
              </Field>
            </RadioGroup>
          </Action>
        </Example>

        <Example
          n={14}
          group="controls"
          title="A keyboard shortcut"
          file="actions/shortcut.ts"
          about="Press the keys anywhere in the app; the button runs the same Action."
        >
          <Action id="playground.shortcut">
            <Button variant="outline" />
          </Action>
          <span className="text-sm text-muted-foreground">
            <ActionShortcutLabel keys="Mod+Shift+H" />
          </span>
        </Example>

        <Example
          n={15}
          group="controls"
          title="A link"
          file="actions/docs.ts"
          about="href turns the Action into a real link; it renders as an anchor."
        >
          <Action id="playground.docs">
            <a className={buttonVariants({ variant: 'link' })} />
          </Action>
        </Example>

        <Example
          n={16}
          group="controls"
          title="A group in a menu"
          file="actions/copy.ts, actions/print.ts"
          about="ActionMenu lists every Action in the playground.more group."
        >
          <ActionMenu group="playground.more" label="More" />
        </Example>
      </div>
    </div>
  );
}
