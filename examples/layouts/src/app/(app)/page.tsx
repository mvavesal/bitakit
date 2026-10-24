'use client';
import { PageHeader } from '@bitakit/ui/components';

const pages = [
  ['/account/login', 'Sign in: the auth family with the app’s split layout'],
  ['/welcome', 'Welcome: a new onboarding family'],
  ['/lab', 'Landing: the full-page family'],
  ['/lab/crash', 'Error screen: the app’s own screen.error'],
  ['/nowhere', 'Unknown page: the app’s own screen.not-found'],
];

export default function Home() {
  return (
    <>
      <PageHeader title="Layouts example" subtitle="Each link opens a page in another frame." />
      <ul className="flex flex-col gap-2">
        {pages.map(([href, label]) => (
          <li key={href}>
            <a className="underline" href={href}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
