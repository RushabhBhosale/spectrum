import type { Metadata } from 'next';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import StudioLogin from '@/components/StudioLogin';
import { isSignedIn } from '@/app/studio/actions';
import { listMobileSessions, revokeMobileSession } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Connected apps', robots: { index: false, follow: false } };

async function revoke(form: FormData) {
  'use server';
  if (!(await isSignedIn())) throw new Error('Sign in again to manage connections.');
  const id = String(form.get('id') ?? '');
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error('Invalid connection.');
  await revokeMobileSession(new ObjectId(id));
  revalidatePath('/mobile/connections');
}

export default async function ConnectionsPage() {
  if (!(await isSignedIn())) return <StudioLogin ready={Boolean(process.env.ADMIN_PASSWORD)} />;
  if (!process.env.MONGODB_URI) return <main className="wrap login"><h1>Connected apps</h1><p>Configure MongoDB to use device connections.</p></main>;
  const sessions = await listMobileSessions();
  return <main className="wrap login">
    <a className="label" href="/studio">← Studio</a>
    <h1>Connected apps</h1>
    <p>Revoking a device immediately stops its access to the collection. Local copies are removed when that device next checks its connection.</p>
    {!sessions.length ? <p>No connected devices.</p> : sessions.map((session) => <form action={revoke} key={session._id.toHexString()} style={{ borderTop: '1px solid currentColor', paddingBlock: 24 }}>
      <input type="hidden" name="id" value={session._id.toHexString()} />
      <p>Memonest · {session.createdAt.toISOString().slice(0, 10)} · expires {session.expiresAt.toISOString().slice(0, 10)}</p>
      <button className="solid">Revoke this connection</button>
    </form>)}
  </main>;
}
