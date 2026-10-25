import ArrowRightIcon from 'reicon-react/icons/ArrowRight';
import ArrowUpRightIcon from 'reicon-react/icons/ArrowUpRight';
import FolderIcon from 'reicon-react/icons/Folder';
import CodeIcon from 'reicon-react/icons/Code';
import CheckIcon from 'reicon-react/icons/Check';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from '@bitakit/ui/components';
import measurements from '../../../../docs/components/diagrams/measurements.json';
import { loadPluginCode } from '@/components/landing/code-files';
import { CreateCommand } from '@/components/landing/create-command';
import { Foundation } from '@/components/landing/foundation';
import { GettingStarted } from '@/components/landing/getting-started';
import { Navigation } from '@/components/landing/navigation';
import { RevealSection } from '@/components/landing/reveal-section';
import { links } from '@/components/landing/links';
import { Logo } from '@/components/landing/logo';
import { Playground } from '@/components/landing/playground';
import { StatRanking } from '@/components/landing/stat-ranking';

const { comparison, growth } = measurements;
const last = growth.rows.at(-1)!;
const stats = [
  {
    value: `${Math.round(comparison.usual.code / comparison.bitakit.code)}×`,
    label: 'less app code',
    note: 'Measured in the Todo comparison',
  },
  {
    value: `${Math.round(last.usual / last.bitakit)}×`,
    label: 'fewer agent tokens',
    note: 'Estimated for the 50th feature',
  },
  { value: '1', label: 'folder per feature', note: 'A predictable place for every change' },
];

