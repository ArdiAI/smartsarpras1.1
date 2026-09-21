const SESSION_TOKEN_KEY =
  'smart_sarpras_session_token';

export function getSessionToken():
  string | null {
  if (
    typeof window ===
    'undefined'
  ) {
    return null;
  }

  return (
    window.localStorage
      .getItem(
        SESSION_TOKEN_KEY
      )
  );
}

export function setSessionToken(
  token: string
) {
  window.localStorage.setItem(
    SESSION_TOKEN_KEY,
    token
  );
}

export function clearSessionToken() {
  if (
    typeof window ===
    'undefined'
  ) {
    return;
  }

  window.localStorage.removeItem(
    SESSION_TOKEN_KEY
  );
}
