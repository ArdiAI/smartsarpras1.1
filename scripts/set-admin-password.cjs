require('dotenv').config();

const pool =
  require('../db.cjs');

const {
  hashPassword,
} =
  require('../app-auth.cjs');

async function main() {
  const email =
    String(
      process.argv[2] ||
      process.env.ADMIN_EMAIL ||
      ''
    )
      .trim()
      .toLowerCase();

  const password =
    String(
      process.env.SMART_SARPRAS_ADMIN_PASSWORD ||
      ''
    );

  if (!email) {
    console.error(
      'Email admin wajib diberikan. Contoh: npm run admin:set-password -- admin@sekolah.sch.id'
    );
    process.exit(1);
  }

  if (
    password.length <
    10
  ) {
    console.error(
      'Set SMART_SARPRAS_ADMIN_PASSWORD minimal 10 karakter sebelum menjalankan command ini.'
    );
    process.exit(1);
  }

  const adminResult =
    await pool.query(
      `
        SELECT
          id,
          user_id,
          email,
          name,
          is_active
        FROM public.admin_users
        WHERE lower(email) = $1
        LIMIT 1
      `,
      [email]
    );

  const admin =
    adminResult.rows[0];

  if (
    !admin ||
    admin.is_active !== true
  ) {
    console.error(
      'Email tersebut bukan admin aktif.'
    );
    process.exit(1);
  }

  const existingResult =
    await pool.query(
      `
        SELECT id
        FROM public.app_users
        WHERE lower(email) = $1
        LIMIT 1
      `,
      [email]
    );

  const passwordHash =
    await hashPassword(
      password
    );

  if (
    existingResult.rowCount >
    0
  ) {
    await pool.query(
      `
        UPDATE public.app_users
        SET
          password_hash = $1,
          name = $2,
          is_active = true,
          updated_at = NOW()
        WHERE id = $3
      `,
      [
        passwordHash,
        admin.name,
        existingResult.rows[0].id,
      ]
    );
  } else {
    const userId =
      admin.user_id ||
      admin.id;

    await pool.query(
      `
        INSERT INTO public.app_users (
          id,
          email,
          password_hash,
          name,
          is_active,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          true,
          NOW(),
          NOW()
        )
      `,
      [
        userId,
        email,
        passwordHash,
        admin.name,
      ]
    );
  }

  await pool.query(
    `
      UPDATE public.app_sessions
      SET revoked_at = NOW()
      WHERE user_id = (
        SELECT id
        FROM public.app_users
        WHERE lower(email) = $1
        LIMIT 1
      )
        AND revoked_at IS NULL
    `,
    [email]
  );

  console.log(
    'Password admin berhasil disetel. Session lama sudah dicabut.'
  );
}

main()
  .catch(
    (error) => {
      console.error(
        'Gagal menyetel password admin:',
        error?.message ||
        error
      );
      process.exitCode = 1;
    }
  )
  .finally(
    async () => {
      await pool.end();
    }
  );