export default async function Landing() {
  const code = await loadPluginCode();
  const pipeline = code.find((plugin) => plugin.id === 'pipeline');
  const action = pipeline?.files.find((file) => file.path === 'actions/win.ts');
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Navigation />
      <main id="main">
        <section id="top" className="hero-section" aria-labelledby="hero-title">
          <div className="hero-atmosphere" aria-hidden="true" />
          <div className="site-container hero-content">
            <div className="hero-intro">
              <div className="hero-eyebrow">
                <span className="eyebrow">For humans & AI agents</span>
              </div>
              <h1 id="hero-title">
                Build ambitious apps.
                <br />
                <span>Limitless by design.</span>
              </h1>
              <ul className="flex list-inside list-disc flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-6">
                <li>Open source. MIT licensed.</li>
                <li>Fully type-safe.</li>
                <li>AI-friendly by design.</li>
              </ul>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href={links.quickstart}>
                    Start building <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#playground-app">Try it live</a>
                </Button>
              </div>
            </div>
            <section
              id="playground"
              className="playground-section"
              aria-labelledby="playground-title"
            >
              <div className="playground-heading">
                <span
                  className="relative inline-flex size-3 items-center justify-center"
                  role="img"
                  aria-label="Live interactive demo"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -inset-0.5 rounded-full border border-emerald-400/70 bg-emerald-400/40 motion-safe:animate-ping motion-reduce:hidden"
                    style={{ animationDuration: '2s' }}
                  />
                  <span
                    aria-hidden="true"
                    className="relative size-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse"
                  />
                </span>
                <h2 id="playground-title">Try it yourself</h2>
              </div>
              <Playground code={code} />
            </section>
          </div>
        </section>

        <div className="site-container">
          <RevealSection
            id="how"
            className="site-section anatomy-section"
            aria-labelledby="how-title"
          >
            <div className="section-copy">
              <p className="eyebrow">One feature. One folder.</p>
              <h2 id="how-title">
                Your next idea.
                <br />
                One plugin away.
              </h2>
              <p className="section-description">
                Give each feature a home. Extend the app without untangling the rest.
              </p>
              <ul className="benefit-list">
                <li>
                  <CheckIcon aria-hidden="true" />
                  <span>
                    <strong>Define it once.</strong> Use one Action in buttons, menus and shortcuts.
                  </span>
                </li>
                <li>
                  <CheckIcon aria-hidden="true" />
                  <span>
                    <strong>Connect it.</strong> Fill a slot. React to an event.
                  </span>
                </li>
                <li>
                  <CheckIcon aria-hidden="true" />
                  <span>
                    <strong>Find it.</strong> Predictable paths for you and your agent.
                  </span>
                </li>
              </ul>
              <Button asChild variant="link" className="self-start">
                <a href={links.agents}>
                  See how it works <ArrowUpRightIcon aria-hidden="true" data-icon="inline-end" />
                </a>
              </Button>
            </div>
            <Card className="source-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderIcon aria-hidden="true" className="size-4" /> src/plugins/pipeline
                </CardTitle>
                <CardDescription>From the live app above.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="file-map">
                  <div>
                    <FolderIcon aria-hidden="true" />
                    <code>actions/</code>
                    <span>What it does</span>
                  </div>
                  <div>
                    <FolderIcon aria-hidden="true" />
                    <code>services/</code>
                    <span>What it knows</span>
                  </div>
                  <div>
                    <CodeIcon aria-hidden="true" />
                    <code>events.ts</code>
                    <span>How it connects</span>
                  </div>
                  <div>
                    <CodeIcon aria-hidden="true" />
                    <code>data/</code>
                    <span>Where it starts</span>
                  </div>
                  <div>
                    <FolderIcon aria-hidden="true" />
                    <code>ui/</code>
                    <span>What you see</span>
                  </div>
                </div>
                {action && (
                  <div className="source-example">
                    <div className="source-label">
                      <code>actions/win.ts</code>
                      <Badge variant="secondary">Real source</Badge>
                    </div>
                    <div className="code-view" dangerouslySetInnerHTML={{ __html: action.html }} />
                  </div>
                )}
              </CardContent>
            </Card>
          </RevealSection>

          <RevealSection
            id="foundation"
            className="site-section"
            aria-labelledby="foundation-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Included from the start</p>
                <h2 id="foundation-title">
                  Skip the glue.
                  <br />
                  Ship your ideas.
                </h2>
              </div>
              <p className="section-description">
                Actions, settings, themes and search. Ready to work together.
              </p>
            </div>
            <Foundation />
            <div className="framework-note">
              <span className="eyebrow">Fits your stack</span>
              <p>Your framework underneath. Your features on top.</p>
              <a href={links.docs}>
                See the architecture <ArrowUpRightIcon aria-hidden="true" />
              </a>
            </div>
          </RevealSection>

          <RevealSection
            id="why"
            className="site-section evidence-section"
            aria-labelledby="why-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Less to write. Less to read.</p>
                <h2 id="why-title">
                  Built for you.
                  <br />
                  And your agents.
                </h2>
              </div>
              <div className="section-copy">
                <p className="section-description">
                  Less code for you. Less context for your agent.
                </p>
                <a className="text-link" href={links.why}>
                  See the measurements <ArrowUpRightIcon aria-hidden="true" />
                </a>
              </div>
            </div>
            <StatRanking stats={stats} />
          </RevealSection>

          <RevealSection
            id="start"
            className="site-section start-section"
            aria-labelledby="start-title"
          >
            <div className="section-copy">
              <p className="eyebrow">From idea to your first feature</p>
              <h2 id="start-title">
                Your next app
                <br />
                starts here.
              </h2>
              <p className="section-description">
                One command to create your app. Your plugins take it from there.
              </p>
              <CreateCommand />
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href={links.quickstart}>
                    Read the quickstart <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <a href={links.samples}>Explore sample apps</a>
                </Button>
              </div>
            </div>
            <GettingStarted />
          </RevealSection>
        </div>
      </main>
      <footer className="site-container site-footer">
        <Separator />
        <div className="footer-main">
          <div className="section-copy">
            <a href="#top" aria-label="BitaKit home">
              <Logo />
            </a>
            <p>
              A place for every feature.
              <br />A shared language for humans and agents.
            </p>
          </div>
          <nav aria-label="Footer">
            <a href={links.docs}>Documentation</a>
            <a href={links.samples}>Sample apps</a>
            <a href={links.research}>Goals & research</a>
            <a href={links.github}>
              GitHub <ArrowUpRightIcon aria-hidden="true" />
            </a>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>Open source. Built to be extended.</span>
          <a href="#top">Back to top ↑</a>
        </div>
      </footer>
    </>
  );
}
