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


function inferAuditActivityType(req) {
  const path =
    String(
      req.originalUrl ||
      req.path ||
      ''
    ).toLowerCase();

  if (path.includes('/approve')) return 'APPROVE';
  if (path.includes('/reject')) return 'REJECT';
  if (path.includes('/forward')) return 'FORWARD';
  if (path.includes('/return')) return 'RETURN';
  if (path.includes('/complete')) return 'COMPLETE';

  switch (
    String(req.method || '')
      .toUpperCase()
  ) {
    case 'GET':
      return 'VIEW';
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return 'ACTION';
  }
}


function inferAuditModule(req) {
  const path =
    String(
      req.originalUrl ||
      req.path ||
      ''
    ).toLowerCase();

  const modules = [
    ['borrow', 'Borrowings'],
    ['agenda', 'Agenda'],
    ['timeline', 'Timeline'],
    ['report', 'Reports'],
    ['inventor', 'Inventory'],
    ['facilit', 'Facilities'],
    ['announcement', 'Announcements'],
    ['kavling', 'Kavling'],
    ['workflow', 'Workflow'],
    ['role', 'Roles'],
    ['user', 'Users'],
    ['system-config', 'System Config'],
    ['system-setting', 'Settings'],
    ['activity-log', 'Activity Logs'],
    ['dashboard', 'Dashboard'],
  ];

  for (const [needle, label] of modules) {
    if (path.includes(needle)) {
      return label;
    }
  }

  return 'Admin';
}


function registerSuperAdminAudit(
  req,
  res
) {
  if (
    !req.isSuperAdmin ||
    req._superAdminAuditRegistered
  ) {
    return;
  }

  const path =
    String(
      req.originalUrl ||
      req.path ||
      ''
    );

  // Hindari log page mencatat dirinya sendiri setiap refresh.
  if (
    path.startsWith(
      '/api/admin/activity-logs'
    )
  ) {
    return;
  }

  req._superAdminAuditRegistered =
    true;

  const startedAt =
    Date.now();

  res.on(
    'finish',
    () => {
      const activityType =
        inferAuditActivityType(
          req
        );

      const moduleName =
        inferAuditModule(
          req
        );

      const roleNames =
        (req.adminRoles ?? [])
          .map(
            (role) =>
              role.name
          )
          .filter(Boolean)
          .join(', ') ||
        'Super Admin';

      const durationMs =
        Date.now() -
        startedAt;

      const description =
        `${req.method} ${path} -> HTTP ${res.statusCode} (${durationMs} ms)`;

      void pool
        .query(
          `
            INSERT INTO public.system_activity_logs (
              admin_user_id,
              admin_name,
              admin_email,
              admin_role,
              activity_type,
              module,
              description,
              ip_address,
              user_agent
            )
            VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9
            )
          `,
          [
            req.adminUser?.id ??
              null,
            req.adminUser?.name ??
              null,
            req.adminUser?.email ??
              null,
            roleNames,
            activityType,
            moduleName,
            description,
            req.ip ?? null,
            req.headers[
              'user-agent'
            ] ?? null,
          ]
        )
        .catch(
          (error) => {
            console.error(
              '[AUDIT] gagal menyimpan log Super Admin:',
              error
            );
          }
        );
    }
  );
}


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

    registerSuperAdminAudit(
      req,
      res
    );

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