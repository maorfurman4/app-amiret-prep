import { notFound } from 'next/navigation';
import { DailyGoalPreview } from './preview';

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DailyGoalPreview />;
}
