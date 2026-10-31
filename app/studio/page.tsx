import type { Metadata } from 'next';
import Studio from '@/components/Studio';
import StudioLogin from '@/components/StudioLogin';
import { estimateHours } from '@/lib/data';
import { readStore } from '@/lib/store';
import { entryKey } from '@/lib/types';
import { isSignedIn } from './actions';

export const metadata: Metadata = { title: 'Studio', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  if (!(await isSignedIn())) return <StudioLogin ready={Boolean(process.env.ADMIN_PASSWORD)} />;
  const { titles, generated } = await readStore();
  return (
    <Studio
      titles={titles.map((entry) => {
        const found = generated[entryKey(entry)];
        return { ...entry, hours: entry.hours ?? found?.hours ?? estimateHours(entry), poster: found?.poster, year: found?.year };
      })}
    />
  );
}
