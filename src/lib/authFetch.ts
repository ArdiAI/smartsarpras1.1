import { supabase } from './supabase';

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const {
    data: { session },
    error,
  } =
    await supabase.auth
      .getSession();

  if (error) {
    throw new Error(
      error.message
    );
  }

  const token =
    session?.access_token;

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
