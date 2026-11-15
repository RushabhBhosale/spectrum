import { mobileFailure, mobileResponse, requireMobileSession, revokeMobileSession } from '@/lib/mobile-auth';
export async function DELETE(request: Request) {
  try {
    const session = await requireMobileSession(request, 'library:read');
    await revokeMobileSession(session._id);
    return mobileResponse({ revoked: true });
  } catch (error) { return mobileFailure(error); }
}
