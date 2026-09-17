const {
  createClient,
} = require('@supabase/supabase-js');

const pool =
  require('./db.cjs');


const supabaseAuth =
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );


// =====================================================
// REQUIRE AUTH
// User biasa yang sudah login Supabase
// =====================================================

async function requireAuth(
  req,
  res,
  next
) {
  try {
    const authorization =
      req.headers.authorization || '';

    if (
      !authorization.startsWith(
        'Bearer '
      )
    ) {
      return res
        .status(401)
        .json({
          ok: false,
          message:
            'Token login tidak ditemukan',
        });
    }

    const token =
      authorization
        .slice(7)
        .trim();

    const {
      data: {
        user,
      },
      error,
    } =
      await supabaseAuth
        .auth
        .getUser(token);

    if (
      error ||
      !user
    ) {
      return res
        .status(401)
        .json({
          ok: false,
          message:
            'Session login tidak valid',
        });
    }

    // Dipakai route seperti Kavling:
    // req.authUser.id
    req.authUser =
      user;

    next();

  } catch (error) {
    console.error(
      '[AUTH] requireAuth error:',
      error
    );

    return res
      .status(500)
      .json({
        ok: false,
        message:
          'Gagal memeriksa session login',
      });
  }
}


// =====================================================
// REQUIRE ADMIN
// =====================================================

async function requireAdmin(
  req,
  res,
  next
) {
  try {
    const authorization =
      req.headers.authorization || '';

    if (
      !authorization.startsWith(
        'Bearer '
      )
    ) {
      return res
        .status(401)
        .json({
          ok: false,
          message:
            'Token login tidak ditemukan',
        });
    }

    const token =
      authorization
        .slice(7)
        .trim();

    const {
      data: {
        user,
      },
      error,
    } =
      await supabaseAuth
        .auth
        .getUser(token);

    if (
      error ||
      !user
    ) {
      return res
        .status(401)
        .json({
          ok: false,
          message:
            'Session login tidak valid',
        });
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

          FROM
            public.admin_users

          WHERE
            user_id = $1

          LIMIT 1
        `,
        [
          user.id,
        ]
      );

    const admin =
      adminResult.rows[0];

    if (
      !admin ||
      admin.is_active !== true
    ) {
      return res
        .status(403)
        .json({
          ok: false,
          message:
            'Akun ini bukan admin aktif',
        });
    }

    const rolesResult =
      await pool.query(
        `
          SELECT
            r.id,
            r.name

          FROM
            public.admin_user_roles aur

          INNER JOIN
            public.roles r

            ON
              r.id =
              aur.role_id

          WHERE
            aur.admin_user_id = $1

            AND
              COALESCE(
                r.is_active,
                true
              ) = true
        `,
        [
          admin.id,
        ]
      );

    const roles =
      rolesResult.rows;

    const isSuperAdmin =
      roles.some(
        (
          role
        ) => {
          const name =
            String(
              role.name || ''
            )
              .trim()
              .toLowerCase()
              .replace(
                /[\s_-]+/g,
                ''
              );

          return (
            name ===
            'superadmin'
          );
        }
      );

    req.authUser =
      user;

    req.adminUser =
      admin;

    req.adminRoles =
      roles;

    req.isSuperAdmin =
      isSuperAdmin;

    next();

  } catch (error) {
    console.error(
      '[AUTH] requireAdmin error:',
      error
    );

    return res
      .status(500)
      .json({
        ok: false,
        message:
          'Gagal memeriksa akses admin',
      });
  }
}


// =====================================================
// REQUIRE PERMISSION
// =====================================================

function requirePermission(
  moduleName,
  actionName
) {
  return async (
    req,
    res,
    next
  ) => {
    try {
      if (
        req.isSuperAdmin
      ) {
        return next();
      }

      const result =
        await pool.query(
          `
            SELECT 1

            FROM
              public.admin_user_roles aur

            INNER JOIN
              public.roles r

              ON
                r.id =
                aur.role_id

            INNER JOIN
              public.role_permissions rp

              ON
                rp.role_id =
                r.id

            INNER JOIN
              public.permissions p

              ON
                p.id =
                rp.permission_id

            WHERE
              aur.admin_user_id = $1

              AND
                COALESCE(
                  r.is_active,
                  true
                ) = true

              AND
                p.module = $2

              AND
                p.action = $3

            LIMIT 1
          `,
          [
            req.adminUser.id,
            moduleName,
            actionName,
          ]
        );

      if (
        result.rowCount ===
        0
      ) {
        return res
          .status(403)
          .json({
            ok: false,
            message:
              `Tidak memiliki izin ${moduleName}.${actionName}`,
          });
      }

      next();

    } catch (error) {
      console.error(
        '[AUTH] requirePermission error:',
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          message:
            'Gagal memeriksa permission',
        });
    }
  };
}


// =====================================================
// EXPORT
// =====================================================

module.exports = {
  requireAuth,
  requireAdmin,
  requirePermission,
};