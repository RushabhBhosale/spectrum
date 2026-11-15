import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import StudioLogin from '@/components/StudioLogin';
import { isSignedIn } from '@/app/studio/actions';
import { createMobileCode } from '@/lib/mobile-auth';
import { validateAuthorization } from '@/scripts/mobile-security.mjs';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Connect Memonest', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function ConnectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  let authorization: ReturnType<typeof validateAuthorization>;
  try {
    authorization = validateAuthorization({ challenge: query.code_challenge, method: query.code_challenge_method, state: query.state, redirectUri: query.redirect_uri });
  } catch {
    return <main className="wrap login"><h1>Connection unavailable</h1><p>Start a new connection from Movies &amp; Shows in the Memonest app.</p></main>;
  }
  if (!process.env.MONGODB_URI || !process.env.ADMIN_PASSWORD) return <main className="wrap login"><h1>Connection needs setup</h1><p>Configure ADMIN_PASSWORD and MONGODB_URI on the tracker server before connecting Memonest.</p></main>;
  if (!(await isSignedIn())) return <StudioLogin ready />;

  async function approve() {
    'use server';
    if (!(await isSignedIn())) throw new Error('Sign in again to connect Memonest.');
    redirect(await createMobileCode(authorization));
  }
  return (
    <main className="wrap login">
      <a className="label" href="/studio">← One More Episode Studio</a>
      <h1>Connect Memonest</h1>
      <p>Allow this device to use your personal collection for its on-device assistant?</p>
      <ul style={{ lineHeight: 1.8, paddingLeft: 24, marginBlock: 24 }}>
        <li>Read your titles, ratings, viewing status and episode progress.</li>
        <li>Update status, ratings and episode progress after you review a change in Memonest.</li>
        <li>Keep a small copy on this phone for offline answers.</li>
      </ul>
      <p>This grants access to this Studio&apos;s single personal collection. Memonest does not receive your Studio password or database credentials, and does not copy titles to its cloud services.</p>
      <p>The connection expires after 30 days. Revoke it at any time from <a href="/mobile/connections">Connected apps</a>.</p>
      <form action={approve} style={{ marginTop: 24 }}><button className="solid">Allow this device</button></form>
      <a className="label" href="/studio" style={{ display: 'inline-block', marginTop: 24 }}>Cancel</a>
    </main>
  );
}
