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


async function resolveSession(token) {
  const result =
    await pool.query(
      `
        SELECT
          s.id AS session_id,
          s.user_id,
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
  resolveSession,
};
