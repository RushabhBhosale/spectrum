import type { Metadata } from 'next';
import Studio from '@/components/Studio';
import StudioLogin from '@/components/StudioLogin';
import { readStore } from '@/lib/store';
import { isSignedIn } from './actions';

export const metadata: Metadata = { title: 'Studio', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  if (!(await isSignedIn())) return <StudioLogin ready={Boolean(process.env.ADMIN_PASSWORD)} />;
  const { titles } = await readStore();
  return <Studio titles={titles} />;
}
