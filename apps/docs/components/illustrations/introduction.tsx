'use client';
import { useId, useState } from 'react';
import Link from 'next/link';
import Plus from 'reicon-react/icons/Plus';
import Eye from 'reicon-react/icons/Eye';
import Code from 'reicon-react/icons/Code';
import Note from 'reicon-react/icons/Note';
import Grid from 'reicon-react/icons/Grid';
import Settings from 'reicon-react/icons/Settings';
import Check from 'reicon-react/icons/Check';
import ChevronRight from 'reicon-react/icons/ChevronRight';
import SidebarLeft from 'reicon-react/icons/SidebarLeft';
import { Tabs } from 'fumadocs-ui/components/ui/tabs';
import { TabsList, TabsTrigger, TabsContent } from 'fumadocs-ui/components/tabs';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from 'fumadocs-ui/components/ui/popover';
import { Frame, Explanation, AppPreviewWindow, targetStyle } from './shared';
import {
  introductionExamples,
  introductionGroups,
  introductionSteps,
  type IntroductionKey,
} from './introduction-examples';

export function IntroductionIllustration() {
  const [group, setGroup] = useState<(typeof introductionGroups)[number]>('Build a feature');
  const [added, setAdded] = useState<IntroductionKey[]>(['feature']);
  const [selected, setSelected] = useState<IntroductionKey>('feature');
  const [view, setView] = useState('preview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sourceReveal, setSourceReveal] = useState(0);
  const previewId = useId();
  const detailsId = useId();
  const current = introductionExamples.find((item) => item.key === selected)!;
  const step = introductionSteps.find((item) => item.group === group)!;
  const has = (key: IntroductionKey) => added.includes(key);
  function choose(key: IntroductionKey, fromFileTree = false) {
    setSelected(key);
    setGroup(introductionExamples.find((item) => item.key === key)!.group);
    setMenuOpen(false);
    // Step/preview selections reveal their path; file clicks retain open folders and focus.
    if (!fromFileTree) setSourceReveal((version) => version + 1);
  }
  function add(key: IntroductionKey, fromFileTree = false) {
    // Browsing a file also reveals the small prerequisites needed by its preview.
    const prerequisites: Partial<Record<IntroductionKey, IntroductionKey[]>> = {
      navigation: ['page'],
      toolbar: ['service'],
      outlet: ['slot'],
      widget: ['slot', 'outlet'],
      emit: ['service', 'toolbar', 'event'],
      events: ['event'],
    };
    setAdded((items) => [...new Set([...items, ...(prerequisites[key] ?? []), key])]);
    choose(key, fromFileTree);
  }
  function reset() {
    setView('preview');
    setAdded(['feature']);
    setSelected('feature');
    setGroup('Build a feature');
    setMenuOpen(false);
    setSourceReveal((version) => version + 1);
  }
  const sourceButton = (key: IntroductionKey, label: string) => (
    <button
      type="button"
      className={
        key === 'toolbar'
          ? buttonVariants({ color: 'primary' })
          : key === 'navigation' || key === 'settings'
            ? `${buttonVariants({ color: selected === key ? 'secondary' : 'ghost', size: 'sm' })} w-full`
            : targetStyle(selected === key, ['toolbar', 'member'].includes(key))
      }
      aria-label={
        key === 'navigation'
          ? 'Open Notes preview'
          : `Inspect ${key === 'settings' ? 'Notes settings' : label} example`
      }
      aria-pressed={selected === key}
      aria-controls={previewId}
      onClick={() => choose(key)}
    >
      <span className="flex w-full items-center justify-between gap-2">
        {['toolbar', 'navigation', 'settings'].includes(key) ? (
          <span className="inline-flex items-center gap-2">
            {key === 'toolbar' ? (
              <Plus aria-hidden="true" className="size-4" />
            ) : (
              <Note aria-hidden="true" className="size-4" />
            )}
            {label}
          </span>
        ) : (
          label
        )}
        {(key === 'navigation' || key === 'settings') && (
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fd-muted-foreground" />
        )}
      </span>
    </button>
  );

  return (
    <Frame
      label="Build an app piece by piece"
      caption="Illustrative app with Shell, App Preferences and Organizations. Examples do not execute here. Additions stay until Reset; dashed areas mark slots. Fields, writing area, window dots and sidebar icon are decorative."
    >
      <div className="space-y-3">
        <h3 className="font-semibold">Explore in three steps</h3>
        <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Learning steps">
          {introductionSteps.map((item, index) => (
            <button
              key={item.group}
              type="button"
              aria-pressed={group === item.group}
              aria-controls={`${previewId} ${detailsId}`}
              className={`${buttonVariants({ color: group === item.group ? 'secondary' : 'outline' })} h-auto justify-start whitespace-normal p-3 text-start`}
              onClick={() => add(item.first)}
            >
              <span className="flex items-start gap-3">
                <span className="font-semibold tabular-nums">{index + 1}.</span>
                <span className="space-y-1">
                  <span className="block font-semibold">{item.group}</span>
                  <span className="block text-xs font-normal text-fd-muted-foreground">
                    {item.summary}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">
            Examples for step {introductionSteps.indexOf(step) + 1}
          </h4>
          <p className="text-sm text-fd-muted-foreground">{step.description}</p>
          <p className="text-xs text-fd-muted-foreground">
            Plus adds a piece. A check means it is already added; select it again to inspect it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={group}>
          {introductionExamples
            .filter((item) => item.group === group)
            .map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={selected === item.key}
                aria-controls={`${previewId} ${detailsId}`}
                disabled={
                  (item.key === 'navigation' && !has('page') && !has('outlet')) ||
                  (item.key === 'toolbar' && !has('service')) ||
                  (item.key === 'outlet' && !has('slot')) ||
                  (item.key === 'widget' && !has('outlet')) ||
                  (['emit', 'events'].includes(item.key) && !has('event')) ||
                  (item.key === 'emit' && !has('toolbar'))
                }
                className={`${buttonVariants({
                  color: has(item.key) ? 'primary' : 'outline',
                  size: 'sm',
                })} ${has(item.key) ? 'border-solid' : 'border-dashed border-fd-border text-fd-muted-foreground'}`}
                onClick={() => add(item.key)}
              >
                {has(item.key) ? (
                  <Check aria-hidden="true" className="size-3.5 shrink-0" />
                ) : (
                  <Plus aria-hidden="true" className="size-3.5 shrink-0" />
                )}
                {item.label}
                <span className="sr-only">{has(item.key) ? ' — added' : ' — not added yet'}</span>
              </button>
            ))}
          <button
            type="button"
            className={buttonVariants({ color: 'ghost', size: 'sm' })}
            disabled={added.length === 1 && selected === 'feature'}
            onClick={reset}
          >
            Reset preview
          </button>
        </div>
      </div>
      <Tabs value={view} onValueChange={setView} className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">{current.label}</p>
          <TabsList
            aria-label="Example view"
            className="gap-1 rounded-lg border border-fd-border bg-fd-muted p-1"
          >
            <TabsTrigger
              value="preview"
              className="rounded-md border-0 px-3 data-[active]:bg-fd-primary data-[active]:text-fd-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring"
            >
              <Eye aria-hidden="true" />
              Preview
            </TabsTrigger>
            <TabsTrigger
              value="code"
              className="rounded-md border-0 px-3 data-[active]:bg-fd-primary data-[active]:text-fd-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring"
            >
              <Code aria-hidden="true" />
              Code
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="preview" className="space-y-3 p-0">
          <p role="status" className="text-sm text-fd-muted-foreground">
            {current.result}
          </p>
          <AppPreviewWindow id={previewId}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-fd-border p-3">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <span
                  className="rounded-md bg-fd-primary p-1.5 text-fd-primary-foreground"
                  aria-hidden="true"
                >
                  <Grid className="size-4" />
                </span>
                Workspace
              </span>
              {has('toolbar') ? (
                <div>{sourceButton('toolbar', 'Add note')}</div>
              ) : (
                <span className="text-sm text-fd-muted-foreground">Header toolbar</span>
              )}
            </div>
            <div className="grid min-w-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
              <div className="flex min-w-0 flex-col gap-3 border-b border-fd-border bg-fd-muted/50 p-3 sm:border-e sm:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">App sidebar</p>
                  <span aria-hidden="true" className="rounded-md p-1 text-fd-muted-foreground">
                    <SidebarLeft className="size-4" />
                  </span>
                </div>
                <div className="space-y-2 rounded-lg border border-dashed border-fd-border p-2">
                  {has('navigation') ? (
                    sourceButton('navigation', 'Notes')
                  ) : (
                    <p className="p-2 text-sm text-fd-muted-foreground">No Notes link yet</p>
                  )}
                  <p className="break-all px-2 text-xs text-fd-muted-foreground">
                    <code>shell.navigation</code>
                  </p>
                </div>
              </div>
              <div
                className={
                  selected === 'settings'
                    ? 'min-w-0 bg-fd-background'
                    : 'min-h-80 min-w-0 space-y-4 p-4 sm:min-h-96'
                }
              >
                {selected === 'settings' ? (
                  <section aria-label="Notes settings page">
                    <div className="flex items-center gap-2 border-b border-fd-border p-4">
                      <Settings aria-hidden="true" className="size-4 text-fd-muted-foreground" />
                      <p className="font-medium">Settings</p>
                    </div>
                    <div className="grid min-w-0 sm:min-h-80 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                      <div className="min-w-0 space-y-3 border-b border-fd-border bg-fd-muted/50 p-4 sm:border-e sm:border-b-0">
                        <p className="text-sm font-medium">Settings navigation</p>
                        {sourceButton('settings', 'Notes')}
                      </div>
                      <div className="min-w-0 space-y-6 p-4">
                        <header className="space-y-2 border-b border-fd-border pb-4">
                          <h3 className="text-lg font-semibold">Notes</h3>
                          <p className="text-sm text-fd-muted-foreground">Your note preferences.</p>
                        </header>
                        <dl className="divide-y divide-fd-border text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                            <dt>Auto-save</dt>
                            <dd className="inline-flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="rounded-md bg-fd-primary p-1 text-fd-primary-foreground"
                              >
                                <Check className="size-3" />
                              </span>
                              On
                            </dd>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                            <dt>Notes per page</dt>
                            <dd className="min-w-16 rounded-md border border-fd-border bg-fd-background px-3 py-2 text-end tabular-nums">
                              10
                            </dd>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                            <dt>Maximum note length</dt>
                            <dd className="min-w-16 rounded-md border border-fd-border bg-fd-background px-3 py-2 text-end tabular-nums">
                              2000
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                    <p className="border-t border-fd-border p-4 text-xs text-fd-muted-foreground">
                      One settings.ts file generates the navigation, page and fields. Preview only.
                    </p>
                  </section>
                ) : selected === 'member' ? (
                  <>
                    <p className="font-semibold">Organization members</p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>Alex · Member</span>
                      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                        <PopoverTrigger
                          className={buttonVariants({ color: 'outline', size: 'sm' })}
                        >
                          Member menu
                        </PopoverTrigger>
                        <PopoverContent>
                          <p className="mb-2 text-xs text-fd-muted-foreground">
                            Contributed Action
                          </p>
                          {sourceButton('member', 'Copy member ID')}
                        </PopoverContent>
                      </Popover>
                    </div>
                    <p className="text-sm text-fd-muted-foreground">
                      Open the menu. The added Action receives this member’s ID.
                    </p>
                  </>
                ) : (
                  <>
                    {has('page') || has('outlet') ? (
                      <section
                        aria-label="Notes page preview"
                        className="flex min-h-80 flex-col gap-4 sm:min-h-96"
                      >
                        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-fd-border pb-4">
                          <div className="space-y-1">
                            <h3 className="flex items-center gap-2 text-lg font-semibold">
                              <Note
                                aria-hidden="true"
                                className="size-5 text-fd-muted-foreground"
                              />
                              Notes
                            </h3>
                            <p className="text-sm text-fd-muted-foreground">
                              Your ideas, in one place.
                            </p>
                          </div>
                        </header>
                        <div
                          className="min-h-48 flex-1 space-y-3 rounded-lg border border-fd-border bg-fd-background p-4 text-sm sm:min-h-64"
                          aria-label="Illustrative note writing area"
                        >
                          <p className="font-medium">Untitled note</p>
                          <p className="text-fd-muted-foreground">Start writing your ideas here…</p>
                        </div>
                        <p className="text-xs text-fd-muted-foreground">
                          /notes · Writing area shown for context; the sample adds a title and
                          description.
                        </p>
                      </section>
                    ) : (
                      <section
                        aria-label="Notes plugin placeholder"
                        className="flex min-h-80 flex-col gap-4 sm:min-h-96"
                      >
                        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-fd-border pb-4">
                          <div className="space-y-1">
                            <h3 className="flex items-center gap-2 text-lg font-semibold">
                              <Note
                                aria-hidden="true"
                                className="size-5 text-fd-muted-foreground"
                              />
                              Notes plugin
                            </h3>
                            <p className="text-sm text-fd-muted-foreground">
                              Capture and organize workspace notes.
                            </p>
                          </div>
                        </header>
                        <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-fd-border bg-fd-background p-4 text-center text-sm sm:min-h-64">
                          <Note aria-hidden="true" className="size-8 text-fd-muted-foreground" />
                          <p className="font-medium">Your plugin page</p>
                          <p className="max-w-xs text-fd-muted-foreground">
                            Page placeholder. Add a page to give this plugin a screen.
                          </p>
                        </div>
                        <p className="text-xs text-fd-muted-foreground">
                          notes · Plugin defined; no page added yet.
                        </p>
                      </section>
                    )}
                    {selected === 'service' && (
                      <p className="text-sm text-fd-muted-foreground">
                        <code>notes.notebook</code> owns the in-memory notes. Add note calls its add
                        method.
                      </p>
                    )}
                    {has('slot') && !has('outlet') && (
                      <p className="text-sm text-fd-muted-foreground">
                        <code>notes.footer</code> is declared. Place its outlet to show content
                        here.
                      </p>
                    )}
                    {has('outlet') && (
                      <button
                        type="button"
                        className={targetStyle(
                          selected === 'outlet' || selected === 'widget',
                          true,
                        )}
                        aria-label="Inspect Notes footer example"
                        aria-controls={detailsId}
                        onClick={() => choose(has('widget') ? 'widget' : 'outlet')}
                      >
                        <span className="block font-mono text-xs">notes.footer</span>
                        <span className="mt-2 block">
                          {has('widget')
                            ? 'Keep each note focused on one idea.'
                            : 'Empty slot — another plugin can add UI here.'}
                        </span>
                        {has('widget') && (
                          <span className="mt-2 block text-xs text-fd-muted-foreground">
                            Supplied by the Tips plugin
                          </span>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            {group === 'Connect behavior' && (has('event') || has('interceptor')) && (
              <div className="space-y-2 border-t border-fd-border p-3">
                <p className="text-sm font-medium">Behind the UI · illustrative connections</p>
                {has('event') && sourceButton('event', 'Notes declares notes.changed')}
                {has('emit') && sourceButton('emit', 'Add note → notes.changed')}
                {has('events') && sourceButton('events', 'notes.changed → Activity feed')}
                {has('interceptor') && sourceButton('interceptor', 'notes.* Actions → Audit log')}
              </div>
            )}
          </AppPreviewWindow>
        </TabsContent>
        <TabsContent value="code" className="p-0">
          <Explanation
            showLabel={false}
            id={detailsId}
            region={current}
            file={current.file}
            code={current.code}
            files={introductionExamples
              .filter((item) => item.file.startsWith('src/plugins/notes/') || has(item.key))
              .map((item) => item.file)}
            sourceReveal={sourceReveal}
            onFileSelect={(file) => {
              const versions = introductionExamples.filter((item) => item.file === file);
              const example = versions.filter((item) => has(item.key)).at(-1) ?? versions[0];
              if (example) add(example.key, true);
            }}
          />
        </TabsContent>
      </Tabs>
      <details className="text-sm text-fd-muted-foreground">
        <summary className="cursor-pointer">How these examples build on each other</summary>
        <div className="mt-3 space-y-2">
          <p>
            Selections add pieces to the same illustrative app. Switch between Preview and Code to
            inspect the selected example; Reset starts again.
          </p>
          {group === 'Build a feature' && !has('page') && !has('outlet') && (
            <p className="text-sm text-fd-muted-foreground">
              Add a page before linking to it from navigation.
            </p>
          )}
          {group === 'Extend the UI' && !has('outlet') && (
            <p className="text-sm text-fd-muted-foreground">
              Define the slot, then place its outlet to enable the other plugin’s widget.
            </p>
          )}
          {group === 'Build a feature' && !has('service') && (
            <p className="text-sm text-fd-muted-foreground">
              Add note state before the toolbar Action; the service owns the notes it creates.
            </p>
          )}
          {group === 'Connect behavior' && !has('toolbar') && (
            <p className="text-sm text-fd-muted-foreground">
              Add note state and the toolbar Action in step 1 before extending it to emit an event.
            </p>
          )}
        </div>
      </details>
      <Link className="text-sm underline underline-offset-4" href={current.href}>
        Read more: {current.more} →
      </Link>
    </Frame>
  );
}
