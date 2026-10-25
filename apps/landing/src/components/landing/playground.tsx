'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import SettingsIcon from 'reicon-react/icons/Settings';
import ArrowUpRightIcon from 'reicon-react/icons/ArrowUpRight';
import { Button } from '@bitakit/ui/components';
import type { PlaygroundCommand, PlaygroundState } from '@/playground/protocol';
import type { PluginCode } from './code-files';
import { CodeView } from './code-view';
import { Inspector } from '@/components/playground/inspector';
import { ContainerScroll } from '@/components/ui/container-scroll-animation';
import { TopicTabs } from './tour';
import { topics, type Topic } from '@/components/playground/topics';
import { MacWindow } from './window';

/**
 * The live playground: topic tabs, the controls of the selected topic, and a window with a
 * real BitaKit app (or the code of its plugins). The app runs in a same-origin frame; messages
 * are accepted only from that frame.
 */
export function Playground({ code }: { code: PluginCode[] }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const customize = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<PlaygroundState | null>(null);
  const [plugin, setPlugin] = useState('revenue');
  const [selectedTopic, setTopic] = useState<Topic['id']>('plugins');
  const topic = topics.find((entry) => entry.id === selectedTopic)?.id ?? 'plugins';
  const showingCode = topic === 'code';
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  const send = useCallback((command: PlaygroundCommand) => {
    frame.current?.contentWindow?.postMessage(command, window.location.origin);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.type !== 'bitakit:state') return;
      setState(event.data as PlaygroundState);
    };
    window.addEventListener('message', onMessage);
    send({ type: 'bitakit:hello' });
    return () => window.removeEventListener('message', onMessage);
  }, [send]);

  const selectTopic = (id: Topic['id']) => {
    setTopic(id);
    setOpen(true);
    const app = document.getElementById('playground-app');
    if (app && app.getBoundingClientRect().top > 160)
      app.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
    // Plugin toggles show their effect on the dashboard's widgets.
    if (id === 'plugins') send({ type: 'bitakit:navigate', href: '/dashboard' });
  };

  return (
    <div className="playground-shell">
      <ContainerScroll
        titleComponent={
          <div className="playground-toolbar">
            <TopicTabs active={topic} expanded={open} onChange={selectTopic} />
            <Button asChild variant="ghost" size="sm">
              <a href="/dashboard">
                View live <ArrowUpRightIcon aria-hidden="true" data-icon="inline-end" />
              </a>
            </Button>
          </div>
        }
      >
        <div className="playground-workspace" data-inspector={open || undefined}>
          <div className="playground-app">
            <MacWindow
              title={
                showingCode ? `src/plugins/${plugin}` : `playground${state?.path ?? '/dashboard'}`
              }
              action={
                <Button
                  ref={customize}
                  size="xs"
                  variant={open ? 'default' : 'outline'}
                  aria-expanded={open}
                  aria-controls="playground-inspector"
                  onClick={() => setOpen(!open)}
                >
                  <SettingsIcon aria-hidden="true" data-icon="inline-start" /> Customize
                </Button>
              }
            >
              {/* Keep the app mounted while its actual source is shown. */}
              <iframe
                ref={frame}
                src="/dashboard"
                onLoad={() => send({ type: 'bitakit:hello' })}
                title="A live BitaKit app"
                className={showingCode ? 'hidden' : 'app-frame'}
              />
              {showingCode && (
                <div className="app-frame">
                  <CodeView code={code} plugin={plugin} />
                </div>
              )}
            </MacWindow>
          </div>
          <motion.aside
            role="tabpanel"
            aria-labelledby={`playground-tab-${topic}`}
            id="playground-inspector"
            className="playground-inspector"
            aria-label="Customize the playground"
            hidden={!open}
            initial={false}
            animate={{ opacity: open ? 1 : 0, y: open || reduced ? 0 : 8 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          >
            {open && (
              <Inspector
                topic={topic}
                state={state}
                code={{ plugin, plugins: code.map((entry) => entry.id), onChange: setPlugin }}
                send={send}
                onClose={() => {
                  setOpen(false);
                  customize.current?.focus();
                }}
              />
            )}
          </motion.aside>
        </div>
      </ContainerScroll>
    </div>
  );
}
