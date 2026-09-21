const crypto = require('node:crypto');
const nodemailer = require('nodemailer');

const pool = require('./db.cjs');
const { hashPassword } = require('./app-auth.cjs');

function hashResetToken(token) {
  return crypto
    .createHash('sha256')
    .update(String(token || ''))
    .digest('hex');
}

function getPublicAppUrl() {
  return String(
    process.env.APP_PUBLIC_URL ||
      'https://sarpras.smkn1-cmi.sch.id'
  ).replace(/\/+$/, '');
}

function createMailer() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '');

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

function registerPasswordResetRoutes(
  app,
  { authWriteLimiter }
) {
  app.post(
    '/api/auth/forgot-password',
    authWriteLimiter,
    async (req, res) => {
      const email = String(req.body?.email || '')
        .trim()
        .toLowerCase();

      if (!email) {
        return res.status(400).json({
          ok: false,
          message: 'Email wajib diisi',
        });
      }

      try {
        const userResult = await pool.query(
          `
            SELECT id, email, name
            FROM public.app_users
            WHERE lower(email) = $1
              AND is_active = true
            LIMIT 1
          `,
          [email]
        );

        const user = userResult.rows[0];

        // Selalu beri respons generik agar endpoint tidak membocorkan
        // apakah suatu alamat email terdaftar atau tidak.
        if (!user) {
          return res.json({
            ok: true,
            message:
              'Jika email terdaftar, tautan reset password akan dikirim.',
          });
        }

        const mailer = createMailer();

        if (!mailer) {
          console.error(
            '[APP AUTH] SMTP belum dikonfigurasi untuk reset password'
          );

          return res.status(503).json({
            ok: false,
            message:
              'Layanan reset password sedang tidak tersedia. Hubungi Super Admin.',
          });
        }

        const token = crypto
          .randomBytes(32)
          .toString('base64url');

        const tokenHash = hashResetToken(token);

        const client = await pool.connect();

        try {
          await client.query('BEGIN');

          await client.query(
            `
              UPDATE private.app_password_reset_tokens
              SET used_at = NOW()
              WHERE user_id = $1
                AND used_at IS NULL
            `,
            [user.id]
          );

          await client.query(
            `
              INSERT INTO private.app_password_reset_tokens (
                user_id,
                token_hash,
                expires_at,
                requested_ip,
                user_agent
              )
              VALUES (
                $1,
                $2,
                NOW() + INTERVAL '30 minutes',
                $3,
                $4
              )
            `,
            [
              user.id,
              tokenHash,
              req.ip ?? null,
              req.headers['user-agent'] ?? null,
            ]
          );

          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }

        const resetUrl =
          `${getPublicAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;

        const fromEmail =
          String(process.env.FROM_EMAIL || '').trim() ||
          String(process.env.SMTP_USER || '').trim();

        const fromName =
          String(
            process.env.FROM_NAME ||
              'Smart Sarpras'
          ).trim();

        await mailer.sendMail({
          from: {
            name: fromName,
            address: fromEmail,
          },
          to: user.email,
          subject: 'Reset Password Smart Sarpras',
          text:
            `Halo ${user.name || 'Admin'},\n\n` +
            'Gunakan tautan berikut untuk membuat password baru. ' +
            'Tautan berlaku selama 30 menit dan hanya dapat digunakan sekali.\n\n' +
            `${resetUrl}\n\n` +
            'Jika Anda tidak meminta reset password, abaikan email ini.',
          html:
            `<p>Halo ${String(user.name || 'Admin')},</p>` +
            '<p>Gunakan tautan berikut untuk membuat password baru. ' +
            'Tautan berlaku selama 30 menit dan hanya dapat digunakan sekali.</p>' +
            `<p><a href="${resetUrl}">Reset password Smart Sarpras</a></p>` +
            '<p>Jika Anda tidak meminta reset password, abaikan email ini.</p>',
        });

        return res.json({
          ok: true,
          message:
            'Jika email terdaftar, tautan reset password akan dikirim.',
        });
      } catch (error) {
        console.error(
          '[APP AUTH] forgot-password error:',
          error
        );

        return res.json({
          ok: true,
          message:
            'Jika email terdaftar, tautan reset password akan dikirim.',
        });
      }
    }
  );

  app.post(
    '/api/auth/reset-password',
    authWriteLimiter,
    async (req, res) => {
      const token = String(req.body?.token || '').trim();
      const password = String(req.body?.password || '');

      if (!token) {
        return res.status(400).json({
          ok: false,
          message: 'Token reset password tidak ditemukan',
        });
      }

      if (password.length < 10) {
        return res.status(400).json({
          ok: false,
          message:
            'Password minimal 10 karakter',
        });
      }

      const tokenHash = hashResetToken(token);
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const tokenResult = await client.query(
          `
            SELECT
              t.id,
              t.user_id
            FROM private.app_password_reset_tokens t
            INNER JOIN public.app_users u
              ON u.id = t.user_id
            WHERE t.token_hash = $1
              AND t.used_at IS NULL
              AND t.expires_at > NOW()
              AND u.is_active = true
            LIMIT 1
            FOR UPDATE OF t
          `,
          [tokenHash]
        );

        const resetRecord = tokenResult.rows[0];

        if (!resetRecord) {
          await client.query('ROLLBACK');

          return res.status(400).json({
            ok: false,
            message:
              'Tautan reset password tidak valid atau sudah kedaluwarsa',
          });
        }

        const passwordHash = await hashPassword(password);

        await client.query(
          `
            UPDATE public.app_users
            SET
              password_hash = $1,
              updated_at = NOW()
            WHERE id = $2
          `,
          [
            passwordHash,
            resetRecord.user_id,
          ]
        );

        await client.query(
          `
            UPDATE private.app_password_reset_tokens
            SET used_at = NOW()
            WHERE user_id = $1
              AND used_at IS NULL
          `,
          [resetRecord.user_id]
        );

        await client.query(
          `
            UPDATE public.app_sessions
            SET revoked_at = NOW()
            WHERE user_id = $1
              AND revoked_at IS NULL
          `,
          [resetRecord.user_id]
        );

        await client.query('COMMIT');

        return res.json({
          ok: true,
          message:
            'Password berhasil diperbarui. Silakan login kembali.',
        });
      } catch (error) {
        await client.query('ROLLBACK');

        console.error(
          '[APP AUTH] reset-password error:',
          error
        );

        return res.status(500).json({
          ok: false,
          message:
            'Gagal memperbarui password',
        });
      } finally {
        client.release();
      }
    }
  );
}

module.exports = {
  registerPasswordResetRoutes,
};
