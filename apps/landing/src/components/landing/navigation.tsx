'use client';

import { useTheme } from 'next-themes';
import MenuIcon from 'reicon-react/icons/Menu';
import SunIcon from 'reicon-react/icons/Sun';
import MoonIcon from 'reicon-react/icons/Moon';
import ArrowRightIcon from 'reicon-react/icons/ArrowRight';
import CodeIcon from 'reicon-react/icons/Code';
import PuzzleIcon from 'reicon-react/icons/Puzzle';
import BoltIcon from 'reicon-react/icons/Bolt';
import BookOpenIcon from 'reicon-react/icons/BookOpen';
import {
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@bitakit/ui/components';
import { Navbar, NavItems } from '@/components/ui/resizable-navbar';
import { links } from './links';
import { Logo } from './logo';

const items = [
  { name: 'Playground', link: '#playground', icon: CodeIcon },
  { name: 'How it works', link: '#how', icon: PuzzleIcon },
  { name: 'Why BitaKit', link: '#why', icon: BoltIcon },
  { name: 'Docs', link: links.docs, icon: BookOpenIcon },
];

function ColorMode() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle color scheme"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <SunIcon aria-hidden="true" className="hidden dark:block" />
      <MoonIcon aria-hidden="true" className="dark:hidden" />
    </Button>
  );
}

export function Navigation() {
  return (
    <Navbar>
      <a href="#top" aria-label="BitaKit home" className="site-brand">
        <Logo />
      </a>
      <NavItems items={items} />
      <div className="flex items-center gap-2">
        <ColorMode />
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <a href={links.quickstart}>
            Get started <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          </a>
        </Button>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              aria-label="Open navigation"
              className="lg:hidden"
            >
              <MenuIcon aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>
                <Logo />
              </SheetTitle>
              <SheetDescription>Build your app, one plugin at a time.</SheetDescription>
            </SheetHeader>
            <nav aria-label="Mobile" className="flex flex-col gap-2 px-4">
              {items.map((item) => (
                <SheetClose asChild key={item.link}>
                  <Button asChild variant="ghost" className="justify-start">
                    <a href={item.link}>
                      <item.icon aria-hidden="true" data-icon="inline-start" />
                      {item.name}
                    </a>
                  </Button>
                </SheetClose>
              ))}
              <SheetClose asChild>
                <Button asChild>
                  <a href={links.quickstart}>
                    Get started <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                  </a>
                </Button>
              </SheetClose>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </Navbar>
  );
}
