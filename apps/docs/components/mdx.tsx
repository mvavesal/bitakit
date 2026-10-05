import {
  SettingsIllustration,
  SlotIllustration,
  ExtensionIllustration,
  EventIllustration,
  InterceptorIllustration,
  IntroductionIllustration,
} from './illustrations';
import { Diagram, ArchitectureIllustration } from './diagrams';
import { Callout } from 'fumadocs-ui/components/callout';
import { Card, Cards } from 'fumadocs-ui/components/card';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Callout,
    Diagram,
    ArchitectureIllustration,
    SettingsIllustration,
    SlotIllustration,
    ExtensionIllustration,
    EventIllustration,
    InterceptorIllustration,
    IntroductionIllustration,
    Card,
    Cards,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
