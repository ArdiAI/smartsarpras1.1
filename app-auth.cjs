const crypto =
  require('node:crypto');

const pool =
  require('./db.cjs');


function createSessionToken() {
  return crypto
    .randomBytes(32)
    .toString('base64url');
}


function hashSessionToken(token) {
  return crypto
    .createHash('sha256')
    .update(String(token || ''))
    .digest('hex');
}


function scryptAsync(
  password,
  salt
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      crypto.scrypt(
        String(password || ''),
        salt,
        64,
        (
          error,
          derivedKey
        ) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(
            derivedKey
          );
        }
      );
    }
  );
}


async function hashPassword(
  password
) {
  const salt =
    crypto
      .randomBytes(16)
      .toString('hex');

  const derivedKey =
    await scryptAsync(
      password,
      salt
    );

  return [
    'scrypt',
    salt,
    derivedKey.toString(
      'hex'
    ),
  ].join('$');
}


async function verifyPassword(
  password,
  storedHash
) {
  const [
    algorithm,
    salt,
    expectedHex,
  ] =
    String(
      storedHash || ''
    ).split('$');

  if (
    algorithm !==
      'scrypt' ||
    !salt ||
    !expectedHex
  ) {
    return false;
  }

  const derivedKey =
    await scryptAsync(
      password,
      salt
    );

  const expected =
    Buffer.from(
      expectedHex,
      'hex'
    );

  if (
    expected.length !==
    derivedKey.length
  ) {
    return false;
  }

  return crypto
    .timingSafeEqual(
      expected,
      derivedKey
    );
}


async function resolveSession(token) {
  const result =
    await pool.query(
      `
        SELECT
          s.id AS session_id,
          s.user_id,
          u.username,
          u.email,
          u.name
        FROM public.app_sessions s
        INNER JOIN public.app_users u
          ON u.id = s.user_id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
          AND u.is_active = true
        LIMIT 1
      `,
      [
        hashSessionToken(token),
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    return null;
  }

  return {
    sessionId:
      row.session_id,
    user: {
      id:
        row.user_id,
      username:
        row.username,
      email:
        row.email,
      name:
        row.name,
    },
  };
}


module.exports = {
  createSessionToken,
  hashSessionToken,
  hashPassword,
  verifyPassword,
  resolveSession,
};
