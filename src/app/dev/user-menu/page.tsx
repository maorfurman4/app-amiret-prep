import { notFound } from 'next/navigation';
import { UserMenuPreview } from './preview';

export default async function Page({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const params = await searchParams;
  return <UserMenuPreview guest={params.guest === '1'} live={params.live === '1'} google={params.provider === 'google'} />;
}
