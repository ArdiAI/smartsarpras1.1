import { getSessionToken } from './appSession';

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token =
    getSessionToken();

  if (!token) {
    throw new Error(
      'Sesi login tidak ditemukan. Silakan login kembali.'
    );
  }

  const headers =
    new Headers(
      init.headers
    );

  headers.set(
    'Authorization',
    `Bearer ${token}`
  );

  return fetch(
    input,
    {
      ...init,
      headers,
    }
  );
}
