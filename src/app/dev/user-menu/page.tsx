import { notFound } from 'next/navigation';
import { UserMenuPreview } from './preview';

export default async function Page({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <UserMenuPreview guest={(await searchParams).guest === '1'} />;
}
