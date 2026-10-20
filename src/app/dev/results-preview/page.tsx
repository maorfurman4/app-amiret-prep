import { notFound } from 'next/navigation';
import { ResultsPreview } from './preview';

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <ResultsPreview />;
}
