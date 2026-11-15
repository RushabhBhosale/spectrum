import { mobileResponse } from '@/lib/mobile-auth';
export const dynamic = 'force-dynamic';
export function GET() {
  return mobileResponse({ version: 1, authentication: 'pkce-s256', available: Boolean(process.env.ADMIN_PASSWORD && process.env.MONGODB_URI), fields: ['status', 'rating', 'episodes', 'progress'], scopes: ['library:read', 'titles:update'] });
}
