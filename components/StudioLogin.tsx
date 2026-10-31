'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { signIn, type Result } from '@/app/studio/actions';
import { SITE_NAME } from '@/lib/site';

export default function StudioLogin({ ready }: { ready: boolean }) {
  const router = useRouter();
  const [result, action, pending] = useActionState<Result | null, FormData>(signIn, null);

  useEffect(() => {
    if (result?.ok) router.refresh();
  }, [result, router]);

  return (
    <main className="wrap login">
      <a className="label" href="/">{SITE_NAME}</a>
      <h1>Studio</h1>
      <p>Your private space to add titles, write reviews and collect quotes.</p>
      {ready ? (
        <form action={action}>
          <label className="field">
            <span className="label">Password</span>
            <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
          </label>
          <button className="solid" disabled={pending}>{pending ? 'Checking…' : 'Sign in'}</button>
          {result && !result.ok && <p className="notice bad" role="alert">{result.message}</p>}
        </form>
      ) : (
        <p className="notice">Add ADMIN_PASSWORD to your environment to turn this page on.</p>
      )}
    </main>
  );
}
