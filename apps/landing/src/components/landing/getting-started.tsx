import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@bitakit/ui/components';

const steps = [
  {
    title: 'Create your app',
    command: 'npm create @bitakit/app@latest my-app',
    note: 'Your framework, ready to build on.',
  },
  {
    title: 'Add a feature',
    command: 'npx bitakit add plugin reports',
    note: 'Run inside my-app. Your plugin gets its own folder.',
  },
  {
    title: 'Check the connections',
    command: 'npx bitakit doctor',
    note: 'Check services, dependencies and configuration.',
  },
];

/** Actual CLI commands; the quickstart documents the complete setup. */
export function GettingStarted() {
  return (
    <Card className="getting-started-card">
      <CardHeader>
        <CardTitle>A real app. Your first feature.</CardTitle>
        <CardDescription>Create it. Extend it. Check the connections.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="start-steps">
          {steps.map((step) => (
            <li key={step.command}>
              <div className="start-step-marker" aria-hidden="true"></div>
              <div>
                <h3>{step.title}</h3>
                <pre>
                  <code>{step.command}</code>
                </pre>
                <p>{step.note}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
