import { CourseStudio } from './course-studio';

export const metadata = { title: 'Course studio · SaaS Foundation' };

// Public, browser-only sample. Protected account routes retain their session checks.
export default function AppPreviewPage() {
  return <CourseStudio />;
}
