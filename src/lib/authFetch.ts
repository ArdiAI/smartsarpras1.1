import { getSessionToken } from './appSession';

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token =
    getSessionToken();

  const headers =
    new Headers(
      init.headers
    );

  if (token) {
    headers.set(
      'Authorization',
      `Bearer ${token}`
    );
  }

  return fetch(
    input,
    {
      ...init,
      headers,
    }
  );
}
