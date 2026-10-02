'use client';
import { ActionButton, useService, useServiceState } from '@bitakit/ui';
import BookOpenIcon from 'reicon-react/icons/BookOpen';
import CheckIcon from 'reicon-react/icons/Check';
import ChevronRightIcon from 'reicon-react/icons/ChevronRight';
import GraduationCapIcon from 'reicon-react/icons/GraduationCap';
import { AppBar } from '@/components/layout/app-bar';
import { DrawerNavigation } from '@/components/navigation/drawer-navigation';
import { UserMenu } from '@/components/navigation/user-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { INITIAL, LESSONS, validDraft, type Draft } from '../model';

const initialState = {
  draft: INITIAL,
  saved: null,
  ready: false,
  preview: false,
  message: 'Your sample draft is ready to edit.',
  error: '',
};

/** The public course studio: the draft lives in the studio plugin's service; actions follow it. */
export function CourseStudio() {
  const studio = useService('studio.draft');
  const { draft, saved, ready, preview, message, error } = useServiceState(
    'studio.draft',
    (state) => state,
    initialState,
  );
  const dirty = !saved || draft.title !== saved.title || draft.objective !== saved.objective;
  const valid = validDraft(draft);
  const edit = (field: keyof Draft, value: string) => studio?.edit(field, value);

  return (
    <SidebarProvider>
      <a
        href="#studio-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:bg-background focus:p-3"
      >
        Skip to course
      </a>
      <Sidebar>
        <SidebarHeader className="min-h-14 justify-center px-4 py-2">
          <div className="flex items-center gap-3">
            <div
              data-corner="theme"
              className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"
            >
              <GraduationCapIcon className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold">Course studio</p>
              <p className="text-xs text-muted-foreground">SaaS Foundation</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="py-2">
          <DrawerNavigation />
        </SidebarContent>
        <SidebarFooter className="gap-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline">Local preview</Badge>
            <UserMenu />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            One sample course. Saved only in this browser, with no account or cloud sync.
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <AppBar>
          <span className="text-muted-foreground">Workspace</span>
          <ChevronRightIcon className="size-3 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">Course studio</span>
        </AppBar>
        <main
          id="studio-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-7 p-4 md:p-8 lg:p-10"
        >
          <div
            className="flex flex-wrap items-center justify-end gap-2"
            role="group"
            aria-label="Header actions"
          >
            <ActionButton as={Button} action="studio.preview" variant="outline" />
            <ActionButton as={Button} action="studio.save" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Sample course</Badge>
              <span className="text-xs text-muted-foreground">3 lessons · 15 minutes</span>
            </div>
            <h1 className="break-words text-3xl font-semibold tracking-tight md:text-4xl">
              {preview ? draft.title || 'Untitled course' : 'Make a great first impression.'}
            </h1>
            <p className="max-w-2xl break-words text-sm leading-relaxed text-muted-foreground">
              {preview
                ? draft.objective
                : 'Shape a welcoming first week. Edit your course details, preview the lessons, and keep a copy of your draft.'}
            </p>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Draft needs attention</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-w-0 flex-col gap-6">
              {preview ? (
                <section aria-label="Course preview" className="flex flex-col gap-5">
                  {LESSONS.map((lesson, index) => (
                    <Card key={lesson.id}>
                      <CardHeader>
                        <CardDescription>
                          Lesson {index + 1} · {lesson.minutes} min
                        </CardDescription>
                        <CardTitle>
                          <h2>{lesson.title}</h2>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="leading-relaxed">{lesson.body}</p>
                      </CardContent>
                    </Card>
                  ))}
                </section>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <h2>Course details</h2>
                      </CardTitle>
                      <CardDescription>Give learners a clear starting point.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FieldGroup>
                        <Field data-invalid={!draft.title.trim()}>
                          <FieldLabel htmlFor="course-title">Course title</FieldLabel>
                          <Input
                            id="course-title"
                            value={draft.title}
                            disabled={!ready}
                            maxLength={120}
                            aria-invalid={!draft.title.trim()}
                            onChange={(e) => edit('title', e.target.value)}
                          />
                        </Field>
                        <Field data-invalid={!draft.objective.trim()}>
                          <FieldLabel htmlFor="course-objective">Learning goal</FieldLabel>
                          <Input
                            id="course-objective"
                            value={draft.objective}
                            disabled={!ready}
                            maxLength={300}
                            aria-invalid={!draft.objective.trim()}
                            onChange={(e) => edit('objective', e.target.value)}
                          />
                          <FieldDescription>
                            What should someone be able to do after this course?
                          </FieldDescription>
                        </Field>
                      </FieldGroup>
                    </CardContent>
                    <CardFooter className="flex-wrap justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {!valid
                          ? 'Both fields are required.'
                          : dirty
                            ? 'Changes are not saved yet.'
                            : 'All changes saved in this browser.'}
                      </p>
                      <ActionButton as={Button} action="studio.save" />
                    </CardFooter>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <h2>Course outline</h2>
                      </CardTitle>
                      <CardDescription>
                        Three example lessons to explore in preview.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ol className="flex flex-col gap-5">
                        {LESSONS.map((lesson, index) => (
                          <li key={lesson.id} className="flex items-center gap-4">
                            <span
                              data-corner="theme"
                              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted font-mono text-sm text-muted-foreground"
                            >
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{lesson.title}</p>
                              <p className="text-xs text-muted-foreground">
                                Reading · {lesson.minutes} min
                              </p>
                            </div>
                            <BookOpenIcon
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                    <CardFooter>
                      <ActionButton as={Button} action="studio.preview" variant="outline" />
                    </CardFooter>
                  </Card>
                </>
              )}
            </div>
            <aside className="flex flex-col gap-5" aria-label="Draft tools">
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>Your draft</h2>
                  </CardTitle>
                  <CardDescription>
                    {dirty ? 'Unsaved changes' : 'Saved in this browser'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Check the learner view, then download an editable copy to keep or share.
                  </p>
                  <ActionButton
                    as={Button}
                    action="studio.preview"
                    variant="outline"
                    className="w-full"
                  />
                  <ActionButton
                    as={Button}
                    action="studio.download"
                    variant="secondary"
                    className="w-full"
                  />
                </CardContent>
                <CardFooter>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    JSON sample format. LMS export and publishing are not connected yet.
                  </p>
                </CardFooter>
              </Card>
              <p
                role="status"
                className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
              >
                <CheckIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                {message}
              </p>
            </aside>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
