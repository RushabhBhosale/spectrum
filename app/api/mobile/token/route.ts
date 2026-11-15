import { exchangeMobileCode, mobileBody, mobileFailure, mobileResponse } from '@/lib/mobile-auth';
export async function POST(request: Request) {
  try {
    const body = await mobileBody(request);
    return mobileResponse(await exchangeMobileCode(body.code, body.codeVerifier));
  } catch (error) { return mobileFailure(error); }
}
