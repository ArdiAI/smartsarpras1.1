require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const { AsyncLocalStorage } = require('node:async_hooks');
const pool = require('./db.cjs');

const {
  requireAuth,
  optionalAuth,
  requireAdmin,
  requirePermission,
} = require('./auth.cjs');

const {
  createSessionToken,
  hashSessionToken,
  hashPassword,
  verifyPassword,
} = require('./app-auth.cjs');


const app = express();
const PORT = Number(process.env.PORT || 3001);
const requestContext = new AsyncLocalStorage();

if (
  String(
    process.env.NODE_ENV ||
    ''
  ).toLowerCase() ===
  'production'
) {
  app.set(
    'trust proxy',
    1
  );
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const extraAllowedOrigins =
  String(
    process.env.ALLOWED_ORIGINS ||
    ''
  )
    .split(',')
    .map((value) =>
      value.trim()
    )
    .filter(Boolean);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://sarpras.smkn1-cmi.sch.id',
  ...extraAllowedOrigins,
];

app.use(helmet());

app.use(
  cors({
    origin:
      allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

app.use(
  (
    req,
    _res,
    next
  ) => {
    requestContext.run(
      {
        authorization:
          String(
            req.headers
              .authorization ||
              ''
          ),
      },
      next
    );
  }
);


function createRateLimiter({
  windowMs,
  max,
  label,
}) {
  const buckets =
    new Map();

  const timer =
    setInterval(
      () => {
        const now =
          Date.now();

        for (
          const [
            key,
            value,
          ] of buckets
        ) {
          if (
            now -
              value.startedAt >=
            windowMs
          ) {
            buckets.delete(
              key
            );
          }
        }
      },
      Math.max(
        30_000,
        windowMs
      )
    );

  timer.unref?.();

  return (
    req,
    res,
    next
  ) => {
    const now =
      Date.now();

    const identity =
      req.authUser?.id ||
      req.ip ||
      'unknown';

    const key =
      `${label}:${identity}`;

    const current =
      buckets.get(key);

    if (
      !current ||
      now -
          current.startedAt >=
        windowMs
    ) {
      buckets.set(
        key,
        {
          count: 1,
          startedAt: now,
        }
      );

      return next();
    }

    if (
      current.count >=
      max
    ) {
      const retryAfter =
        Math.max(
          1,
          Math.ceil(
            (
              windowMs -
              (
                now -
                current.startedAt
              )
            ) /
              1000
          )
        );

      res.setHeader(
        'Retry-After',
        String(
          retryAfter
        )
      );

      return res
        .status(429)
        .json({
          ok: false,
          message:
            'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.',
        });
    }

    current.count +=
      1;

    buckets.set(
      key,
      current
    );

    next();
  };
}


const publicWriteLimiter =
  createRateLimiter({
    windowMs:
      60 * 1000,
    max: 30,
    label:
      'public-write',
  });


const uploadWriteLimiter =
  createRateLimiter({
    windowMs:
      60 * 1000,
    max: 12,
    label:
      'upload-write',
  });


const authWriteLimiter =
  createRateLimiter({
    windowMs:
      5 * 60 * 1000,
    max: 20,
    label:
      'auth-write',
  });


// =====================================================
// APPLICATION AUTH - TIDAK MENGGUNAKAN SUPABASE AUTH API
// =====================================================

app.post(
  '/api/auth/register',
  authWriteLimiter,
  (_req, res) => {
    return res.status(404).json({
      ok: false,
      message:
        'Pendaftaran akun publik dinonaktifkan',
    });
  }
);


app.post(
  '/api/auth/login',
  authWriteLimiter,
  async (req, res) => {
    try {
      const email =
        String(req.body?.email || '')
          .trim()
          .toLowerCase();

      const password =
        String(req.body?.password || '');

      if (!email || !password) {
        return res.status(400).json({
          ok: false,
          message:
            'Email dan password wajib diisi',
        });
      }

      const userResult =
        await pool.query(
          `
            SELECT
              id,
              email,
              name,
              password_hash
            FROM public.app_users
            WHERE lower(email) = $1
              AND is_active = true
            LIMIT 1
          `,
          [
            email,
          ]
        );

      const user =
        userResult.rows[0];

      const passwordValid =
        user
          ? await verifyPassword(
              password,
              user.password_hash
            )
          : false;

      if (
        !user ||
        !passwordValid
      ) {
        return res.status(401).json({
          ok: false,
          message:
            'Email atau password salah',
        });
      }

      delete user.password_hash;

      const token =
        createSessionToken();

      const tokenHash =
        hashSessionToken(
          token
        );

      const ttlDays =
        Math.max(
          1,
          Number(
            process.env.SESSION_TTL_DAYS ||
            7
          ) || 7
        );

      const sessionResult =
        await pool.query(
          `
            INSERT INTO public.app_sessions (
              user_id,
              token_hash,
              expires_at,
              ip_address,
              user_agent
            )
            VALUES (
              $1,
              $2,
              NOW() +
                ($3::text || ' days')::interval,
              $4,
              $5
            )
            RETURNING
              id,
              expires_at
          `,
          [
            user.id,
            tokenHash,
            ttlDays,
            req.ip ?? null,
            req.headers[
              'user-agent'
            ] ?? null,
          ]
        );

      return res.json({
        ok: true,
        data: {
          token,
          expiresAt:
            sessionResult.rows[0]
              .expires_at,
          user,
        },
      });
    } catch (error) {
      console.error(
        '[APP AUTH] login error:',
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          'Gagal melakukan login',
      });
    }
  }
);


app.get(
  '/api/auth/session',
  requireAuth,
  (req, res) => {
    return res.json({
      ok: true,
      data: {
        user: {
          id:
            req.authUser.id,
          email:
            req.authUser.email,
          name:
            req.authUser.name ??
            req.authUser.user_metadata?.name ??
            '',
        },
      },
    });
  }
);


app.post(
  '/api/auth/logout',
  requireAuth,
  async (req, res) => {
    try {
      await pool.query(
        `
          UPDATE public.app_sessions
          SET revoked_at = NOW()
          WHERE id = $1
        `,
        [
          req.appSessionId,
        ]
      );

      return res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        '[APP AUTH] logout error:',
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          'Gagal logout',
      });
    }
  }
);


// =====================================================
// GOOGLE DRIVE UPLOAD
// Supabase Storage sudah tidak dipakai untuk data aplikasi.
// =====================================================

app.post(
  '/api/upload-drive',
  optionalAuth,
  uploadWriteLimiter,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          message: 'File belum dipilih',
        });
      }

      const category = String(req.body?.category ?? '').trim();
      const allowedCategories = [
        'surat_peminjaman',
        'laporan',
        'foto_kavling',
        'foto_pengumuman',
        'inventory',
        'fasilitas',
        'tim_pengelola',
        'panduan_peminjaman',
      ];

      if (!category) {
        return res.status(400).json({
          ok: false,
          message: 'Kategori file belum diberikan',
        });
      }

      if (!allowedCategories.includes(category)) {
        return res.status(400).json({
          ok: false,
          message: 'Kategori file tidak valid',
        });
      }

      const publicUploadCategories = [
        'surat_peminjaman',
        'laporan',
        'foto_kavling',
      ];

      if (
        !publicUploadCategories.includes(category) &&
        !req.adminUser
      ) {
        return res.status(401).json({
          ok: false,
          message:
            'Upload kategori ini hanya untuk admin',
        });
      }

      if (
        category === 'panduan_peminjaman' &&
        !req.isSuperAdmin
      ) {
        return res.status(403).json({
          ok: false,
          message:
            'Hanya Super Admin yang dapat mengunggah gambar panduan peminjaman',
        });
      }

      if (!process.env.GOOGLE_APPS_SCRIPT_URL) {
        return res.status(500).json({
          ok: false,
          message: 'GOOGLE_APPS_SCRIPT_URL belum diatur',
        });
      }

      if (!process.env.GOOGLE_APPS_SCRIPT_TOKEN) {
        return res.status(500).json({
          ok: false,
          message: 'GOOGLE_APPS_SCRIPT_TOKEN belum diatur',
        });
      }

      const base64File = req.file.buffer.toString('base64');

      // Apps Script lama mungkin belum punya mapping folder khusus
      // untuk panduan peminjaman. Tetap pakai kategori aplikasi
      // sendiri untuk authorization, tetapi simpan gambar ke folder
      // gambar umum yang sudah ada agar deployment tidak terblokir.
      const driveCategory =
        category === 'panduan_peminjaman'
          ? 'foto_pengumuman'
          : category;

      const driveResponse = await fetch(
        process.env.GOOGLE_APPS_SCRIPT_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: process.env.GOOGLE_APPS_SCRIPT_TOKEN,
            category: driveCategory,
            fileName: String(req.body?.fileName || req.file.originalname),
            mimeType: req.file.mimetype,
            file: base64File,
          }),
        }
      );

      const responseText = await driveResponse.text();
      let driveResult;

      try {
        driveResult = JSON.parse(responseText);
      } catch {
        console.error(
          '[GOOGLE DRIVE] Response bukan JSON:',
          responseText.slice(0, 500)
        );

        return res.status(502).json({
          ok: false,
          message: 'Response Google Apps Script tidak valid',
        });
      }

      if (!driveResponse.ok || driveResult?.success !== true) {
        console.error('[GOOGLE DRIVE] Apps Script error:', driveResult);

        return res.status(502).json({
          ok: false,
          message:
            driveResult?.error ||
            'Upload Google Drive gagal',
        });
      }

      return res.json({
        ok: true,
        message: 'File berhasil diupload ke Google Drive',
        file: driveResult.file,
      });
    } catch (error) {
      console.error('[GOOGLE DRIVE] Upload error:', error);

      if (error?.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          ok: false,
          message: 'Ukuran file maksimal 10 MB',
        });
      }

      return res.status(500).json({
        ok: false,
        message: 'Terjadi kesalahan saat upload file',
      });
    }
  }
);

// =====================================================
// PUBLIC FEATURE FLAGS
// =====================================================

app.get(
  '/api/public/features',
  async (_req, res) => {
    try {
      const result =
        await pool.query(
          `
            SELECT key, value
            FROM public.system_config
            WHERE key IN (
              'public_borrowing_enabled'
            )
          `
        );

      const map =
        new Map(
          result.rows.map(
            (row) => [
              row.key,
              row.value,
            ]
          )
        );

      res.json({
        ok: true,
        data: {
          borrowingEnabled:
            map.get(
              'public_borrowing_enabled'
            ) === true,
        },
      });
    } catch (error) {
      console.error(
        '[PUBLIC FEATURES] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat pengaturan fitur publik',
      });
    }
  }
);


// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS db_user
    `);

    res.json({
      ok: true,
      message: 'Smart Sarpras API aktif',
      database: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: 'Gagal terhubung ke PostgreSQL',
    });
  }
});


// =====================================================
// DATABASE SUMMARY
// =====================================================

app.get(
  '/api/db-summary',
  requireAdmin,
  async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = result.rows.map(
      (row) => row.table_name
    );

    const counts = {};
    let totalRows = 0;

    for (const table of tables) {
      const safeTable = `"${table.replace(/"/g, '""')}"`;

      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.${safeTable}`
      );

      const count = countResult.rows[0].count;

      counts[table] = count;
      totalRows += count;
    }

    res.json({
      ok: true,
      database: process.env.PGDATABASE,
      tableCount: tables.length,
      totalRows,
      tables: counts,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: 'Gagal membaca database',
    });
  }
});


// =====================================================
// INVENTORY
// =====================================================

app.get('/api/inventory', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        i.*,
        CASE
          WHEN c.id IS NULL THEN NULL
          ELSE json_build_object(
            'id', c.id,
            'name', c.name
          )
        END AS categories
      FROM public.inventory i
      LEFT JOIN public.categories c
        ON c.id = i.category_id
      ORDER BY i.name ASC
    `);

    res.json({
      ok: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      'Inventory error:',
      error
    );

    res.status(500).json({
      ok: false,
      message: 'Gagal mengambil inventory',
    });
  }
});


// =====================================================
// FACILITIES PUBLIC
// =====================================================

app.get('/api/facilities', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM public.facilities
      ORDER BY created_at DESC
    `);

    res.json({
      ok: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      'Facilities error:',
      error
    );

    res.status(500).json({
      ok: false,
      message: 'Gagal mengambil facilities',
    });
  }
});


// =====================================================
// CATEGORIES
// =====================================================

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM public.categories
      ORDER BY name ASC
    `);

    res.json({
      ok: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      'Categories error:',
      error
    );

    res.status(500).json({
      ok: false,
      message: 'Gagal mengambil categories',
    });
  }
});

// =====================================================
// FACILITIES ADMIN
// =====================================================

// Ambil semua fasilitas untuk halaman admin
app.get(
  '/api/admin/facilities',
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          name,
          description,
          location,
          capacity,
          image_url,
          facility_type,
          category,
          department,
          workflow_template_id,
          status,
          manager_name,
          manager_role,
          created_at
        FROM public.facilities
        ORDER BY created_at DESC
      `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[ADMIN FACILITIES] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal mengambil data fasilitas',
      });
    }
  }
);


// Tambah fasilitas
app.post(
  '/api/admin/facilities',
  requireAdmin,
  requirePermission('facilities', 'create'),
  async (req, res) => {
    try {
      const {
        name,
        description,
        location,
        capacity,
        image_url,
        facility_type,
        category,
        department,
        status,
        manager_name,
        manager_role,
      } = req.body;

      if (
        typeof name !== 'string' ||
        !name.trim()
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Nama fasilitas wajib diisi',
        });
      }

      const capacityValue =
        capacity === null ||
        capacity === undefined ||
        capacity === ''
          ? null
          : Number(capacity);

      if (
        capacityValue !== null &&
        (
          !Number.isInteger(capacityValue) ||
          capacityValue < 0
        )
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Kapasitas tidak valid',
        });
      }

      const allowedStatuses = [
        'available',
        'in_use',
        'maintenance',
        'unavailable',
      ];

      const statusValue =
        allowedStatuses.includes(status)
          ? status
          : 'available';

      const result = await pool.query(
        `
          INSERT INTO public.facilities (
            name,
            description,
            location,
            capacity,
            image_url,
            facility_type,
            category,
            department,
            status,
            manager_name,
            manager_role
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11
          )
          RETURNING *
        `,
        [
          name.trim(),
          description || null,
          location || null,
          capacityValue,
          image_url.trim(),
          facility_type || null,
          category || null,
          department || null,
          statusValue,
          manager_name || null,
          manager_role || null,
        ]
      );

      res.status(201).json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[ADMIN FACILITIES] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menambahkan fasilitas',
      });
    }
  }
);


// Edit fasilitas
app.patch(
  '/api/admin/facilities/:id',
  requireAdmin,
  requirePermission('facilities', 'update'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        name,
        description,
        location,
        capacity,
        image_url,
        facility_type,
        category,
        department,
        status,
        manager_name,
        manager_role,
      } = req.body;

      if (
        typeof name !== 'string' ||
        !name.trim()
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Nama fasilitas wajib diisi',
        });
      }

      const capacityValue =
        capacity === null ||
        capacity === undefined ||
        capacity === ''
          ? null
          : Number(capacity);

      if (
        capacityValue !== null &&
        (
          !Number.isInteger(capacityValue) ||
          capacityValue < 0
        )
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Kapasitas tidak valid',
        });
      }

      const allowedStatuses = [
        'available',
        'in_use',
        'maintenance',
        'unavailable',
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          ok: false,
          message: 'Status fasilitas tidak valid',
        });
      }

      const result = await pool.query(
        `
          UPDATE public.facilities
          SET
            name = $1,
            description = $2,
            location = $3,
            capacity = $4,
            image_url = $5,
            facility_type = $6,
            category = $7,
            department = $8,
            status = $9,
            manager_name = $10,
            manager_role = $11
          WHERE id = $12
          RETURNING *
        `,
        [
          name.trim(),
          description || null,
          location || null,
          capacityValue,
          image_url || null,
          facility_type || null,
          category || null,
          department || null,
          status,
          manager_name || null,
          manager_role || null,
          id,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Fasilitas tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[ADMIN FACILITIES] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memperbarui fasilitas',
      });
    }
  }
);


// Hapus fasilitas
app.delete(
  '/api/admin/facilities/:id',
  requireAdmin,
  requirePermission('facilities', 'delete'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
          DELETE FROM public.facilities
          WHERE id = $1
          RETURNING id
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Fasilitas tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        message: 'Fasilitas berhasil dihapus',
      });
    } catch (error) {
      console.error(
        '[ADMIN FACILITIES] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menghapus fasilitas',
      });
    }
  }
);

// =====================================================
// FACILITY MANAGERS ADMIN
// =====================================================

// Ambil daftar PJ fasilitas
app.get(
  '/api/admin/facility-managers',
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          fm.id,
          fm.facility_id,
          fm.admin_user_id,
          fm.is_primary,
          fm.notes,
          fm.assigned_at,
          f.name AS facility_name,
          au.email AS admin_email,
          au.name AS admin_name
        FROM public.facility_managers fm
        LEFT JOIN public.facilities f
          ON f.id = fm.facility_id
        LEFT JOIN public.admin_users au
          ON au.id = fm.admin_user_id
        ORDER BY
          f.name ASC,
          fm.is_primary DESC
      `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[FACILITY MANAGERS] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal mengambil data PJ fasilitas',
      });
    }
  }
);


// Pilihan fasilitas + admin aktif
app.get(
  '/api/admin/facility-manager-options',
  requireAdmin,
  async (req, res) => {
    try {
      const facilitiesResult =
        await pool.query(`
          SELECT id, name
          FROM public.facilities
          ORDER BY name ASC
        `);

      const adminsResult =
        await pool.query(`
          SELECT id, email, name
          FROM public.admin_users
          WHERE is_active = true
          ORDER BY email ASC
        `);

      res.json({
        ok: true,
        data: {
          facilities: facilitiesResult.rows,
          adminUsers: adminsResult.rows,
        },
      });
    } catch (error) {
      console.error(
        '[FACILITY MANAGERS] OPTIONS error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal mengambil pilihan PJ fasilitas',
      });
    }
  }
);


// Tambah PJ fasilitas
app.post(
  '/api/admin/facility-managers',
  requireAdmin,
  requirePermission(
    'facility_managers',
    'create'
  ),
  async (req, res) => {
    try {
      const {
        facility_id,
        admin_user_id,
        is_primary,
        notes,
      } = req.body;

      if (!facility_id || !admin_user_id) {
        return res.status(400).json({
          ok: false,
          message:
            'Fasilitas dan pengguna wajib dipilih',
        });
      }

      const result = await pool.query(
        `
          INSERT INTO public.facility_managers (
            facility_id,
            admin_user_id,
            is_primary,
            notes
          )
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        [
          facility_id,
          admin_user_id,
          Boolean(is_primary),
          notes || null,
        ]
      );

      res.status(201).json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[FACILITY MANAGERS] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menambahkan PJ fasilitas',
      });
    }
  }
);


// Hapus PJ fasilitas
app.delete(
  '/api/admin/facility-managers/:id',
  requireAdmin,
  requirePermission(
    'facility_managers',
    'delete'
  ),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
          DELETE FROM public.facility_managers
          WHERE id = $1
          RETURNING id
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'PJ fasilitas tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        message: 'PJ fasilitas berhasil dihapus',
      });
    } catch (error) {
      console.error(
        '[FACILITY MANAGERS] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menghapus PJ fasilitas',
      });
    }
  }
);

// =====================================================
// ACTIVITY LOGS ADMIN
// =====================================================

app.get(
  '/api/admin/activity-logs',
  requireAdmin,
  async (req, res) => {
    try {
      const page = Math.max(
        1,
        Number.parseInt(req.query.page, 10) || 1
      );

      const PAGE_SIZE = 15;
      const offset = (page - 1) * PAGE_SIZE;

      const {
        date,
        admin,
        role,
        module,
        activity,
        search,
      } = req.query;

      const where = [];
      const values = [];

      if (date) {
        values.push(date);

        const param = `$${values.length}`;

        where.push(`
          created_at >= ${param}::date
          AND created_at < ${param}::date + INTERVAL '1 day'
        `);
      }

      if (admin) {
        values.push(`%${admin}%`);

        where.push(
          `admin_name ILIKE $${values.length}`
        );
      }

      if (role) {
        values.push(`%${role}%`);

        where.push(
          `admin_role ILIKE $${values.length}`
        );
      }

      if (module) {
        values.push(module);

        where.push(
          `module = $${values.length}`
        );
      }

      if (activity) {
        values.push(activity);

        where.push(
          `activity_type = $${values.length}`
        );
      }

      if (search) {
        values.push(`%${search}%`);

        const param = `$${values.length}`;

        where.push(`
          (
            description ILIKE ${param}
            OR admin_name ILIKE ${param}
            OR admin_email ILIKE ${param}
          )
        `);
      }

      const whereSql =
        where.length > 0
          ? `WHERE ${where.join(' AND ')}`
          : '';

      const countResult =
        await pool.query(
          `
            SELECT COUNT(*)::int AS total
            FROM public.system_activity_logs
            ${whereSql}
          `,
          values
        );

      const queryValues = [
        ...values,
        PAGE_SIZE,
        offset,
      ];

      const limitParam =
        `$${values.length + 1}`;

      const offsetParam =
        `$${values.length + 2}`;

      const result =
        await pool.query(
          `
            SELECT *
            FROM public.system_activity_logs
            ${whereSql}
            ORDER BY created_at DESC
            LIMIT ${limitParam}
            OFFSET ${offsetParam}
          `,
          queryValues
        );

      res.json({
        ok: true,
        data: result.rows,
        total:
          countResult.rows[0].total,
        page,
        pageSize: PAGE_SIZE,
      });
    } catch (error) {
      console.error(
        '[ACTIVITY LOGS] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal mengambil log aktivitas',
      });
    }
  }
);

// =====================================================
// ACTIVITY LOG - CREATE
// =====================================================

app.post(
  '/api/admin/activity-logs',
  requireAdmin,
  async (req, res) => {
    try {
      const {
        activityType,
        module,
        description,
      } = req.body;

      if (!activityType || !module) {
        return res.status(400).json({
          ok: false,
          message: 'Activity type dan module wajib diisi',
        });
      }

      const adminRole =
        req.adminRoles?.[0]?.name ?? null;

      const result = await pool.query(
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
          RETURNING *
        `,
        [
          req.adminUser.id,
          req.adminUser.name ?? null,
          req.adminUser.email ?? null,
          adminRole,
          activityType,
          module,
          description ?? null,
          req.ip ?? null,
          req.headers['user-agent'] ?? null,
        ]
      );

      res.status(201).json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[ACTIVITY LOGS] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menyimpan activity log',
      });
    }
  }
);

// =====================================================
// AGENDA ADMIN
// =====================================================

// Ambil semua agenda
app.get(
  '/api/admin/agendas',
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          title,
          category,
          event_date,
          end_date,
          start_time,
          end_time,
          location,
          organizer,
          description,
          penyelenggara,
          organisasi_jurusan,
          penanggung_jawab,
          status,
          email,
          jumlah_peserta,
          jenis_kegiatan
        FROM public.agendas
        ORDER BY event_date DESC
      `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[AGENDA] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memuat data agenda',
      });
    }
  }
);


// Tambah agenda
app.post(
  '/api/admin/agendas',
  requireAdmin,
  async (req, res) => {
    try {
      const {
        title,
        jenis_kegiatan,
        organisasi_jurusan,
        penanggung_jawab,
        email,
        location,
        event_date,
        end_date,
        start_time,
        end_time,
        description,
      } = req.body;

      if (!title || !event_date || !end_date) {
        return res.status(400).json({
          ok: false,
          message:
            'Judul, tanggal mulai, dan tanggal selesai wajib diisi',
        });
      }

      if (end_date < event_date) {
        return res.status(400).json({
          ok: false,
          message:
            'Tanggal selesai tidak boleh sebelum tanggal mulai',
        });
      }

      const result = await pool.query(
        `
          INSERT INTO public.agendas (
            title,
            jenis_kegiatan,
            organisasi_jurusan,
            penanggung_jawab,
            email,
            location,
            event_date,
            end_date,
            start_time,
            end_time,
            description,
            status,
            penyelenggara,
            jumlah_peserta,
            category
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15
          )
          RETURNING *
        `,
        [
          title,
          jenis_kegiatan || null,
          organisasi_jurusan || null,
          penanggung_jawab || null,
          email || null,
          location || null,
          event_date,
          end_date,
          start_time || null,
          end_time || null,
          description || null,
          'scheduled',
          organisasi_jurusan || null,
          0,
          jenis_kegiatan || null,
        ]
      );

      res.status(201).json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[AGENDA] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menambahkan agenda',
      });
    }
  }
);


// Hapus agenda - khusus super admin
app.delete(
  '/api/admin/agendas/:id',
  requireAdmin,
  async (req, res) => {
    try {
      if (!req.isSuperAdmin) {
        return res.status(403).json({
          ok: false,
          message:
            'Hanya Super Admin yang dapat menghapus agenda',
        });
      }

      const { id } = req.params;

      const result = await pool.query(
        `
          DELETE FROM public.agendas
          WHERE id = $1
          RETURNING id
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Agenda tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        message: 'Agenda berhasil dihapus',
      });
    } catch (error) {
      console.error(
        '[AGENDA] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menghapus agenda',
      });
    }
  }
);

// =====================================================
// DAMAGE REPORTS ADMIN
// =====================================================

// Ambil semua laporan kerusakan
app.get(
  '/api/admin/reports',
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          dr.id,
          to_jsonb(dr)->>'inventory_id' AS inventory_id,
          dr.reporter_name,
          dr.description,
          dr.image_url,
          dr.severity,
          dr.status,
          to_jsonb(dr)->>'resolution_notes' AS resolution_notes,
          dr.created_at,
          to_jsonb(dr)->>'resolved_at' AS resolved_at,
          dr.reporter_unit,
          dr.reporter_email,
          dr.reporter_phone,
          dr.location
        FROM public.damage_reports dr
        ORDER BY dr.created_at DESC
      `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[REPORTS] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memuat laporan',
      });
    }
  }
);


// Update status / resolusi laporan
app.patch(
  '/api/admin/reports/:id',
  requireAdmin,
  requirePermission('reports', 'manage'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        status,
        resolution_notes,
      } = req.body;

      const allowedStatuses = [
        'pending',
        'in_progress',
        'resolved',
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          ok: false,
          message: 'Status laporan tidak valid',
        });
      }

      const resolvedAt =
        status === 'resolved'
          ? new Date()
          : null;

      const result = await pool.query(
        `
          UPDATE public.damage_reports
          SET
            status = $1,
            resolution_notes = $2,
            resolved_at = $3
          WHERE id = $4
          RETURNING *
        `,
        [
          status,
          resolution_notes || null,
          resolvedAt,
          id,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Laporan tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[REPORTS] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memperbarui laporan',
      });
    }
  }
);


// Hapus laporan - khusus Super Admin
app.delete(
  '/api/admin/reports/:id',
  requireAdmin,
  async (req, res) => {
    try {
      if (!req.isSuperAdmin) {
        return res.status(403).json({
          ok: false,
          message:
            'Hanya Super Admin yang dapat menghapus laporan',
        });
      }

      const { id } = req.params;

      const result = await pool.query(
        `
          DELETE FROM public.damage_reports
          WHERE id = $1
          RETURNING id
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Laporan tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        message: 'Laporan berhasil dihapus',
      });
    } catch (error) {
      console.error(
        '[REPORTS] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menghapus laporan',
      });
    }
  }
);

// =====================================================
// TEST ADMIN AUTH
// =====================================================

app.get(
  '/api/admin/me',
  requireAdmin,
  (req, res) => {
    res.json({
      ok: true,
      admin: {
        id: req.adminUser.id,
        name: req.adminUser.name,
        email: req.adminUser.email,
        roles: req.adminRoles.map(
          (role) => role.name
        ),
        isSuperAdmin: req.isSuperAdmin,
      },
    });
  }
);

// =====================================================
// STATS
// =====================================================

app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM public.inventory)::int AS inventory,
        (SELECT COUNT(*) FROM public.facilities)::int AS facilities,
        (SELECT COUNT(*) FROM public.borrowings)::int AS borrowings
    `);

    res.json({
      ok: true,
      data: {
        ...result.rows[0],
        active: 0,
      },
    });
  } catch (error) {
    console.error('[STATS] error:', error);

    res.status(500).json({
      ok: false,
      message: 'Gagal mengambil statistik',
    });
  }
});

// =====================================================
// STORAGE STATUS
// =====================================================

app.get('/api/storage-status', (req, res) => {
  const configured = Boolean(
    process.env.GOOGLE_APPS_SCRIPT_URL &&
    process.env.GOOGLE_APPS_SCRIPT_TOKEN
  );

  res.json({
    ok: true,
    provider: 'google-drive',
    configured,
  });
});


// =====================================================
// PROPOSALS PUBLIC
// Data disimpan di PostgreSQL, dokumen di Google Drive.
// =====================================================

app.get(
  '/api/proposals',
  requireAuth,
  async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        activity_name,
        organization,
        proposer_name,
        proposer_email,
        proposer_phone,
        event_date,
        event_location,
        description,
        document_url,
        document_name,
        status,
        admin_notes,
        reviewed_by,
        reviewed_at,
        created_at
      FROM public.proposals
      ORDER BY created_at DESC
    `);

    res.json({
      ok: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('[PROPOSALS] GET error:', error);

    res.status(500).json({
      ok: false,
      message: 'Gagal memuat proposal',
    });
  }
});

app.post(
  '/api/proposals',
  publicWriteLimiter,
  async (req, res) => {
  try {
    const activityName = String(req.body?.activity_name ?? '').trim();
    const proposerName = String(req.body?.proposer_name ?? '').trim();

    if (!activityName || !proposerName) {
      return res.status(400).json({
        ok: false,
        message: 'Nama kegiatan dan nama pengaju wajib diisi',
      });
    }

    const result = await pool.query(
      `
        INSERT INTO public.proposals (
          activity_name,
          organization,
          proposer_name,
          proposer_email,
          proposer_phone,
          event_date,
          event_location,
          description,
          document_url,
          document_name,
          status
        )
        VALUES (
          $1, $2, $3, $4, $5,
          NULLIF($6, '')::date,
          $7, $8, $9, $10, $11
        )
        RETURNING *
      `,
      [
        activityName,
        String(req.body?.organization ?? '').trim(),
        proposerName,
        String(req.body?.proposer_email ?? '').trim(),
        String(req.body?.proposer_phone ?? '').trim(),
        String(req.body?.event_date ?? '').trim(),
        String(req.body?.event_location ?? '').trim(),
        String(req.body?.description ?? '').trim(),
        String(req.body?.document_url ?? '').trim(),
        String(req.body?.document_name ?? '').trim(),
        String(req.body?.status ?? 'pending').trim() || 'pending',
      ]
    );

    res.status(201).json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[PROPOSALS] POST error:', error);

    res.status(500).json({
      ok: false,
      message: 'Gagal menyimpan proposal',
    });
  }
});


// =====================================================
// ORGANIZATIONS PUBLIC
// =====================================================

app.get('/api/organizations', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM public.organizations
      ORDER BY "order" ASC
    `);

    res.json({
      ok: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      '[ORGANIZATIONS] GET error:',
      error
    );

    res.status(500).json({
      ok: false,
      message: 'Gagal mengambil data organisasi',
    });
  }
});

// =====================================================
// ABOUT PUBLIC
// =====================================================

app.get('/api/about', async (req, res) => {
  try {
    const [settingsResult, teamResult] =
      await Promise.all([
        pool.query(`
          SELECT
            id,
            section,
            content
          FROM public.about_settings
        `),

        pool.query(`
          SELECT
            id,
            name,
            position,
            role,
            photo_url,
            description,
            email,
            phone
          FROM public.team_members
          WHERE is_active = true
          ORDER BY "order" ASC
        `),
      ]);

    res.json({
      ok: true,
      data: {
        settings: settingsResult.rows,
        team: teamResult.rows,
      },
    });
  } catch (error) {
    console.error(
      '[ABOUT] GET error:',
      error
    );

    res.status(500).json({
      ok: false,
      message:
        'Gagal mengambil data halaman tentang',
    });
  }
});

// =====================================================
// AGENDA PUBLIC SUBMISSION
// =====================================================

// Buat agenda dari halaman user
app.post(
  '/api/agendas',
  publicWriteLimiter,
  async (req, res) => {
  try {
    const {
      title,
      jenis_kegiatan,
      organisasi_jurusan,
      penanggung_jawab,
      email,
      contact_phone,
      location,
      event_date,
      end_date,
      start_time,
      end_time,
      description,
    } = req.body;

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      !event_date ||
      !end_date
    ) {
      return res.status(400).json({
        ok: false,
        message: 'Judul, tanggal mulai, dan tanggal selesai wajib diisi',
      });
    }

    if (end_date < event_date) {
      return res.status(400).json({
        ok: false,
        message: 'Tanggal selesai tidak boleh sebelum tanggal mulai',
      });
    }

    const result = await pool.query(
      `
        INSERT INTO public.agendas (
          title,
          jenis_kegiatan,
          organisasi_jurusan,
          penanggung_jawab,
          email,
          contact_phone,
          surat_url,
          location,
          event_date,
          end_date,
          start_time,
          end_time,
          description,
          status,
          penyelenggara,
          jumlah_peserta,
          category
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17
        )
        RETURNING id
      `,
      [
        title.trim(),
        jenis_kegiatan || null,
        organisasi_jurusan?.trim() || null,
        penanggung_jawab?.trim() || null,
        email?.trim() || null,
        contact_phone?.trim() || null,
        null,
        location?.trim() || null,
        event_date,
        end_date || null,
        start_time || null,
        end_time || null,
        description?.trim() || null,
        'scheduled',
        organisasi_jurusan?.trim() || null,
        0,
        jenis_kegiatan || null,
      ]
    );

    res.status(201).json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      '[AGENDA PUBLIC] POST error:',
      error
    );

    res.status(500).json({
      ok: false,
      message: 'Gagal membuat agenda',
    });
  }
});


// Setelah file masuk Supabase Storage,
// simpan URL lampiran ke PostgreSQL
app.patch(
  '/api/agendas/:id/surat-url',
  publicWriteLimiter,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { surat_url } = req.body;

      if (
        typeof surat_url !== 'string' ||
        !surat_url.trim()
      ) {
        return res.status(400).json({
          ok: false,
          message: 'URL surat tidak valid',
        });
      }

      const result = await pool.query(
        `
          UPDATE public.agendas
          SET surat_url = $1
          WHERE id = $2
          RETURNING id, surat_url
        `,
        [
          surat_url.trim(),
          id,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Agenda tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[AGENDA PUBLIC] SURAT URL error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal menyimpan URL lampiran',
      });
    }
  }
);

// =====================================================
// DAMAGE REPORTS - PUBLIC
// =====================================================

// Ambil 5 laporan terakhir berdasarkan email pelapor
app.get(
  '/api/reports/recent',
  async (req, res) => {
  try {
    const email = String(req.query.email || '').trim();

    if (!email) {
      return res.status(400).json({
        ok: false,
        message: 'Email wajib diisi',
      });
    }

    const result = await pool.query(
      `
        SELECT
          id,
          reporter_name,
          description,
          location,
          severity,
          status,
          image_url,
          created_at
        FROM public.damage_reports
        WHERE LOWER(reporter_email) = LOWER($1)
        ORDER BY created_at DESC
        LIMIT 5
      `,
      [email]
    );

    res.json({
      ok: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      '[REPORTS PUBLIC] recent error:',
      error
    );

    res.status(500).json({
      ok: false,
      message: 'Gagal mengambil riwayat laporan',
    });
  }
});


// Kirim laporan kerusakan
app.post(
  '/api/reports',
  publicWriteLimiter,
  async (req, res) => {
  try {
    const {
      reporter_name,
      reporter_email,
      reporter_unit,
      reporter_phone,
      description,
      location,
      severity,
      image_url,
    } = req.body;

    if (
      typeof reporter_name !== 'string' ||
      !reporter_name.trim() ||
      typeof reporter_email !== 'string' ||
      !reporter_email.trim() ||
      typeof reporter_unit !== 'string' ||
      !reporter_unit.trim() ||
      typeof description !== 'string' ||
      !description.trim() ||
      typeof location !== 'string' ||
      !location.trim() ||
      typeof image_url !== 'string' ||
      !image_url.trim()
    ) {
      return res.status(400).json({
        ok: false,
        message: 'Data laporan dan foto bukti wajib diisi',
      });
    }

    const allowedSeverities = [
      'minor',
      'moderate',
      'severe',
    ];

    if (!allowedSeverities.includes(severity)) {
      return res.status(400).json({
        ok: false,
        message: 'Tingkat kerusakan tidak valid',
      });
    }

    const result = await pool.query(
      `
        INSERT INTO public.damage_reports (
          reporter_name,
          reporter_email,
          reporter_unit,
          reporter_phone,
          description,
          location,
          severity,
          image_url,
          status
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, 'pending'
        )
        RETURNING id, created_at
      `,
      [
        reporter_name.trim(),
        reporter_email.trim(),
        reporter_unit.trim(),
        reporter_phone?.trim() || null,
        description.trim(),
        location.trim(),
        severity,
        image_url || null,
      ]
    );

    res.status(201).json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      '[REPORTS PUBLIC] POST error:',
      error
    );

    res.status(500).json({
      ok: false,
      message: 'Gagal mengirim laporan kerusakan',
    });
  }
});

// =====================================================
// APPROVER EMAILS ADMIN
// =====================================================

// Ambil daftar email approver
app.get(
  '/api/admin/approver-emails',
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          role_id,
          role_name,
          approver_email,
          approver_name,
          is_active,
          created_at,
          updated_at
        FROM public.role_approver_emails
        ORDER BY role_name ASC
      `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[APPROVER EMAILS] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memuat email approver',
      });
    }
  }
);


// Ambil role aktif
app.get(
  '/api/admin/approver-email-roles',
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          name
        FROM public.roles
        WHERE COALESCE(is_active, true) = true
        ORDER BY level DESC
      `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[APPROVER EMAILS] ROLES error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memuat role',
      });
    }
  }
);


// Tambah email approver
app.post(
  '/api/admin/approver-emails',
  requireAdmin,
  requirePermission(
    'approver_emails',
    'create'
  ),
  async (req, res) => {
    try {
      const {
        role_id,
        approver_email,
        approver_name,
        is_active,
      } = req.body;

      if (!role_id) {
        return res.status(400).json({
          ok: false,
          message: 'Role wajib dipilih',
        });
      }

      if (
        typeof approver_email !== 'string' ||
        !approver_email.trim()
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Email approver wajib diisi',
        });
      }

      if (
        typeof approver_name !== 'string' ||
        !approver_name.trim()
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Nama approver wajib diisi',
        });
      }

      const roleResult = await pool.query(
        `
          SELECT id, name
          FROM public.roles
          WHERE id = $1
            AND COALESCE(is_active, true) = true
          LIMIT 1
        `,
        [role_id]
      );

      if (roleResult.rowCount === 0) {
        return res.status(400).json({
          ok: false,
          message: 'Role tidak ditemukan atau tidak aktif',
        });
      }

      const role =
        roleResult.rows[0];

      const result = await pool.query(
        `
          INSERT INTO public.role_approver_emails (
            role_id,
            role_name,
            approver_email,
            approver_name,
            is_active
          )
          VALUES (
            $1, $2, $3, $4, $5
          )
          RETURNING *
        `,
        [
          role.id,
          role.name,
          approver_email.trim(),
          approver_name.trim(),
          is_active !== false,
        ]
      );

      res.status(201).json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[APPROVER EMAILS] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menambahkan email approver',
      });
    }
  }
);


// Update email approver
app.patch(
  '/api/admin/approver-emails/:id',
  requireAdmin,
  requirePermission(
    'approver_emails',
    'update'
  ),
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        role_id,
        approver_email,
        approver_name,
        is_active,
      } = req.body;

      if (!role_id) {
        return res.status(400).json({
          ok: false,
          message: 'Role wajib dipilih',
        });
      }

      if (
        typeof approver_email !== 'string' ||
        !approver_email.trim()
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Email approver wajib diisi',
        });
      }

      if (
        typeof approver_name !== 'string' ||
        !approver_name.trim()
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Nama approver wajib diisi',
        });
      }

      const roleResult = await pool.query(
        `
          SELECT id, name
          FROM public.roles
          WHERE id = $1
            AND COALESCE(is_active, true) = true
          LIMIT 1
        `,
        [role_id]
      );

      if (roleResult.rowCount === 0) {
        return res.status(400).json({
          ok: false,
          message: 'Role tidak ditemukan atau tidak aktif',
        });
      }

      const role =
        roleResult.rows[0];

      const result = await pool.query(
        `
          UPDATE public.role_approver_emails
          SET
            role_id = $1,
            role_name = $2,
            approver_email = $3,
            approver_name = $4,
            is_active = $5,
            updated_at = NOW()
          WHERE id = $6
          RETURNING *
        `,
        [
          role.id,
          role.name,
          approver_email.trim(),
          approver_name.trim(),
          is_active !== false,
          id,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Email approver tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[APPROVER EMAILS] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memperbarui email approver',
      });
    }
  }
);


// Hapus email approver
app.delete(
  '/api/admin/approver-emails/:id',
  requireAdmin,
  requirePermission(
    'approver_emails',
    'delete'
  ),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
          DELETE FROM public.role_approver_emails
          WHERE id = $1
          RETURNING id
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Email approver tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        message: 'Email approver berhasil dihapus',
      });
    } catch (error) {
      console.error(
        '[APPROVER EMAILS] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menghapus email approver',
      });
    }
  }
);

// =====================================================
// ANNOUNCEMENTS ADMIN
// =====================================================

// Ambil semua pengumuman
app.get(
  '/api/admin/announcements',
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          title,
          description,
          priority,
          status,
          published_at,
          created_at,
          updated_at,
          author,
          image_url
        FROM public.announcements
        ORDER BY created_at DESC
      `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[ANNOUNCEMENTS] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memuat pengumuman',
      });
    }
  }
);


// Tambah pengumuman
app.post(
  '/api/admin/announcements',
  requireAdmin,
  requirePermission(
    'announcements',
    'create'
  ),
  async (req, res) => {
    try {
      const {
        title,
        description,
        priority,
        status,
        author,
        image_url,
      } = req.body;

      if (
        typeof title !== 'string' ||
        !title.trim()
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Judul wajib diisi',
        });
      }

      const allowedPriorities = [
        'low',
        'normal',
        'high',
        'urgent',
      ];

      const allowedStatuses = [
        'draft',
        'published',
        'archived',
      ];

      if (
        !allowedPriorities.includes(priority)
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Prioritas tidak valid',
        });
      }

      if (
        !allowedStatuses.includes(status)
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Status tidak valid',
        });
      }

      const publishedAt =
        status === 'published'
          ? new Date()
          : null;

      const result = await pool.query(
        `
          INSERT INTO public.announcements (
            title,
            description,
            priority,
            status,
            published_at,
            author,
            image_url
          )
          VALUES (
            $1, $2, $3, $4,
            $5, $6, $7
          )
          RETURNING *
        `,
        [
          title.trim(),
          description?.trim() || null,
          priority,
          status,
          publishedAt,
          author?.trim() || null,
          image_url || null,
        ]
      );

      res.status(201).json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[ANNOUNCEMENTS] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menambahkan pengumuman',
      });
    }
  }
);


// Update pengumuman
app.patch(
  '/api/admin/announcements/:id',
  requireAdmin,
  requirePermission(
    'announcements',
    'update'
  ),
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        title,
        description,
        priority,
        status,
        author,
        image_url,
      } = req.body;

      if (
        typeof title !== 'string' ||
        !title.trim()
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Judul wajib diisi',
        });
      }

      const allowedPriorities = [
        'low',
        'normal',
        'high',
        'urgent',
      ];

      const allowedStatuses = [
        'draft',
        'published',
        'archived',
      ];

      if (
        !allowedPriorities.includes(priority)
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Prioritas tidak valid',
        });
      }

      if (
        !allowedStatuses.includes(status)
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Status tidak valid',
        });
      }

      const publishedAt =
        status === 'published'
          ? new Date()
          : null;

      const result = await pool.query(
        `
          UPDATE public.announcements
          SET
            title = $1,
            description = $2,
            priority = $3,
            status = $4,
            published_at = $5,
            author = $6,
            image_url = $7,
            updated_at = NOW()
          WHERE id = $8
          RETURNING *
        `,
        [
          title.trim(),
          description?.trim() || null,
          priority,
          status,
          publishedAt,
          author?.trim() || null,
          image_url || null,
          id,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Pengumuman tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[ANNOUNCEMENTS] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memperbarui pengumuman',
      });
    }
  }
);


// Hapus pengumuman
app.delete(
  '/api/admin/announcements/:id',
  requireAdmin,
  requirePermission(
    'announcements',
    'delete'
  ),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
          DELETE FROM public.announcements
          WHERE id = $1
          RETURNING id
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Pengumuman tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        message: 'Pengumuman berhasil dihapus',
      });
    } catch (error) {
      console.error(
        '[ANNOUNCEMENTS] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menghapus pengumuman',
      });
    }
  }
);

// =====================================================
// LANDING PAGE DASHBOARD
// =====================================================

app.get('/api/landing-dashboard', async (req, res) => {
  try {
    const [statsResult, announcementsResult] =
      await Promise.all([
        pool.query(`
          SELECT
            (SELECT COUNT(*) FROM public.inventory)::int
              AS inventory,

            (SELECT COUNT(*) FROM public.facilities)::int
              AS facilities,

            (SELECT COUNT(*) FROM public.agendas)::int
              AS agendas
        `),

        pool.query(`
          SELECT
            id,
            title,
            description,
            priority,
            created_at,
            image_url
          FROM public.announcements
          WHERE status = 'published'
          ORDER BY created_at DESC
          LIMIT 5
        `),
      ]);

    res.json({
      ok: true,

      data: {
        stats: statsResult.rows[0],

        announcements:
          announcementsResult.rows,
      },
    });
  } catch (error) {
    console.error(
      '[LANDING DASHBOARD] error:',
      error
    );

    res.status(500).json({
      ok: false,
      message:
        'Gagal memuat dashboard halaman utama',
    });
  }
});

// =====================================================
// SYSTEM SETTINGS - SUPER ADMIN
// =====================================================

function requireSuperAdminAccess(req, res, next) {
  if (!req.isSuperAdmin) {
    return res.status(403).json({
      ok: false,
      message: 'Akses ini hanya untuk Super Admin',
    });
  }

  next();
}


// =====================================================
// SYSTEM SETTINGS
// =====================================================

// Ambil semua setting
app.get(
  '/api/admin/system-settings',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          key,
          value
        FROM public.system_settings
        ORDER BY key ASC
      `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[SYSTEM SETTINGS] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memuat pengaturan',
      });
    }
  }
);


// Update satu bagian setting
app.patch(
  '/api/admin/system-settings/:key',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;

      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value)
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Data pengaturan tidak valid',
        });
      }

      const result = await pool.query(
        `
          UPDATE public.system_settings
          SET
            value = $1,
            updated_by = $2,
            updated_at = NOW()
          WHERE key = $3
          RETURNING key, value
        `,
        [
          value,
          req.adminUser.id,
          key,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Pengaturan tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[SYSTEM SETTINGS] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menyimpan pengaturan',
      });
    }
  }
);


// =====================================================
// SYSTEM SETTINGS - ANNOUNCEMENTS
// =====================================================

// Dibikin terpisah supaya edit dari SystemSettings
// tidak menghapus image_url / author yang sudah ada.

app.get(
  '/api/admin/system-settings/announcements/all',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          title,
          description,
          priority,
          status,
          published_at,
          created_at
        FROM public.announcements
        ORDER BY created_at DESC
      `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[SYSTEM SETTINGS ANNOUNCEMENTS] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memuat pengumuman',
      });
    }
  }
);


app.post(
  '/api/admin/system-settings/announcements',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const {
        title,
        description,
        priority,
        status,
      } = req.body;

      if (
        typeof title !== 'string' ||
        !title.trim()
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Judul wajib diisi',
        });
      }

      const allowedPriorities = [
        'low',
        'normal',
        'high',
        'urgent',
      ];

      const allowedStatuses = [
        'draft',
        'published',
        'archived',
      ];

      if (!allowedPriorities.includes(priority)) {
        return res.status(400).json({
          ok: false,
          message: 'Prioritas tidak valid',
        });
      }

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          ok: false,
          message: 'Status tidak valid',
        });
      }

      const result = await pool.query(
        `
          INSERT INTO public.announcements (
            title,
            description,
            priority,
            status,
            published_at
          )
          VALUES (
            $1, $2, $3, $4,
            CASE
              WHEN $4 = 'published'
              THEN NOW()
              ELSE NULL
            END
          )
          RETURNING *
        `,
        [
          title.trim(),
          description?.trim() || null,
          priority,
          status,
        ]
      );

      res.status(201).json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[SYSTEM SETTINGS ANNOUNCEMENTS] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menambah pengumuman',
      });
    }
  }
);


app.patch(
  '/api/admin/system-settings/announcements/:id',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        title,
        description,
        priority,
        status,
      } = req.body;

      if (
        typeof title !== 'string' ||
        !title.trim()
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Judul wajib diisi',
        });
      }

      const allowedPriorities = [
        'low',
        'normal',
        'high',
        'urgent',
      ];

      const allowedStatuses = [
        'draft',
        'published',
        'archived',
      ];

      if (!allowedPriorities.includes(priority)) {
        return res.status(400).json({
          ok: false,
          message: 'Prioritas tidak valid',
        });
      }

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          ok: false,
          message: 'Status tidak valid',
        });
      }

      const result = await pool.query(
        `
          UPDATE public.announcements
          SET
            title = $1,
            description = $2,
            priority = $3,
            status = $4,
            published_at =
              CASE
                WHEN $4 = 'published'
                  AND published_at IS NULL
                THEN NOW()

                WHEN $4 <> 'published'
                THEN NULL

                ELSE published_at
              END,
            updated_at = NOW()
          WHERE id = $5
          RETURNING *
        `,
        [
          title.trim(),
          description?.trim() || null,
          priority,
          status,
          id,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Pengumuman tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[SYSTEM SETTINGS ANNOUNCEMENTS] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memperbarui pengumuman',
      });
    }
  }
);


app.patch(
  '/api/admin/system-settings/announcements/:id/status',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (
        ![
          'draft',
          'published',
          'archived',
        ].includes(status)
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Status tidak valid',
        });
      }

      const result = await pool.query(
        `
          UPDATE public.announcements
          SET
            status = $1,
            published_at =
              CASE
                WHEN $1 = 'published'
                THEN NOW()
                ELSE NULL
              END,
            updated_at = NOW()
          WHERE id = $2
          RETURNING *
        `,
        [
          status,
          id,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Pengumuman tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[SYSTEM SETTINGS ANNOUNCEMENTS] STATUS error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal mengubah status pengumuman',
      });
    }
  }
);


app.delete(
  '/api/admin/system-settings/announcements/:id',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
          DELETE FROM public.announcements
          WHERE id = $1
          RETURNING id
        `,
        [req.params.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Pengumuman tidak ditemukan',
        });
      }

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        '[SYSTEM SETTINGS ANNOUNCEMENTS] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menghapus pengumuman',
      });
    }
  }
);


// =====================================================
// SYSTEM BANNERS
// =====================================================

app.get(
  '/api/admin/system-settings/banners/all',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT *
        FROM public.system_banners
        ORDER BY sort_order ASC
      `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[SYSTEM BANNERS] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memuat banner',
      });
    }
  }
);


app.post(
  '/api/admin/system-settings/banners',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const {
        title,
        image_url,
        link_url,
        sort_order,
        is_active,
      } = req.body;

      if (
        typeof title !== 'string' ||
        !title.trim()
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Judul banner wajib diisi',
        });
      }

      const result = await pool.query(
        `
          INSERT INTO public.system_banners (
            title,
            image_url,
            link_url,
            sort_order,
            is_active
          )
          VALUES (
            $1, $2, $3, $4, $5
          )
          RETURNING *
        `,
        [
          title.trim(),
          image_url || null,
          link_url || null,
          Number(sort_order) || 0,
          is_active !== false,
        ]
      );

      res.status(201).json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[SYSTEM BANNERS] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menambahkan banner',
      });
    }
  }
);


app.patch(
  '/api/admin/system-settings/banners/:id',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const {
        title,
        image_url,
        link_url,
        sort_order,
        is_active,
      } = req.body;

      if (
        typeof title !== 'string' ||
        !title.trim()
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Judul banner wajib diisi',
        });
      }

      const result = await pool.query(
        `
          UPDATE public.system_banners
          SET
            title = $1,
            image_url = $2,
            link_url = $3,
            sort_order = $4,
            is_active = $5,
            updated_at = NOW()
          WHERE id = $6
          RETURNING *
        `,
        [
          title.trim(),
          image_url || null,
          link_url || null,
          Number(sort_order) || 0,
          is_active !== false,
          req.params.id,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Banner tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[SYSTEM BANNERS] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memperbarui banner',
      });
    }
  }
);


app.delete(
  '/api/admin/system-settings/banners/:id',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
          DELETE FROM public.system_banners
          WHERE id = $1
          RETURNING id
        `,
        [req.params.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Banner tidak ditemukan',
        });
      }

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        '[SYSTEM BANNERS] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal menghapus banner',
      });
    }
  }
);


// =====================================================
// BACKUP / EXPORT
// =====================================================

const SYSTEM_EXPORT_TABLES = [
  'inventory',
  'facilities',
  'borrowings',
  'announcements',
  'kavling',
];

app.get(
  '/api/admin/system-settings/export/:table',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const table =
        String(req.params.table);

      if (
        !SYSTEM_EXPORT_TABLES.includes(
          table
        )
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Tabel tidak diizinkan untuk diexport',
        });
      }

      // Aman karena table berasal dari whitelist di atas.
      const result = await pool.query(
        `SELECT * FROM public."${table}"`
      );

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[SYSTEM EXPORT] error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal export data',
      });
    }
  }
);


app.get(
  '/api/admin/system-settings/backup',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const dump = {};

      for (
        const table
        of SYSTEM_EXPORT_TABLES
      ) {
        const result =
          await pool.query(
            `SELECT * FROM public."${table}"`
          );

        dump[table] =
          result.rows;
      }

      res.json({
        ok: true,
        data: dump,
      });
    } catch (error) {
      console.error(
        '[SYSTEM BACKUP] error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal membuat backup database',
      });
    }
  }
);


// =====================================================
// AUDIT STATS
// =====================================================

app.get(
  '/api/admin/system-settings/audit-stats',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM public.admin_users)::int
            AS user_count,

          (SELECT COUNT(*) FROM public.inventory)::int
            AS inventory_count,

          (SELECT COUNT(*) FROM public.facilities)::int
            AS facility_count,

          (SELECT COUNT(*) FROM public.borrowings)::int
            AS borrowing_count
      `);

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[SYSTEM AUDIT] error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memuat statistik audit',
      });
    }
  }
);

// =====================================================
// AUTH CONTEXT BOOTSTRAP
// =====================================================

app.get(
  '/api/auth/context',
  requireAdmin,
  async (req, res) => {
    try {
      const permissionsResult = await pool.query(
        `
          SELECT DISTINCT
            p.module,
            p.action
          FROM public.admin_user_roles aur
          INNER JOIN public.roles r
            ON r.id = aur.role_id
          INNER JOIN public.role_permissions rp
            ON rp.role_id = r.id
          INNER JOIN public.permissions p
            ON p.id = rp.permission_id
          WHERE aur.admin_user_id = $1
            AND COALESCE(r.is_active, true) = true
          ORDER BY p.module, p.action
        `,
        [req.adminUser.id]
      );

      res.json({
        ok: true,

        data: {
          adminProfile: req.adminUser,

          roles: req.adminRoles,

          permissions:
            permissionsResult.rows,

          isSuperAdmin:
            req.isSuperAdmin,
        },
      });
    } catch (error) {
      console.error(
        '[AUTH CONTEXT] error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat data akun admin',
      });
    }
  }
);

// =====================================================
// PUBLIC WORKFLOW API
// =====================================================

// Workflow default:
// workflow aktif paling awal dibuat
app.get(
  '/api/workflows/default',
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          name,
          description,
          is_active,
          item_type,
          created_at,
          updated_at
        FROM public.workflow_templates
        WHERE is_active = true
        ORDER BY created_at ASC
        LIMIT 1
      `);

      res.json({
        ok: true,
        data: result.rows[0] ?? null,
      });
    } catch (error) {
      console.error(
        '[WORKFLOW] DEFAULT error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memuat workflow default',
      });
    }
  }
);


// Workflow berdasarkan jenis item
app.get(
  '/api/workflows/item-type/:itemType',
  async (req, res) => {
    try {
      const { itemType } = req.params;

      const allowedItemTypes = [
        'barang',
        'fasilitas',
        'lainnya',
      ];

      if (
        !allowedItemTypes.includes(
          itemType
        )
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Jenis item tidak valid',
        });
      }

      const result = await pool.query(
        `
          SELECT
            id,
            name,
            description,
            is_active,
            item_type,
            created_at,
            updated_at
          FROM public.workflow_templates
          WHERE is_active = true
            AND item_type = $1
          ORDER BY created_at ASC
          LIMIT 1
        `,
        [itemType]
      );

      res.json({
        ok: true,
        data: result.rows[0] ?? null,
      });
    } catch (error) {
      console.error(
        '[WORKFLOW] ITEM TYPE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat workflow berdasarkan jenis item',
      });
    }
  }
);


// Step workflow
app.get(
  '/api/workflows/:templateId/steps',
  async (req, res) => {
    try {
      const {
        templateId,
      } = req.params;

      const result = await pool.query(
        `
          SELECT
            id,
            workflow_template_id,
            step_order,
            role_id,
            step_label,
            is_info_only,
            created_at
          FROM public.workflow_steps
          WHERE workflow_template_id = $1
          ORDER BY step_order ASC
        `,
        [templateId]
      );

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[WORKFLOW] STEPS error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memuat langkah workflow',
      });
    }
  }
);


// Workflow "Lainnya"
// Sengaja tidak filter is_active agar sama seperti kode lama
app.get(
  '/api/workflows/lainnya/template',
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          name,
          description,
          is_active,
          item_type,
          created_at,
          updated_at
        FROM public.workflow_templates
        WHERE name = 'Workflow Lainnya'
        LIMIT 1
      `);

      res.json({
        ok: true,
        data: result.rows[0] ?? null,
      });
    } catch (error) {
      console.error(
        '[WORKFLOW] LAINNYA error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memuat Workflow Lainnya',
      });
    }
  }
);


// Workflow berdasarkan nama
app.get(
  '/api/workflows/by-name',
  async (req, res) => {
    try {
      const name =
        String(
          req.query.name ?? ''
        ).trim();

      if (!name) {
        return res.status(400).json({
          ok: false,
          message: 'Nama workflow wajib diisi',
        });
      }

      const result = await pool.query(
        `
          SELECT
            id,
            name,
            description,
            is_active,
            item_type,
            created_at,
            updated_at
          FROM public.workflow_templates
          WHERE name = $1
            AND is_active = true
          LIMIT 1
        `,
        [name]
      );

      res.json({
        ok: true,
        data: result.rows[0] ?? null,
      });
    } catch (error) {
      console.error(
        '[WORKFLOW] BY NAME error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat workflow berdasarkan nama',
      });
    }
  }
);

// =====================================================
// ADMIN - APPROVAL WORKFLOW
// =====================================================

// Ambil semua workflow + steps + role aktif
app.get(
  '/api/admin/workflows',
  requireAdmin,
  async (req, res) => {
    try {
      const [
        templatesResult,
        stepsResult,
        rolesResult,
      ] = await Promise.all([
        pool.query(`
          SELECT
            id,
            name,
            description,
            is_active,
            item_type,
            created_at,
            updated_at
          FROM public.workflow_templates
          ORDER BY created_at DESC
        `),

        pool.query(`
          SELECT
            ws.id,
            ws.workflow_template_id,
            ws.step_order,
            ws.role_id,
            ws.step_label,
            ws.is_info_only,
            ws.created_at,
            CASE
              WHEN r.is_active = true THEN r.name
              ELSE NULL
            END AS role_name
          FROM public.workflow_steps ws
          LEFT JOIN public.roles r
            ON r.id = ws.role_id
          ORDER BY
            ws.workflow_template_id,
            ws.step_order ASC
        `),

        pool.query(`
          SELECT
            id,
            name
          FROM public.roles
          WHERE is_active = true
          ORDER BY name ASC
        `),
      ]);

      res.json({
        ok: true,
        data: {
          templates: templatesResult.rows,
          steps: stepsResult.rows,
          roles: rolesResult.rows,
        },
      });
    } catch (error) {
      console.error(
        '[ADMIN WORKFLOWS] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message: 'Gagal memuat workflow',
      });
    }
  }
);


// =====================================================
// CREATE WORKFLOW + STEPS
// =====================================================

app.post(
  '/api/admin/workflows',
  requireAdmin,
  requirePermission('workflows', 'manage'),
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const {
        name,
        description,
        item_type,
        steps,
      } = req.body ?? {};

      const cleanName =
        String(name ?? '').trim();

      const cleanDescription =
        String(
          description ?? ''
        ).trim();

      const cleanItemType =
        item_type
          ? String(item_type)
          : null;

      const allowedItemTypes = [
        'barang',
        'fasilitas',
        'lainnya',
      ];

      if (!cleanName) {
        return res.status(400).json({
          ok: false,
          message:
            'Nama workflow wajib diisi',
        });
      }

      if (
        cleanItemType &&
        !allowedItemTypes.includes(
          cleanItemType
        )
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Tipe item tidak valid',
        });
      }

      if (!Array.isArray(steps)) {
        return res.status(400).json({
          ok: false,
          message:
            'Langkah workflow tidak valid',
        });
      }

      const validSteps =
        steps.filter((step) =>
          String(
            step?.step_label ?? ''
          ).trim()
        );

      if (
        validSteps.length === 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Minimal satu langkah diperlukan',
        });
      }

      await client.query('BEGIN');

      const templateResult =
        await client.query(
          `
            INSERT INTO public.workflow_templates (
              name,
              description,
              is_active,
              item_type
            )
            VALUES (
              $1,
              $2,
              true,
              $3
            )
            RETURNING
              id,
              name,
              description,
              is_active,
              item_type,
              created_at,
              updated_at
          `,
          [
            cleanName,
            cleanDescription ||
              null,
            cleanItemType,
          ]
        );

      const template =
        templateResult.rows[0];

      for (
        let i = 0;
        i < validSteps.length;
        i += 1
      ) {
        const step =
          validSteps[i];

        const roleId =
          step.role_id
            ? String(
                step.role_id
              )
            : null;

        const stepLabel =
          String(
            step.step_label
          ).trim();

        const isInfoOnly =
          step.is_info_only ===
          true;

        await client.query(
          `
            INSERT INTO public.workflow_steps (
              workflow_template_id,
              step_order,
              role_id,
              step_label,
              is_info_only
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5
            )
          `,
          [
            template.id,
            i + 1,
            roleId,
            stepLabel,
            isInfoOnly,
          ]
        );
      }

      await client.query(
        'COMMIT'
      );

      res.status(201).json({
        ok: true,
        data: template,
      });
    } catch (error) {
      await client.query(
        'ROLLBACK'
      );

      console.error(
        '[ADMIN WORKFLOWS] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal membuat workflow',
      });
    } finally {
      client.release();
    }
  }
);


// =====================================================
// AKTIF / NONAKTIF WORKFLOW
// =====================================================

app.patch(
  '/api/admin/workflows/:id/status',
  requireAdmin,
  requirePermission('workflows', 'manage'),
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      const {
        is_active,
      } = req.body ?? {};

      if (
        typeof is_active !==
        'boolean'
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Status workflow tidak valid',
        });
      }

      const result =
        await pool.query(
          `
            UPDATE public.workflow_templates
            SET
              is_active = $1,
              updated_at = NOW()
            WHERE id = $2
            RETURNING
              id,
              name,
              description,
              is_active,
              item_type,
              created_at,
              updated_at
          `,
          [
            is_active,
            id,
          ]
        );

      if (
        result.rowCount === 0
      ) {
        return res.status(404).json({
          ok: false,
          message:
            'Workflow tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[ADMIN WORKFLOWS] STATUS error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal mengubah status workflow',
      });
    }
  }
);


// =====================================================
// DELETE WORKFLOW + STEPS
// =====================================================

app.delete(
  '/api/admin/workflows/:id',
  requireAdmin,
  requirePermission('workflows', 'manage'),
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const {
        id,
      } = req.params;

      await client.query(
        'BEGIN'
      );

      await client.query(
        `
          DELETE FROM public.workflow_steps
          WHERE workflow_template_id = $1
        `,
        [id]
      );

      const result =
        await client.query(
          `
            DELETE FROM public.workflow_templates
            WHERE id = $1
            RETURNING id, name
          `,
          [id]
        );

      if (
        result.rowCount === 0
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(404).json({
          ok: false,
          message:
            'Workflow tidak ditemukan',
        });
      }

      await client.query(
        'COMMIT'
      );

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      await client.query(
        'ROLLBACK'
      );

      console.error(
        '[ADMIN WORKFLOWS] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal menghapus workflow',
      });
    } finally {
      client.release();
    }
  }
);

// =====================================================
// PUBLIC - CREATE BORROWING
// PostgreSQL transaction
// =====================================================

function escapeBorrowingEmailHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


app.post(
  '/api/borrowings',
  publicWriteLimiter,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const featureResult =
        await client.query(
          `
            SELECT value
            FROM public.system_config
            WHERE key =
              'public_borrowing_enabled'
            LIMIT 1
          `
        );

      const borrowingEnabled =
        featureResult.rows[0]
          ?.value === true;

      if (!borrowingEnabled) {
        return res
          .status(403)
          .json({
            ok: false,
            message:
              'Fitur peminjaman sedang disembunyikan oleh Super Admin',
          });
      }
      const {
        borrower_name,
        borrower_class,
        borrower_email,
        borrower_phone,
        borrow_date,
        return_date,
        start_time,
        end_time,
        purpose,
        notes,
        items,
      } = req.body ?? {};


      // =====================================================
      // BASIC VALIDATION
      // =====================================================

      const cleanName =
        String(borrower_name ?? '').trim();

      const cleanClass =
        String(borrower_class ?? '').trim();

      const cleanEmail =
        String(borrower_email ?? '')
          .trim()
          .toLowerCase();

      const cleanPhone =
        String(borrower_phone ?? '').trim();

      const cleanPurpose =
        String(purpose ?? '').trim();

      const cleanNotes =
        String(notes ?? '').trim();

      const cleanStartTime =
        String(start_time ?? '').trim();

      const cleanEndTime =
        String(end_time ?? '').trim();

      if (!cleanName) {
        return res.status(400).json({
          ok: false,
          message: 'Nama peminjam wajib diisi',
        });
      }

      if (!cleanClass) {
        return res.status(400).json({
          ok: false,
          message: 'Kelas/Unit wajib diisi',
        });
      }

      if (
        !cleanEmail ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Email tidak valid',
        });
      }

      if (!borrow_date) {
        return res.status(400).json({
          ok: false,
          message: 'Tanggal pinjam wajib diisi',
        });
      }

      if (!return_date) {
        return res.status(400).json({
          ok: false,
          message: 'Tanggal kembali wajib diisi',
        });
      }

      if (return_date < borrow_date) {
        return res.status(400).json({
          ok: false,
          message:
            'Tanggal kembali tidak boleh sebelum tanggal pinjam',
        });
      }

      if (
        !cleanStartTime ||
        !cleanEndTime
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Jam mulai dan jam selesai wajib diisi',
        });
      }

      if (
        !/^\d{2}:\d{2}(:\d{2})?$/.test(cleanStartTime) ||
        !/^\d{2}:\d{2}(:\d{2})?$/.test(cleanEndTime)
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Format jam peminjaman tidak valid',
        });
      }

      if (
        borrow_date === return_date &&
        cleanEndTime <= cleanStartTime
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Jam selesai harus setelah jam mulai',
        });
      }

      if (!cleanPurpose) {
        return res.status(400).json({
          ok: false,
          message: 'Tujuan peminjaman wajib diisi',
        });
      }

      if (
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Keranjang peminjaman kosong',
        });
      }

      if (items.length > 50) {
        return res.status(400).json({
          ok: false,
          message: 'Terlalu banyak item dalam satu pengajuan',
        });
      }


      // =====================================================
      // VALIDATE ITEMS AGAINST DATABASE
      // Jangan percaya nama / stok dari browser
      // =====================================================

      const normalizedItems = [];

      for (const rawItem of items) {
        const itemType =
          String(rawItem?.item_type ?? '');

        if (
          itemType !== 'barang' &&
          itemType !== 'fasilitas'
        ) {
          return res.status(400).json({
            ok: false,
            message: 'Jenis item tidak valid',
          });
        }

        const quantity =
          Number(rawItem?.quantity ?? 1);

        if (
          !Number.isInteger(quantity) ||
          quantity < 1
        ) {
          return res.status(400).json({
            ok: false,
            message: 'Jumlah item tidak valid',
          });
        }

        const inventoryId =
          rawItem?.inventory_id
            ? String(rawItem.inventory_id)
            : null;

        const facilityId =
          rawItem?.facility_id
            ? String(rawItem.facility_id)
            : null;


        // Tidak boleh inventory + facility sekaligus
        if (inventoryId && facilityId) {
          return res.status(400).json({
            ok: false,
            message:
              'Satu item tidak boleh menjadi barang dan fasilitas sekaligus',
          });
        }


        // ===================================================
        // INVENTORY
        // ===================================================

        if (inventoryId) {
          const invResult =
            await client.query(
              `
                SELECT
                  id,
                  name,
                  available_quantity,
                  condition
                FROM public.inventory
                WHERE id = $1
                LIMIT 1
              `,
              [inventoryId]
            );

          const inv =
            invResult.rows[0];

          if (!inv) {
            return res.status(400).json({
              ok: false,
              message:
                'Barang yang dipilih tidak ditemukan',
            });
          }

          const reservedResult =
            await client.query(
              `
                SELECT
                  COALESCE(
                    SUM(
                      bi.quantity
                    ),
                    0
                  )::int
                    AS reserved_quantity
                FROM public.borrowing_items bi
                INNER JOIN public.borrowings b
                  ON b.id = bi.borrowing_id
                WHERE bi.inventory_id = $1
                  AND b.status IN (
                    'pending',
                    'approved'
                  )
                  AND tsrange(
                    (
                      b.borrow_date +
                      COALESCE(
                        b.start_time,
                        TIME '00:00'
                      )
                    )::timestamp,
                    (
                      COALESCE(
                        b.return_date,
                        b.borrow_date
                      ) +
                      COALESCE(
                        b.end_time,
                        TIME '23:59:59'
                      )
                    )::timestamp,
                    '[)'
                  ) && tsrange(
                    (
                      $2::date +
                      $4::time
                    )::timestamp,
                    (
                      $3::date +
                      $5::time
                    )::timestamp,
                    '[)'
                  )
              `,
              [
                inventoryId,
                borrow_date,
                return_date,
                cleanStartTime,
                cleanEndTime,
              ]
            );

          const reservedQuantity =
            Number(
              reservedResult.rows[0]
                ?.reserved_quantity ??
                0
            );

          const effectiveAvailable =
            Number(
              inv.available_quantity ??
              0
            ) -
            reservedQuantity;

          if (
            effectiveAvailable <
            quantity
          ) {
            return res.status(409).json({
              ok: false,
              message:
                `Stok "${inv.name}" pada jadwal tersebut tidak mencukupi`,
            });
          }

          normalizedItems.push({
            inventory_id: inv.id,
            facility_id: null,
            item_type: 'barang',
            item_name: inv.name,
            quantity,
            department: null,
          });

          continue;
        }


        // ===================================================
        // FACILITY
        // ===================================================

        if (facilityId) {
          const facResult =
            await client.query(
              `
                SELECT
                  id,
                  name,
                  department
                FROM public.facilities
                WHERE id = $1
                LIMIT 1
              `,
              [facilityId]
            );

          const fac =
            facResult.rows[0];

          if (!fac) {
            return res.status(400).json({
              ok: false,
              message:
                'Fasilitas yang dipilih tidak ditemukan',
            });
          }

          const conflictResult =
            await client.query(
              `
                SELECT 1
                FROM public.borrowing_items bi
                INNER JOIN public.borrowings b
                  ON b.id = bi.borrowing_id
                WHERE bi.facility_id = $1
                  AND b.status IN ('pending', 'approved')
                  AND tsrange(
                    (
                      b.borrow_date +
                      COALESCE(
                        b.start_time,
                        TIME '00:00'
                      )
                    )::timestamp,
                    (
                      COALESCE(
                        b.return_date,
                        b.borrow_date
                      ) +
                      COALESCE(
                        b.end_time,
                        TIME '23:59:59'
                      )
                    )::timestamp,
                    '[)'
                  ) && tsrange(
                    (
                      $2::date +
                      $4::time
                    )::timestamp,
                    (
                      $3::date +
                      $5::time
                    )::timestamp,
                    '[)'
                  )
                LIMIT 1
              `,
              [
                facilityId,
                borrow_date,
                return_date,
                cleanStartTime,
                cleanEndTime,
              ]
            );

          if (
            conflictResult.rowCount >
            0
          ) {
            return res.status(409).json({
              ok: false,
              message:
                `Fasilitas "${fac.name}" sudah memiliki pengajuan pada jadwal tersebut`,
            });
          }

          normalizedItems.push({
            inventory_id: null,
            facility_id: fac.id,
            item_type: 'fasilitas',
            item_name: fac.name,
            quantity,
            department:
              fac.department ?? null,
          });

          continue;
        }


        // ===================================================
        // CUSTOM / "LAINNYA"
        // ===================================================

        const customName =
          String(rawItem?.item_name ?? '').trim();

        if (!customName) {
          return res.status(400).json({
            ok: false,
            message:
              'Nama item lainnya wajib diisi',
          });
        }

        normalizedItems.push({
          inventory_id: null,
          facility_id: null,
          item_type: itemType,
          item_name: customName,
          quantity,
          department: null,
        });
      }


      // =====================================================
      // DETERMINE WORKFLOW
      // Sama dengan logika BorrowPage lama
      // =====================================================

      const hasLainnya =
        normalizedItems.some(
          (item) =>
            !item.inventory_id &&
            !item.facility_id
        );

      const hasRegular =
        normalizedItems.some(
          (item) =>
            item.inventory_id ||
            item.facility_id
        );

      const hasBarang =
        normalizedItems.some(
          (item) =>
            Boolean(item.inventory_id)
        );

      const hasFasilitas =
        normalizedItems.some(
          (item) =>
            Boolean(item.facility_id)
        );

      if (
        hasBarang &&
        hasFasilitas
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Barang dan fasilitas tidak boleh dicampur dalam satu pengajuan',
        });
      }

      let workflow = null;


      // Hanya item custom/lainnya
      if (
        hasLainnya &&
        !hasRegular
      ) {
        const lainnyaActive =
          await client.query(`
            SELECT *
            FROM public.workflow_templates
            WHERE is_active = true
              AND item_type = 'lainnya'
            ORDER BY created_at ASC
            LIMIT 1
          `);

        workflow =
          lainnyaActive.rows[0] ?? null;

        // Sama seperti kode lama:
        // fallback Workflow Lainnya walaupun nonaktif
        if (!workflow) {
          const lainnyaFallback =
            await client.query(`
              SELECT *
              FROM public.workflow_templates
              WHERE name = 'Workflow Lainnya'
              LIMIT 1
            `);

          workflow =
            lainnyaFallback.rows[0] ?? null;
        }
      }


      // Barang saja
      else if (
        hasBarang &&
        !hasFasilitas
      ) {
        const result =
          await client.query(`
            SELECT *
            FROM public.workflow_templates
            WHERE is_active = true
              AND item_type = 'barang'
            ORDER BY created_at ASC
            LIMIT 1
          `);

        workflow =
          result.rows[0] ?? null;
      }


      // Fasilitas saja
      else if (
        hasFasilitas &&
        !hasBarang
      ) {
        const result =
          await client.query(`
            SELECT *
            FROM public.workflow_templates
            WHERE is_active = true
              AND item_type = 'fasilitas'
            ORDER BY created_at ASC
            LIMIT 1
          `);

        workflow =
          result.rows[0] ?? null;
      }


      // Campuran
      else if (hasRegular) {
        const result =
          await client.query(`
            SELECT *
            FROM public.workflow_templates
            WHERE is_active = true
            ORDER BY created_at ASC
            LIMIT 1
          `);

        workflow =
          result.rows[0] ?? null;
      }


      // Final fallback default
      if (!workflow) {
        const defaultWorkflow =
          await client.query(`
            SELECT *
            FROM public.workflow_templates
            WHERE is_active = true
            ORDER BY created_at ASC
            LIMIT 1
          `);

        workflow =
          defaultWorkflow.rows[0] ?? null;
      }


      // =====================================================
      // WORKFLOW STEPS
      // =====================================================

      let workflowSteps = [];

      if (workflow?.id) {
        const stepResult =
          await client.query(
            `
              SELECT
                id,
                workflow_template_id,
                step_order,
                role_id,
                step_label,
                is_info_only
              FROM public.workflow_steps
              WHERE workflow_template_id = $1
              ORDER BY step_order ASC
            `,
            [workflow.id]
          );

        workflowSteps =
          stepResult.rows;
      }


      // =====================================================
      // DEPARTMENT
      // Sama seperti lama: ambil fasilitas pertama
      // =====================================================

      const firstFacility =
        normalizedItems.find(
          (item) =>
            item.facility_id
        );

      const facilityDepartment =
        firstFacility?.department ??
        null;


      // =====================================================
      // AUTO ASSIGN KEPALA BENGKEL
      // =====================================================

      let assignedApprover = null;

      if (
        facilityDepartment &&
        workflow
      ) {
        const dynamicStep =
          workflowSteps.find(
            (step) =>
              !step.is_info_only &&
              !step.role_id
          );

        if (dynamicStep) {
          const kabengResult =
            await client.query(
              `
                SELECT
                  au.id,
                  au.name,
                  au.email
                FROM public.roles r

                INNER JOIN public.admin_user_roles aur
                  ON aur.role_id = r.id

                INNER JOIN public.admin_users au
                  ON au.id = aur.admin_user_id

                WHERE r.name = 'Kepala Bengkel'
                  AND r.is_active = true
                  AND au.is_active = true
                  AND aur.department = $1

                ORDER BY au.created_at ASC
                LIMIT 1
              `,
              [facilityDepartment]
            );

          const kabeng =
            kabengResult.rows[0];

          if (kabeng) {
            assignedApprover = {
              id: kabeng.id,
              name: kabeng.name,
              email: kabeng.email,
              role: 'Kepala Bengkel',
            };
          }
        }
      }


      // =====================================================
      // TRANSACTION START
      // =====================================================

      await client.query('BEGIN');


      // =====================================================
      // INSERT BORROWING
      // =====================================================

      const totalUnits =
        normalizedItems.reduce(
          (sum, item) =>
            sum + item.quantity,
          0
        );

      const firstInventoryId =
        normalizedItems.find(
          (item) =>
            item.inventory_id
        )?.inventory_id ?? null;

      const firstFacilityId =
        normalizedItems.find(
          (item) =>
            item.facility_id
        )?.facility_id ?? null;

      const borrowingItemType =
        normalizedItems[0]?.item_type ??
        'barang';

      const borrowingResult =
        await client.query(
          `
            INSERT INTO public.borrowings (
              borrower_name,
              borrower_class,
              borrower_email,
              borrower_phone,
              borrow_date,
              return_date,
              start_time,
              end_time,
              purpose,
              notes,
              item_type,
              inventory_id,
              facility_id,
              department,
              borrowed_units,
              status,
              workflow_template_id,
              current_step,
              current_status_label
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              $12,
              $13,
              $14,
              $15,
              'pending',
              $16,
              $17,
              'Menunggu Persetujuan'
            )
            RETURNING *
          `,
          [
            cleanName,
            cleanClass,
            cleanEmail,
            cleanPhone || null,
            borrow_date,
            return_date,
            cleanStartTime,
            cleanEndTime,
            cleanPurpose,
            cleanNotes || null,
            borrowingItemType,
            firstInventoryId,
            firstFacilityId,
            facilityDepartment,
            totalUnits,
            workflow?.id ?? null,
            workflow ? 1 : null,
          ]
        );

      const borrowing =
        borrowingResult.rows[0];


      // =====================================================
      // INSERT BORROWING ITEMS
      // Approver langsung masuk saat INSERT
      // =====================================================

      for (const item of normalizedItems) {
        await client.query(
          `
            INSERT INTO public.borrowing_items (
              borrowing_id,
              inventory_id,
              facility_id,
              item_type,
              item_name,
              quantity,
              status,
              workflow_template_id,
              current_step,
              current_status_label,
              assigned_approver_user_id,
              assigned_approver_name,
              assigned_approver_role
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              'pending',
              $7,
              $8,
              'Menunggu Persetujuan',
              $9,
              $10,
              $11
            )
          `,
          [
            borrowing.id,
            item.inventory_id,
            item.facility_id,
            item.item_type,
            item.item_name,
            item.quantity,
            workflow?.id ?? null,
            workflow ? 1 : null,
            assignedApprover?.id ?? null,
            assignedApprover?.name ?? '',
            assignedApprover?.role ?? '',
          ]
        );
      }


      await client.query('COMMIT');


      // =====================================================
      // FIND FIRST APPROVER EMAIL
      // Non-blocking notification
      // =====================================================

      let recipientEmails = [];

      try {
        const firstStep =
          workflowSteps.find(
            (step) =>
              step.step_order === 1
          ) ??
          workflowSteps[0] ??
          null;


        if (firstStep?.role_id) {
          // Pertahankan perilaku lama:
          // assigned approver lebih diprioritaskan
          if (assignedApprover?.email) {
            recipientEmails = [
              assignedApprover.email,
            ];
          } else {
            const adminsResult =
              await client.query(
                `
                  SELECT DISTINCT
                    au.email
                  FROM public.admin_user_roles aur

                  INNER JOIN public.admin_users au
                    ON au.id = aur.admin_user_id

                  WHERE aur.role_id = $1
                    AND au.is_active = true
                    AND au.email IS NOT NULL
                    AND au.email <> ''
                `,
                [firstStep.role_id]
              );

            recipientEmails =
              adminsResult.rows
                .map((row) => row.email)
                .filter(Boolean);
          }
        }

        else if (
          firstStep &&
          !firstStep.role_id &&
          assignedApprover?.email
        ) {
          recipientEmails = [
            assignedApprover.email,
          ];
        }


        // ===================================================
        // SEND VIA EXISTING SUPABASE FUNCTION
        // Supabase Database TIDAK dipakai
        // ===================================================

        if (
          recipientEmails.length > 0 &&
          process.env.SUPABASE_URL &&
          process.env.SUPABASE_ANON_KEY
        ) {
          const safeItems =
            normalizedItems
              .map(
                (item) => `
                  <tr>
                    <td style="padding:6px 12px;border:1px solid #e2e8f0;">
                      ${
                        item.item_type === 'barang'
                          ? 'Barang'
                          : 'Fasilitas'
                      }
                    </td>

                    <td style="padding:6px 12px;border:1px solid #e2e8f0;">
                      ${escapeBorrowingEmailHtml(item.item_name)}
                    </td>

                    <td style="padding:6px 12px;border:1px solid #e2e8f0;">
                      ${item.quantity}
                    </td>
                  </tr>
                `
              )
              .join('');


          const timeString =
            [start_time, end_time]
              .filter(Boolean)
              .join(' - ') || '-';


          const requestOrigin =
            String(
              req.headers.origin ?? ''
            );

          const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:5174',
      'https://sarpras.smkn1-cmi.sch.id',
      'https://sarpras.smkn1-cmi.sch.id/',
            'https://sarpras.smkn1-cmi.sch.id',
          ];

          const frontendOrigin =
            allowedOrigins.includes(
              requestOrigin
            )
              ? requestOrigin
              : 'http://localhost:5173';


          const message = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">

              <h2 style="color:#0f766e;">
                Pengajuan Peminjaman Baru
              </h2>

              <p>
                Ada pengajuan peminjaman baru yang memerlukan persetujuan Anda.
              </p>

              <table style="width:100%;border-collapse:collapse;margin:16px 0;">

                <tr>
                  <td style="padding:6px 12px;font-weight:bold;">
                    Nama Pemohon
                  </td>

                  <td style="padding:6px 12px;">
                    ${escapeBorrowingEmailHtml(cleanName)}
                  </td>
                </tr>

                <tr>
                  <td style="padding:6px 12px;font-weight:bold;">
                    Kelas/Unit
                  </td>

                  <td style="padding:6px 12px;">
                    ${escapeBorrowingEmailHtml(cleanClass)}
                  </td>
                </tr>

                <tr>
                  <td style="padding:6px 12px;font-weight:bold;">
                    Tanggal
                  </td>

                  <td style="padding:6px 12px;">
                    ${escapeBorrowingEmailHtml(borrow_date)}
                    s/d
                    ${escapeBorrowingEmailHtml(return_date)}
                  </td>
                </tr>

                <tr>
                  <td style="padding:6px 12px;font-weight:bold;">
                    Waktu
                  </td>

                  <td style="padding:6px 12px;">
                    ${escapeBorrowingEmailHtml(timeString)}
                  </td>
                </tr>

                <tr>
                  <td style="padding:6px 12px;font-weight:bold;">
                    Tujuan
                  </td>

                  <td style="padding:6px 12px;">
                    ${escapeBorrowingEmailHtml(cleanPurpose)}
                  </td>
                </tr>

              </table>

              <h3 style="color:#334155;">
                Detail Peminjaman
              </h3>

              <table style="width:100%;border-collapse:collapse;margin:8px 0;">

                <tr style="background:#f1f5f9;">
                  <th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left;">
                    Jenis
                  </th>

                  <th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left;">
                    Nama
                  </th>

                  <th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left;">
                    Jumlah
                  </th>
                </tr>

                ${safeItems}

              </table>

              <a
                href="${frontendOrigin}/admin/borrowings"
                style="display:inline-block;margin-top:16px;background:#0f766e;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;"
              >
                Lihat Pengajuan
              </a>

            </div>
          `;


          const emailResponse =
            await fetch(
              `${process.env.SUPABASE_URL}/functions/v1/send-borrowing-email`,
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json',

                  apikey:
                    process.env.SUPABASE_ANON_KEY,

                  Authorization:
                    String(
                      req.headers.authorization ||
                      ''
                    ),
                },

                body: JSON.stringify({
                  recipientEmails,
                  subject:
                    'Pengajuan Peminjaman Baru - Smart Sarpras',
                  message,
                }),
              }
            );


          if (!emailResponse.ok) {
            console.warn(
              '[BORROWING] Email function gagal:',
              emailResponse.status
            );
          }
        }
      } catch (notificationError) {
        console.warn(
          '[BORROWING] Notification error:',
          notificationError
        );
      }


      // =====================================================
      // RESPONSE
      // =====================================================

      res.status(201).json({
        ok: true,

        data: {
          id: borrowing.id,
          status: borrowing.status,
          workflow_template_id:
            borrowing.workflow_template_id,
          current_step:
            borrowing.current_step,
          current_status_label:
            borrowing.current_status_label,
        },
      });
    } catch (error) {
      try {
        await client.query(
          'ROLLBACK'
        );
      } catch {
        // noop
      }

      console.error(
        '[BORROWING] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal membuat pengajuan peminjaman',
      });
    } finally {
      client.release();
    }
  }
);

// =====================================================
// ADMIN BORROWINGS
// =====================================================

function escapeBorrowAdminHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function sendBorrowAdminEmail(payload) {
  try {
    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_ANON_KEY
    ) {
      return;
    }

    const authorization =
      String(
        requestContext
          .getStore()
          ?.authorization ||
          ''
      );

    if (
      !authorization.startsWith(
        'Bearer '
      )
    ) {
      console.warn(
        '[BORROW ADMIN EMAIL] user session tidak tersedia'
      );
      return;
    }

    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/send-borrowing-email`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',

          apikey:
            process.env.SUPABASE_ANON_KEY,

          Authorization:
            authorization,
        },

        body:
          JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      console.warn(
        '[BORROW ADMIN EMAIL]',
        response.status
      );
    }
  } catch (error) {
    console.warn(
      '[BORROW ADMIN EMAIL]',
      error
    );
  }
}


// =====================================================
// HELPERS
// =====================================================

function isLainnyaBorrowingServer(
  borrowing
) {
  const items =
    borrowing.borrowing_items ??
    [];

  if (
    items.length === 0
  ) {
    return (
      borrowing.inventory_id ==
        null &&
      borrowing.facility_id ==
        null
    );
  }

  return items.every(
    (item) =>
      item.inventory_id ==
        null &&
      item.facility_id ==
        null
  );
}


function getCurrentBorrowStep(
  borrowing,
  steps
) {
  if (
    !borrowing.workflow_template_id ||
    borrowing.current_step ==
      null
  ) {
    return null;
  }

  return (
    steps.find(
      (step) =>
        Number(
          step.step_order
        ) ===
        Number(
          borrowing.current_step
        )
    ) ?? null
  );
}


function adminIsCurrentApprover(
  req,
  borrowing,
  currentStep
) {
  if (
    !currentStep ||
    currentStep.is_info_only ===
      true
  ) {
    return false;
  }

  if (
    currentStep.role_id
  ) {
    return (
      req.adminRoles ??
      []
    ).some(
      (role) =>
        String(role.id) ===
        String(
          currentStep.role_id
        )
    );
  }

  return (
    borrowing.borrowing_items ??
    []
  ).some(
    (item) =>
      item.assigned_approver_user_id &&
      String(
        item.assigned_approver_user_id
      ) ===
        String(
          req.adminUser.id
        )
  );
}


function getNextBorrowStep(
  steps,
  currentStep
) {
  return (
    steps.find(
      (step) =>
        Number(
          step.step_order
        ) >
          Number(
            currentStep
          ) &&
        step.is_info_only !==
          true
    ) ?? null
  );
}


async function getBorrowingBundle(
  db,
  borrowingId,
  lock = false
) {
  const borrowingResult =
    await db.query(
      `
        SELECT *
        FROM public.borrowings
        WHERE id = $1
        ${
          lock
            ? 'FOR UPDATE'
            : ''
        }
      `,
      [borrowingId]
    );

  const borrowing =
    borrowingResult.rows[0];

  if (!borrowing) {
    return null;
  }

  const itemsResult =
    await db.query(
      `
        SELECT *
        FROM public.borrowing_items
        WHERE borrowing_id = $1
        ORDER BY created_at ASC
      `,
      [borrowingId]
    );

  let steps = [];

  if (
    borrowing.workflow_template_id
  ) {
    const stepsResult =
      await db.query(
        `
          SELECT
            id,
            workflow_template_id,
            step_order,
            role_id,
            step_label,
            is_info_only,
            created_at
          FROM public.workflow_steps
          WHERE workflow_template_id = $1
          ORDER BY step_order ASC
        `,
        [
          borrowing
            .workflow_template_id,
        ]
      );

    steps =
      stepsResult.rows;
  }

  borrowing.borrowing_items =
    itemsResult.rows;

  return {
    borrowing,
    steps,
  };
}


// =====================================================
// GET BORROWINGS
// =====================================================

app.get(
  '/api/admin/borrowings',

  requireAdmin,

  async (req, res) => {
    try {
      const status =
        String(
          req.query.status ??
            'all'
        ).trim();

      const search =
        String(
          req.query.search ??
            ''
        ).trim();

      const allowedStatuses = [
        'all',
        'pending',
        'processing',
        'approved',
        'rejected',
        'returned',
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Filter status tidak valid',
        });
      }

      const values = [];
      const where = [];

      if (
        status !== 'all'
      ) {
        values.push(status);

        where.push(
          `b.status::text = $${values.length}`
        );
      }

      if (search) {
        values.push(
          `%${search}%`
        );

        where.push(`
          (
            b.borrower_name ILIKE $${values.length}
            OR b.borrower_class ILIKE $${values.length}
            OR b.borrower_email ILIKE $${values.length}
          )
        `);
      }

      const borrowingResult =
        await pool.query(
          `
            SELECT b.*
            FROM public.borrowings b

            ${
              where.length
                ? `WHERE ${where.join(
                    ' AND '
                  )}`
                : ''
            }

            ORDER BY
              b.created_at DESC
          `,
          values
        );

      const borrowings =
        borrowingResult.rows;

      if (
        borrowings.length ===
        0
      ) {
        return res.json({
          ok: true,
          data: [],
        });
      }

      const borrowingIds =
        borrowings.map(
          (borrowing) =>
            borrowing.id
        );

      const templateIds = [
        ...new Set(
          borrowings
            .map(
              (borrowing) =>
                borrowing.workflow_template_id
            )
            .filter(Boolean)
            .map(String)
        ),
      ];

      const itemsResult =
        await pool.query(
          `
            SELECT *
            FROM public.borrowing_items
            WHERE borrowing_id =
              ANY($1::uuid[])
            ORDER BY created_at ASC
          `,
          [borrowingIds]
        );

      let allSteps = [];

      if (
        templateIds.length >
        0
      ) {
        const stepsResult =
          await pool.query(
            `
              SELECT
                id,
                workflow_template_id,
                step_order,
                role_id,
                step_label,
                is_info_only,
                created_at
              FROM public.workflow_steps
              WHERE workflow_template_id =
                ANY($1::uuid[])
              ORDER BY
                workflow_template_id,
                step_order
            `,
            [templateIds]
          );

        allSteps =
          stepsResult.rows;
      }

      const output = [];

      for (
        const borrowing of
        borrowings
      ) {
        borrowing.borrowing_items =
          itemsResult.rows.filter(
            (item) =>
              String(
                item.borrowing_id
              ) ===
              String(
                borrowing.id
              )
          );

        const steps =
          allSteps.filter(
            (step) =>
              String(
                step.workflow_template_id
              ) ===
              String(
                borrowing.workflow_template_id
              )
          );

        const currentStep =
          getCurrentBorrowStep(
            borrowing,
            steps
          );

        const isCurrentApprover =
          adminIsCurrentApprover(
            req,
            borrowing,
            currentStep
          );

        const nextStep =
          borrowing.current_step !=
          null
            ? getNextBorrowStep(
                steps,
                borrowing.current_step
              )
            : null;

        const canForward =
          isLainnyaBorrowingServer(
            borrowing
          ) &&
          String(
            borrowing.status ??
              ''
          ) ===
            'pending' &&
          !!currentStep &&
          !!currentStep.role_id &&
          isCurrentApprover &&
          !!nextStep &&
          !nextStep.role_id;

        // Admin biasa hanya melihat
        // pengajuan yang sedang menjadi
        // tanggung jawabnya.
        if (
          !req.isSuperAdmin &&
          !(
            String(
              borrowing.status ??
                ''
            ) ===
              'pending' &&
            isCurrentApprover
          )
        ) {
          continue;
        }

        output.push({
          ...borrowing,

          actions: {
            is_current_approver:
              isCurrentApprover,

            can_forward:
              canForward,
          },
        });
      }

      res.json({
        ok: true,
        data: output,
      });
    } catch (error) {
      console.error(
        '[ADMIN BORROWINGS GET]',
        error
      );

      res.status(
        500
      ).json({
        ok: false,
        message:
          'Gagal memuat data peminjaman',
      });
    }
  }
);


// =====================================================
// APPROVE
// =====================================================

app.post(
  '/api/admin/borrowings/:id/approve',

  requireAdmin,

  requirePermission(
    'borrowings',
    'approve'
  ),

  async (req, res) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const bundle =
        await getBorrowingBundle(
          client,
          req.params.id,
          true
        );

      if (!bundle) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Peminjaman tidak ditemukan',
        });
      }

      const {
        borrowing,
        steps,
      } = bundle;

      if (
        String(
          borrowing.status
        ) !== 'pending'
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(
          409
        ).json({
          ok: false,
          message:
            'Peminjaman sudah tidak menunggu persetujuan',
        });
      }

      const currentStepOrder =
        borrowing.current_step ??
        1;

      const currentStep =
        getCurrentBorrowStep(
          borrowing,
          steps
        );

      if (
        !adminIsCurrentApprover(
          req,
          borrowing,
          currentStep
        )
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(
          403
        ).json({
          ok: false,
          message:
            'Anda bukan approver pada tahap ini',
        });
      }

      const nextStep =
        getNextBorrowStep(
          steps,
          currentStepOrder
        );

      const isLastApproval =
        !nextStep;

      const newStatus =
        isLastApproval
          ? 'approved'
          : 'pending';

      const newStep =
        isLastApproval
          ? currentStepOrder
          : Number(
              nextStep.step_order
            );

      const newLabel =
        isLastApproval
          ? 'Disetujui'
          : nextStep.step_label ||
            'Lanjut';


      // =================================================
      // AUTO ASSIGN KABENG
      // =================================================

      let autoAssignedUser =
        null;

      if (
        nextStep &&
        !nextStep.role_id &&
        borrowing.department
      ) {
        const existing =
          borrowing.borrowing_items.find(
            (item) =>
              item.assigned_approver_user_id
          );

        if (!existing) {
          const kabengResult =
            await client.query(
              `
                SELECT
                  au.id,
                  au.name,
                  au.email

                FROM public.roles r

                INNER JOIN
                  public.admin_user_roles aur
                  ON aur.role_id =
                    r.id

                INNER JOIN
                  public.admin_users au
                  ON au.id =
                    aur.admin_user_id

                WHERE
                  r.name =
                    'Kepala Bengkel'
                  AND r.is_active =
                    true
                  AND au.is_active =
                    true
                  AND aur.department =
                    $1

                ORDER BY
                  au.created_at ASC

                LIMIT 1
              `,
              [
                borrowing.department,
              ]
            );

          const kabeng =
            kabengResult.rows[0];

          if (kabeng) {
            autoAssignedUser =
              kabeng;

            await client.query(
              `
                UPDATE
                  public.borrowing_items

                SET
                  assigned_approver_user_id =
                    $1,

                  assigned_approver_name =
                    $2,

                  assigned_approver_role =
                    'Kepala Bengkel',

                  updated_at =
                    NOW()

                WHERE
                  borrowing_id =
                    $3
              `,
              [
                kabeng.id,
                kabeng.name ??
                  '',
                borrowing.id,
              ]
            );
          }
        }
      }


      // =================================================
      // UPDATE HEADER
      // =================================================

      await client.query(
        `
          UPDATE
            public.borrowings

          SET
            status = $1,

            current_step = $2,

            current_status_label =
              $3,

            approved_by = $4,

            approver_position =
              $5,

            approved_at =
              NOW()

          WHERE id = $6
        `,
        [
          newStatus,
          newStep,
          newLabel,
          req.adminUser.id,
          currentStep
            ?.step_label ??
            null,
          borrowing.id,
        ]
      );


      // =================================================
      // UPDATE ITEMS
      // =================================================

      await client.query(
        `
          UPDATE
            public.borrowing_items

          SET
            status = $1,

            current_step = $2,

            current_status_label =
              $3,

            updated_at =
              NOW()

          WHERE
            borrowing_id =
              $4
        `,
        [
          newStatus,
          newStep,
          newLabel,
          borrowing.id,
        ]
      );

      await client.query(
        'COMMIT'
      );


      // =================================================
      // EMAIL
      // =================================================

      if (
        isLastApproval &&
        borrowing.borrower_email
      ) {
        const message = `
          <div style="font-family:Arial,sans-serif">
            <h2>Peminjaman Disetujui</h2>

            <p>
              Halo
              ${escapeBorrowAdminHtml(
                borrowing.borrower_name ??
                  'Peminjam'
              )},
            </p>

            <p>
              Pengajuan peminjaman Anda
              telah disetujui.
            </p>
          </div>
        `;

        void sendBorrowAdminEmail(
          {
            recipientEmail:
              borrowing.borrower_email,

            subject:
              'Peminjaman Disetujui - Smart Sarpras',

            message,
          }
        );
      }

      else if (nextStep) {
        let recipientEmails =
          [];

        if (
          !nextStep.role_id
        ) {
          const assignedId =
            autoAssignedUser?.id ??
            borrowing.borrowing_items.find(
              (item) =>
                item.assigned_approver_user_id
            )
              ?.assigned_approver_user_id;

          if (assignedId) {
            const result =
              await pool.query(
                `
                  SELECT email
                  FROM public.admin_users
                  WHERE id = $1
                    AND is_active = true
                  LIMIT 1
                `,
                [assignedId]
              );

            if (
              result.rows[0]
                ?.email
            ) {
              recipientEmails =
                [
                  result.rows[0]
                    .email,
                ];
            }
          }
        }

        else {
          const result =
            await pool.query(
              `
                SELECT DISTINCT
                  au.email

                FROM
                  public.admin_user_roles aur

                INNER JOIN
                  public.admin_users au

                  ON au.id =
                    aur.admin_user_id

                WHERE
                  aur.role_id =
                    $1

                  AND au.is_active =
                    true
              `,
              [
                nextStep.role_id,
              ]
            );

          recipientEmails =
            result.rows
              .map(
                (row) =>
                  row.email
              )
              .filter(Boolean);
        }

        if (
          recipientEmails.length >
          0
        ) {
          const message = `
            <div style="font-family:Arial,sans-serif">
              <h2>
                Pengajuan Peminjaman
              </h2>

              <p>
                Ada pengajuan yang
                menunggu persetujuan
                Anda pada tahap
                <strong>
                  ${escapeBorrowAdminHtml(
                    nextStep.step_label
                  )}
                </strong>.
              </p>
            </div>
          `;

          void sendBorrowAdminEmail(
            {
              recipientEmails,

              subject:
                'Pengajuan Peminjaman Menunggu Persetujuan - Smart Sarpras',

              message,
            }
          );
        }
      }


      res.json({
        ok: true,

        data: {
          id:
            borrowing.id,

          status:
            newStatus,

          current_step:
            newStep,

          current_status_label:
            newLabel,
        },
      });
    } catch (error) {
      try {
        await client.query(
          'ROLLBACK'
        );
      } catch {
        // noop
      }

      console.error(
        '[ADMIN BORROW APPROVE]',
        error
      );

      res.status(
        500
      ).json({
        ok: false,
        message:
          'Gagal menyetujui peminjaman',
      });
    } finally {
      client.release();
    }
  }
);


// =====================================================
// REJECT
// =====================================================

app.post(
  '/api/admin/borrowings/:id/reject',

  requireAdmin,

  requirePermission(
    'borrowings',
    'reject'
  ),

  async (req, res) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const bundle =
        await getBorrowingBundle(
          client,
          req.params.id,
          true
        );

      if (!bundle) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Peminjaman tidak ditemukan',
        });
      }

      const {
        borrowing,
        steps,
      } = bundle;

      const currentStep =
        getCurrentBorrowStep(
          borrowing,
          steps
        );

      if (
        String(
          borrowing.status
        ) !==
          'pending' ||
        !adminIsCurrentApprover(
          req,
          borrowing,
          currentStep
        )
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(
          403
        ).json({
          ok: false,
          message:
            'Anda tidak dapat menolak peminjaman ini',
        });
      }

      await client.query(
        `
          UPDATE
            public.borrowings

          SET
            status =
              'rejected',

            current_status_label =
              'Ditolak',

            approved_by =
              $1,

            approver_position =
              $2,

            approved_at =
              NOW()

          WHERE id =
            $3
        `,
        [
          req.adminUser.id,

          currentStep
            ?.step_label ??
            null,

          borrowing.id,
        ]
      );

      await client.query(
        `
          UPDATE
            public.borrowing_items

          SET
            status =
              'rejected',

            current_status_label =
              'Ditolak',

            updated_at =
              NOW()

          WHERE
            borrowing_id =
              $1
        `,
        [
          borrowing.id,
        ]
      );

      await client.query(
        'COMMIT'
      );

      if (
        borrowing.borrower_email
      ) {
        void sendBorrowAdminEmail(
          {
            recipientEmail:
              borrowing.borrower_email,

            subject:
              'Peminjaman Ditolak - Smart Sarpras',

            message: `
              <div style="font-family:Arial,sans-serif">
                <h2>
                  Peminjaman Ditolak
                </h2>

                <p>
                  Halo
                  ${escapeBorrowAdminHtml(
                    borrowing.borrower_name ??
                      'Peminjam'
                  )},
                </p>

                <p>
                  Pengajuan peminjaman
                  Anda telah ditolak.
                </p>
              </div>
            `,
          }
        );
      }

      res.json({
        ok: true,
      });
    } catch (error) {
      try {
        await client.query(
          'ROLLBACK'
        );
      } catch {
        // noop
      }

      console.error(
        '[ADMIN BORROW REJECT]',
        error
      );

      res.status(
        500
      ).json({
        ok: false,
        message:
          'Gagal menolak peminjaman',
      });
    } finally {
      client.release();
    }
  }
);


// =====================================================
// DELETE - SUPER ADMIN
// =====================================================

app.delete(
  '/api/admin/borrowings/:id',

  requireAdmin,

  requireSuperAdminAccess,

  async (req, res) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      await client.query(
        `
          DELETE FROM
            public.borrowing_items

          WHERE
            borrowing_id =
              $1
        `,
        [req.params.id]
      );

      const result =
        await client.query(
          `
            DELETE FROM
              public.borrowings

            WHERE id =
              $1

            RETURNING
              id,
              borrower_name
          `,
          [req.params.id]
        );

      if (
        result.rowCount ===
        0
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Peminjaman tidak ditemukan',
        });
      }

      await client.query(
        'COMMIT'
      );

      res.json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      try {
        await client.query(
          'ROLLBACK'
        );
      } catch {
        // noop
      }

      console.error(
        '[ADMIN BORROW DELETE]',
        error
      );

      res.status(
        500
      ).json({
        ok: false,
        message:
          'Gagal menghapus peminjaman',
      });
    } finally {
      client.release();
    }
  }
);


// =====================================================
// FORWARD OPTIONS
// =====================================================

app.get(
  '/api/admin/borrowings/:id/forward-options',

  requireAdmin,

  requirePermission(
    'borrowings',
    'approve'
  ),

  async (req, res) => {
    try {
      const target =
        String(
          req.query.target ??
            ''
        );

      if (
        ![
          'barang',
          'fasilitas',
        ].includes(target)
      ) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Target tidak valid',
        });
      }

      const bundle =
        await getBorrowingBundle(
          pool,
          req.params.id
        );

      if (!bundle) {
        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Peminjaman tidak ditemukan',
        });
      }

      const {
        borrowing,
        steps,
      } = bundle;

      const currentStep =
        getCurrentBorrowStep(
          borrowing,
          steps
        );

      if (
        !adminIsCurrentApprover(
          req,
          borrowing,
          currentStep
        )
      ) {
        return res.status(
          403
        ).json({
          ok: false,
          message:
            'Anda bukan approver saat ini',
        });
      }

      const targetTemplate =
        await pool.query(
          `
            SELECT id
            FROM
              public.workflow_templates

            WHERE
              is_active =
                true

              AND item_type =
                $1

            ORDER BY
              created_at ASC

            LIMIT 1
          `,
          [target]
        );

      const lainnyaTemplate =
        await pool.query(
          `
            SELECT id
            FROM
              public.workflow_templates

            WHERE
              is_active =
                true

              AND item_type =
                'lainnya'

            ORDER BY
              created_at ASC

            LIMIT 1
          `
        );

      const targetId =
        targetTemplate
          .rows[0]?.id;

      const lainnyaId =
        lainnyaTemplate
          .rows[0]?.id;

      if (
        !targetId ||
        !lainnyaId
      ) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Workflow aktif belum tersedia',
        });
      }

      const targetSteps =
        await pool.query(
          `
            SELECT role_id
            FROM
              public.workflow_steps
            WHERE
              workflow_template_id =
                $1
            ORDER BY
              step_order
          `,
          [targetId]
        );

      const lainnyaSteps =
        await pool.query(
          `
            SELECT role_id
            FROM
              public.workflow_steps
            WHERE
              workflow_template_id =
                $1
            ORDER BY
              step_order
          `,
          [lainnyaId]
        );

      const lainnyaRoleIds =
        new Set(
          lainnyaSteps.rows
            .filter(
              (step) =>
                step.role_id
            )
            .map(
              (step) =>
                String(
                  step.role_id
                )
            )
        );

      const specialist =
        targetSteps.rows.find(
          (step) =>
            step.role_id &&
            !lainnyaRoleIds.has(
              String(
                step.role_id
              )
            )
        );

      if (
        !specialist
          ?.role_id
      ) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Role specialist tidak ditemukan',
        });
      }

      const roleResult =
        await pool.query(
          `
            SELECT name
            FROM public.roles
            WHERE id = $1
            LIMIT 1
          `,
          [
            specialist.role_id,
          ]
        );

      const admins =
        await pool.query(
          `
            SELECT DISTINCT
              au.id,
              au.name,
              au.email

            FROM
              public.admin_user_roles aur

            INNER JOIN
              public.admin_users au

              ON au.id =
                aur.admin_user_id

            WHERE
              aur.role_id =
                $1

              AND au.is_active =
                true

            ORDER BY
              au.name
          `,
          [
            specialist.role_id,
          ]
        );

      res.json({
        ok: true,

        data: {
          role_id:
            specialist.role_id,

          role_name:
            roleResult.rows[0]
              ?.name ??
            'Specialist',

          options:
            admins.rows,
        },
      });
    } catch (error) {
      console.error(
        '[ADMIN BORROW FORWARD OPTIONS]',
        error
      );

      res.status(
        500
      ).json({
        ok: false,
        message:
          'Gagal memuat daftar PJ',
      });
    }
  }
);


// =====================================================
// FORWARD
// =====================================================

app.post(
  '/api/admin/borrowings/:id/forward',

  requireAdmin,

  requirePermission(
    'borrowings',
    'approve'
  ),

  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const target =
        String(
          req.body?.target ??
            ''
        );

      const adminUserId =
        String(
          req.body
            ?.admin_user_id ??
            ''
        );

      if (
        ![
          'barang',
          'fasilitas',
        ].includes(target) ||
        !adminUserId
      ) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Data forward tidak valid',
        });
      }

      await client.query(
        'BEGIN'
      );

      const bundle =
        await getBorrowingBundle(
          client,
          req.params.id,
          true
        );

      if (!bundle) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Peminjaman tidak ditemukan',
        });
      }

      const {
        borrowing,
        steps,
      } = bundle;

      const currentStep =
        getCurrentBorrowStep(
          borrowing,
          steps
        );

      if (
        !adminIsCurrentApprover(
          req,
          borrowing,
          currentStep
        )
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(
          403
        ).json({
          ok: false,
          message:
            'Anda bukan approver saat ini',
        });
      }

      const dynamicStep =
        getNextBorrowStep(
          steps,
          borrowing.current_step ??
            0
        );

      if (
        !dynamicStep ||
        dynamicStep.role_id
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Tahap dinamis tidak ditemukan',
        });
      }


      // Cari role specialist
      const targetTemplate =
        await client.query(
          `
            SELECT id
            FROM
              public.workflow_templates

            WHERE
              is_active =
                true

              AND item_type =
                $1

            ORDER BY
              created_at ASC

            LIMIT 1
          `,
          [target]
        );

      const lainnyaTemplate =
        await client.query(
          `
            SELECT id
            FROM
              public.workflow_templates

            WHERE
              is_active =
                true

              AND item_type =
                'lainnya'

            ORDER BY
              created_at ASC

            LIMIT 1
          `
        );

      const targetId =
        targetTemplate
          .rows[0]?.id;

      const lainnyaId =
        lainnyaTemplate
          .rows[0]?.id;

      if (
        !targetId ||
        !lainnyaId
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Workflow aktif belum tersedia',
        });
      }

      const targetSteps =
        await client.query(
          `
            SELECT role_id
            FROM
              public.workflow_steps
            WHERE
              workflow_template_id =
                $1
            ORDER BY
              step_order
          `,
          [targetId]
        );

      const lainnyaSteps =
        await client.query(
          `
            SELECT role_id
            FROM
              public.workflow_steps
            WHERE
              workflow_template_id =
                $1
            ORDER BY
              step_order
          `,
          [lainnyaId]
        );

      const lainnyaRoleIds =
        new Set(
          lainnyaSteps.rows
            .filter(
              (step) =>
                step.role_id
            )
            .map(
              (step) =>
                String(
                  step.role_id
                )
            )
        );

      const specialist =
        targetSteps.rows.find(
          (step) =>
            step.role_id &&
            !lainnyaRoleIds.has(
              String(
                step.role_id
              )
            )
        );

      if (
        !specialist
          ?.role_id
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Role specialist tidak ditemukan',
        });
      }

      const selectedResult =
        await client.query(
          `
            SELECT
              au.id,
              au.name,
              au.email,
              r.name AS role_name

            FROM
              public.admin_users au

            INNER JOIN
              public.admin_user_roles aur

              ON aur.admin_user_id =
                au.id

            INNER JOIN
              public.roles r

              ON r.id =
                aur.role_id

            WHERE
              au.id = $1

              AND au.is_active =
                true

              AND aur.role_id =
                $2

            LIMIT 1
          `,
          [
            adminUserId,
            specialist.role_id,
          ]
        );

      const selected =
        selectedResult.rows[0];

      if (!selected) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(
          400
        ).json({
          ok: false,
          message:
            'PJ tidak valid',
        });
      }

      const label =
        `Menunggu Persetujuan ${selected.role_name}`;

      await client.query(
        `
          UPDATE
            public.borrowings

          SET
            status =
              'pending',

            current_step =
              $1,

            current_status_label =
              $2

          WHERE id =
            $3
        `,
        [
          dynamicStep.step_order,
          label,
          borrowing.id,
        ]
      );

      await client.query(
        `
          UPDATE
            public.borrowing_items

          SET
            status =
              'pending',

            current_step =
              $1,

            current_status_label =
              $2,

            assigned_approver_user_id =
              $3,

            assigned_approver_name =
              $4,

            assigned_approver_role =
              $5,

            updated_at =
              NOW()

          WHERE
            borrowing_id =
              $6
        `,
        [
          dynamicStep.step_order,
          label,
          selected.id,
          selected.name ??
            '',
          selected.role_name ??
            '',
          borrowing.id,
        ]
      );

      await client.query(
        'COMMIT'
      );

      if (
        selected.email
      ) {
        void sendBorrowAdminEmail(
          {
            recipientEmail:
              selected.email,

            subject:
              'Pengajuan Peminjaman Menunggu Persetujuan - Smart Sarpras',

            message: `
              <div style="font-family:Arial,sans-serif">
                <h2>
                  Pengajuan Peminjaman
                </h2>

                <p>
                  Ada pengajuan yang
                  diteruskan kepada Anda
                  sebagai
                  <strong>
                    ${escapeBorrowAdminHtml(
                      selected.role_name
                    )}
                  </strong>.
                </p>
              </div>
            `,
          }
        );
      }

      res.json({
        ok: true,

        data: {
          current_step:
            dynamicStep.step_order,

          current_status_label:
            label,

          assigned_approver_user_id:
            selected.id,

          assigned_approver_name:
            selected.name,

          assigned_approver_role:
            selected.role_name,
        },
      });
    } catch (error) {
      try {
        await client.query(
          'ROLLBACK'
        );
      } catch {
        // noop
      }

      console.error(
        '[ADMIN BORROW FORWARD]',
        error
      );

      res.status(
        500
      ).json({
        ok: false,
        message:
          'Gagal meneruskan peminjaman',
      });
    } finally {
      client.release();
    }
  }
);

// =====================================================
// ADMIN DASHBOARD
// =====================================================

app.get(
  '/api/admin/dashboard',

  requireAdmin,

  async (req, res) => {
    try {
      const [
        statsResult,
        recentBorrowingsResult,
      ] = await Promise.all([
        pool.query(`
          SELECT
            (
              SELECT COUNT(*)
              FROM public.inventory
            )::int AS inventory,

            (
              SELECT COUNT(*)
              FROM public.facilities
            )::int AS facilities,

            (
              SELECT COUNT(*)
              FROM public.damage_reports
            )::int AS reports,

            (
              SELECT COUNT(*)
              FROM public.announcements
            )::int AS announcements
        `),

        pool.query(`
          SELECT
            id,
            borrower_name,
            item_type,
            borrow_date,
            status::text AS status

          FROM public.borrowings

          ORDER BY
            created_at DESC

          LIMIT 5
        `),
      ]);

      res.json({
        ok: true,

        data: {
          stats:
            statsResult.rows[0],

          recentBorrowings:
            recentBorrowingsResult.rows,
        },
      });
    } catch (error) {
      console.error(
        '[ADMIN DASHBOARD] error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat dashboard admin',
      });
    }
  }
);

// =====================================================
// ADMIN - MASTER KELAS
// =====================================================

app.get(
  '/api/admin/master-kelas',
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          nama,
          is_active,
          created_at
        FROM public.master_kelas
        ORDER BY nama ASC
      `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[MASTER KELAS] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat master kelas',
      });
    }
  }
);


// =====================================================
// CREATE
// =====================================================

app.post(
  '/api/admin/master-kelas',
  requireAdmin,
  requirePermission(
    'master_data',
    'manage'
  ),
  async (req, res) => {
    try {
      const nama =
        String(
          req.body?.nama ??
            ''
        ).trim();

      if (!nama) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Nama kelas wajib diisi',
        });
      }

      const result =
        await pool.query(
          `
            INSERT INTO
              public.master_kelas (
                nama,
                is_active
              )
            VALUES (
              $1,
              true
            )
            RETURNING
              id,
              nama,
              is_active,
              created_at
          `,
          [nama]
        );

      res.status(201).json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[MASTER KELAS] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal menambahkan kelas',
      });
    }
  }
);


// =====================================================
// EDIT NAMA
// =====================================================

app.patch(
  '/api/admin/master-kelas/:id',
  requireAdmin,
  requirePermission(
    'master_data',
    'manage'
  ),
  async (req, res) => {
    try {
      const nama =
        String(
          req.body?.nama ??
            ''
        ).trim();

      if (!nama) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Nama kelas wajib diisi',
        });
      }

      const result =
        await pool.query(
          `
            UPDATE
              public.master_kelas

            SET
              nama = $1

            WHERE
              id = $2

            RETURNING
              id,
              nama,
              is_active,
              created_at
          `,
          [
            nama,
            req.params.id,
          ]
        );

      if (
        result.rowCount ===
        0
      ) {
        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Kelas tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[MASTER KELAS] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memperbarui kelas',
      });
    }
  }
);


// =====================================================
// TOGGLE STATUS
// =====================================================

app.patch(
  '/api/admin/master-kelas/:id/status',
  requireAdmin,
  requirePermission(
    'master_data',
    'manage'
  ),
  async (req, res) => {
    try {
      const {
        is_active,
      } = req.body ?? {};

      if (
        typeof is_active !==
        'boolean'
      ) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Status tidak valid',
        });
      }

      const result =
        await pool.query(
          `
            UPDATE
              public.master_kelas

            SET
              is_active = $1

            WHERE
              id = $2

            RETURNING
              id,
              nama,
              is_active,
              created_at
          `,
          [
            is_active,
            req.params.id,
          ]
        );

      if (
        result.rowCount ===
        0
      ) {
        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Kelas tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[MASTER KELAS] STATUS error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal mengubah status kelas',
      });
    }
  }
);


// =====================================================
// DELETE
// =====================================================

app.delete(
  '/api/admin/master-kelas/:id',
  requireAdmin,
  requirePermission(
    'master_data',
    'manage'
  ),
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            DELETE FROM
              public.master_kelas

            WHERE
              id = $1

            RETURNING
              id,
              nama
          `,
          [req.params.id]
        );

      if (
        result.rowCount ===
        0
      ) {
        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Kelas tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[MASTER KELAS] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal menghapus kelas',
      });
    }
  }
);

// =====================================================
// ADMIN - MASTER EKSTRAKURIKULER
// =====================================================

app.get(
  '/api/admin/master-ekstrakurikuler',
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          nama,
          is_active,
          created_at
        FROM public.master_ekstrakurikuler
        ORDER BY nama ASC
      `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[MASTER EKSTRAKURIKULER] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat master ekstrakurikuler',
      });
    }
  }
);


// =====================================================
// CREATE
// =====================================================

app.post(
  '/api/admin/master-ekstrakurikuler',
  requireAdmin,
  requirePermission(
    'master_data',
    'manage'
  ),
  async (req, res) => {
    try {
      const nama =
        String(
          req.body?.nama ??
            ''
        ).trim();

      if (!nama) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Nama ekstrakurikuler wajib diisi',
        });
      }

      const result =
        await pool.query(
          `
            INSERT INTO
              public.master_ekstrakurikuler (
                nama,
                is_active
              )
            VALUES (
              $1,
              true
            )
            RETURNING
              id,
              nama,
              is_active,
              created_at
          `,
          [nama]
        );

      res.status(201).json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[MASTER EKSTRAKURIKULER] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal menambahkan ekstrakurikuler',
      });
    }
  }
);


// =====================================================
// EDIT
// =====================================================

app.patch(
  '/api/admin/master-ekstrakurikuler/:id',
  requireAdmin,
  requirePermission(
    'master_data',
    'manage'
  ),
  async (req, res) => {
    try {
      const nama =
        String(
          req.body?.nama ??
            ''
        ).trim();

      if (!nama) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Nama ekstrakurikuler wajib diisi',
        });
      }

      const result =
        await pool.query(
          `
            UPDATE
              public.master_ekstrakurikuler

            SET
              nama = $1

            WHERE
              id = $2

            RETURNING
              id,
              nama,
              is_active,
              created_at
          `,
          [
            nama,
            req.params.id,
          ]
        );

      if (
        result.rowCount ===
        0
      ) {
        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Ekstrakurikuler tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[MASTER EKSTRAKURIKULER] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memperbarui ekstrakurikuler',
      });
    }
  }
);


// =====================================================
// TOGGLE STATUS
// =====================================================

app.patch(
  '/api/admin/master-ekstrakurikuler/:id/status',
  requireAdmin,
  requirePermission(
    'master_data',
    'manage'
  ),
  async (req, res) => {
    try {
      const {
        is_active,
      } = req.body ?? {};

      if (
        typeof is_active !==
        'boolean'
      ) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Status tidak valid',
        });
      }

      const result =
        await pool.query(
          `
            UPDATE
              public.master_ekstrakurikuler

            SET
              is_active = $1

            WHERE
              id = $2

            RETURNING
              id,
              nama,
              is_active,
              created_at
          `,
          [
            is_active,
            req.params.id,
          ]
        );

      if (
        result.rowCount ===
        0
      ) {
        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Ekstrakurikuler tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[MASTER EKSTRAKURIKULER] STATUS error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal mengubah status ekstrakurikuler',
      });
    }
  }
);


// =====================================================
// DELETE
// =====================================================

app.delete(
  '/api/admin/master-ekstrakurikuler/:id',
  requireAdmin,
  requirePermission(
    'master_data',
    'manage'
  ),
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            DELETE FROM
              public.master_ekstrakurikuler

            WHERE
              id = $1

            RETURNING
              id,
              nama
          `,
          [req.params.id]
        );

      if (
        result.rowCount ===
        0
      ) {
        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Ekstrakurikuler tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[MASTER EKSTRAKURIKULER] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal menghapus ekstrakurikuler',
      });
    }
  }
);

// =====================================================
// ADMIN - TEAM MEMBERS
// =====================================================

app.get(
  '/api/admin/team-members',
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            name,
            position,
            role,
            photo_url,
            description,
            email,
            phone,
            "order",
            is_active
          FROM public.team_members
          ORDER BY
            "order" ASC,
            name ASC
        `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[TEAM MEMBERS] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat anggota tim',
      });
    }
  }
);


// =====================================================
// CREATE
// =====================================================

app.post(
  '/api/admin/team-members',
  requireAdmin,
  requirePermission(
    'team',
    'create'
  ),
  async (req, res) => {
    try {
      const name =
        String(
          req.body?.name ??
            ''
        ).trim();

      if (!name) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Nama wajib diisi',
        });
      }


      const rawOrder =
        Number(
          req.body?.order ??
            0
        );

      const orderValue =
        Number.isFinite(
          rawOrder
        )
          ? Math.trunc(
              rawOrder
            )
          : 0;


      const result =
        await pool.query(
          `
            INSERT INTO
              public.team_members (
                name,
                position,
                role,
                photo_url,
                description,
                email,
                phone,
                "order",
                is_active
              )

            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9
            )

            RETURNING
              id,
              name,
              position,
              role,
              photo_url,
              description,
              email,
              phone,
              "order",
              is_active
          `,
          [
            name,

            req.body?.position
              ? String(
                  req.body.position
                ).trim()
              : null,

            req.body?.role
              ? String(
                  req.body.role
                ).trim()
              : null,

            req.body?.photo_url
              ? String(
                  req.body.photo_url
                ).trim()
              : null,

            req.body?.description
              ? String(
                  req.body.description
                ).trim()
              : null,

            req.body?.email
              ? String(
                  req.body.email
                ).trim()
              : null,

            req.body?.phone
              ? String(
                  req.body.phone
                ).trim()
              : null,

            orderValue,

            req.body?.is_active !==
              false,
          ]
        );


      res.status(201).json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[TEAM MEMBERS] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal menambahkan anggota tim',
      });
    }
  }
);


// =====================================================
// UPDATE
// =====================================================

app.patch(
  '/api/admin/team-members/:id',
  requireAdmin,
  requirePermission(
    'team',
    'update'
  ),
  async (req, res) => {
    try {
      const name =
        String(
          req.body?.name ??
            ''
        ).trim();

      if (!name) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Nama wajib diisi',
        });
      }


      const rawOrder =
        Number(
          req.body?.order ??
            0
        );

      const orderValue =
        Number.isFinite(
          rawOrder
        )
          ? Math.trunc(
              rawOrder
            )
          : 0;


      const result =
        await pool.query(
          `
            UPDATE
              public.team_members

            SET
              name = $1,
              position = $2,
              role = $3,
              photo_url = $4,
              description = $5,
              email = $6,
              phone = $7,
              "order" = $8,
              is_active = $9

            WHERE
              id = $10

            RETURNING
              id,
              name,
              position,
              role,
              photo_url,
              description,
              email,
              phone,
              "order",
              is_active
          `,
          [
            name,

            req.body?.position
              ? String(
                  req.body.position
                ).trim()
              : null,

            req.body?.role
              ? String(
                  req.body.role
                ).trim()
              : null,

            req.body?.photo_url
              ? String(
                  req.body.photo_url
                ).trim()
              : null,

            req.body?.description
              ? String(
                  req.body.description
                ).trim()
              : null,

            req.body?.email
              ? String(
                  req.body.email
                ).trim()
              : null,

            req.body?.phone
              ? String(
                  req.body.phone
                ).trim()
              : null,

            orderValue,

            req.body?.is_active !==
              false,

            req.params.id,
          ]
        );


      if (
        result.rowCount ===
        0
      ) {
        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Anggota tim tidak ditemukan',
        });
      }


      res.json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[TEAM MEMBERS] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memperbarui anggota tim',
      });
    }
  }
);


// =====================================================
// TOGGLE STATUS
// =====================================================

app.patch(
  '/api/admin/team-members/:id/status',
  requireAdmin,
  requirePermission(
    'team',
    'update'
  ),
  async (req, res) => {
    try {
      const {
        is_active,
      } = req.body ?? {};


      if (
        typeof is_active !==
        'boolean'
      ) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Status tidak valid',
        });
      }


      const result =
        await pool.query(
          `
            UPDATE
              public.team_members

            SET
              is_active = $1

            WHERE
              id = $2

            RETURNING
              id,
              name,
              position,
              role,
              photo_url,
              description,
              email,
              phone,
              "order",
              is_active
          `,
          [
            is_active,
            req.params.id,
          ]
        );


      if (
        result.rowCount ===
        0
      ) {
        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Anggota tim tidak ditemukan',
        });
      }


      res.json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[TEAM MEMBERS] STATUS error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal mengubah status anggota tim',
      });
    }
  }
);


// =====================================================
// DELETE
// =====================================================

app.delete(
  '/api/admin/team-members/:id',
  requireAdmin,
  requirePermission(
    'team',
    'delete'
  ),
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            DELETE FROM
              public.team_members

            WHERE
              id = $1

            RETURNING
              id,
              name
          `,
          [
            req.params.id,
          ]
        );


      if (
        result.rowCount ===
        0
      ) {
        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Anggota tim tidak ditemukan',
        });
      }


      res.json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[TEAM MEMBERS] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal menghapus anggota tim',
      });
    }
  }
);

// =====================================================
// ADMIN - ASPIRASI
// =====================================================

// GET ALL ASPIRASI
app.get(
  '/api/admin/aspirasi',
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          nama,
          kelas_unit,
          email,
          kategori,
          judul,
          isi,
          status::text AS status,
          tanggapan,
          created_at,
          updated_at
        FROM public.aspirasi
        ORDER BY created_at DESC
      `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[ASPIRASI ADMIN] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat aspirasi',
      });
    }
  }
);


// =====================================================
// UPDATE TANGGAPAN / STATUS
// =====================================================

app.patch(
  '/api/admin/aspirasi/:id',
  requireAdmin,
  requirePermission(
    'aspirasi',
    'update'
  ),
  async (req, res) => {
    try {
      const {
        status,
        tanggapan,
      } = req.body ?? {};


      const allowedStatuses = [
        'pending',
        'responded',
        'resolved',
      ];


      if (
        status !== undefined &&
        !allowedStatuses.includes(
          String(status)
        )
      ) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Status aspirasi tidak valid',
        });
      }


      const currentResult =
        await pool.query(
          `
            SELECT
              id,
              status::text AS status,
              tanggapan
            FROM public.aspirasi
            WHERE id = $1
            LIMIT 1
          `,
          [
            req.params.id,
          ]
        );


      const current =
        currentResult.rows[0];


      if (!current) {
        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Aspirasi tidak ditemukan',
        });
      }


      const nextStatus =
        status !== undefined
          ? String(status)
          : current.status;


      let nextTanggapan =
        current.tanggapan;


      if (
        tanggapan !==
        undefined
      ) {
        const clean =
          tanggapan ===
            null
            ? ''
            : String(
                tanggapan
              ).trim();

        nextTanggapan =
          clean ||
          null;
      }


      const result =
        await pool.query(
          `
            UPDATE
              public.aspirasi

            SET
              status = $1,
              tanggapan = $2,
              updated_at = NOW()

            WHERE
              id = $3

            RETURNING
              id,
              nama,
              kelas_unit,
              email,
              kategori,
              judul,
              isi,
              status::text AS status,
              tanggapan,
              created_at,
              updated_at
          `,
          [
            nextStatus,
            nextTanggapan,
            req.params.id,
          ]
        );


      res.json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[ASPIRASI ADMIN] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memperbarui aspirasi',
      });
    }
  }
);


// =====================================================
// DELETE - SUPER ADMIN ONLY
// =====================================================

app.delete(
  '/api/admin/aspirasi/:id',
  requireAdmin,
  async (req, res) => {
    try {
      if (!req.isSuperAdmin) {
        return res.status(
          403
        ).json({
          ok: false,
          message:
            'Hanya Super Admin yang dapat menghapus aspirasi',
        });
      }


      const result =
        await pool.query(
          `
            DELETE FROM
              public.aspirasi

            WHERE
              id = $1

            RETURNING
              id,
              judul
          `,
          [
            req.params.id,
          ]
        );


      if (
        result.rowCount ===
        0
      ) {
        return res.status(
          404
        ).json({
          ok: false,
          message:
            'Aspirasi tidak ditemukan',
        });
      }


      res.json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[ASPIRASI ADMIN] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal menghapus aspirasi',
      });
    }
  }
);

// =====================================================
// ADMIN - STATISTICS
// =====================================================

app.get(
  '/api/admin/statistics',

  requireAdmin,

  requirePermission(
    'statistics',
    'read'
  ),

  async (req, res) => {
    try {
      const [
        summaryResult,
        monthlyResult,
        statusResult,
        categoryResult,
      ] =
        await Promise.all([

          // =============================================
          // SUMMARY
          // =============================================
          pool.query(`
            SELECT
              (
                SELECT COUNT(*)
                FROM public.inventory
              )::int AS inventory,

              (
                SELECT COUNT(*)
                FROM public.facilities
              )::int AS facilities,

              (
                SELECT COUNT(*)
                FROM public.borrowings
              )::int AS borrowings,

              (
                SELECT COUNT(*)
                FROM public.damage_reports
              )::int AS damage_reports,

              (
                SELECT COUNT(*)
                FROM public.aspirasi
              )::int AS aspirasi,

              (
                SELECT COUNT(*)
                FROM public.announcements
              )::int AS announcements,

              (
                SELECT COUNT(*)
                FROM public.team_members
              )::int AS team_members
          `),


          // =============================================
          // BORROWINGS - LAST 6 MONTHS
          // =============================================
          pool.query(`
            WITH months AS (
              SELECT
                generate_series(
                  date_trunc(
                    'month',
                    CURRENT_DATE
                  ) - INTERVAL '5 months',

                  date_trunc(
                    'month',
                    CURRENT_DATE
                  ),

                  INTERVAL '1 month'
                )::date AS month_start
            )

            SELECT
              TO_CHAR(
                m.month_start,
                'YYYY-MM'
              ) AS month,

              COUNT(
                b.id
              )::int AS count

            FROM months m

            LEFT JOIN
              public.borrowings b

              ON b.borrow_date >=
                m.month_start

              AND b.borrow_date <
                (
                  m.month_start +
                  INTERVAL '1 month'
                )

            GROUP BY
              m.month_start

            ORDER BY
              m.month_start ASC
          `),


          // =============================================
          // BORROWINGS BY STATUS
          // =============================================
          pool.query(`
            SELECT
              COALESCE(
                status::text,
                'unknown'
              ) AS status,

              COUNT(*)::int AS count

            FROM public.borrowings

            GROUP BY
              status

            ORDER BY
              status
          `),


          // =============================================
          // INVENTORY BY CATEGORY
          // =============================================
          pool.query(`
            SELECT
              COALESCE(
                c.name,
                'Tanpa Kategori'
              ) AS name,

              COUNT(
                i.id
              )::int AS count

            FROM public.inventory i

            LEFT JOIN
              public.categories c

              ON c.id =
                i.category_id

            GROUP BY
              c.id,
              c.name

            ORDER BY
              name ASC
          `),
        ]);


      const summary =
        summaryResult.rows[0];


      res.json({
        ok: true,

        data: {
          summary: {
            inventory:
              summary.inventory ??
              0,

            facilities:
              summary.facilities ??
              0,

            borrowings:
              summary.borrowings ??
              0,

            damageReports:
              summary.damage_reports ??
              0,

            aspirasi:
              summary.aspirasi ??
              0,

            announcements:
              summary.announcements ??
              0,

            teamMembers:
              summary.team_members ??
              0,
          },


          monthlyTrends:
            monthlyResult.rows,


          borrowingsByStatus:
            statusResult.rows,


          inventoryByCategory:
            categoryResult.rows,
        },
      });
    } catch (error) {
      console.error(
        '[ADMIN STATISTICS] error:',
        error
      );


      res.status(500).json({
        ok: false,

        message:
          'Gagal memuat statistik',
      });
    }
  }
);

// =====================================================
// ADMIN - SYSTEM TESTING
// =====================================================

app.get(
  '/api/admin/system-testing/:testKey',
  requireAdmin,
  async (req, res) => {
    const testKey =
      String(
        req.params.testKey ??
          ''
      ).trim();


    const makeResult = (
      status,
      details,
      checks = []
    ) => ({
      ok: true,
      data: {
        status,
        details,
        checks,
      },
    });


    try {
      // =================================================
      // DATABASE
      // =================================================

      if (
        testKey ===
        'database'
      ) {
        const checks = [];


        try {
          const connection =
            await pool.query(
              'SELECT 1 AS ok'
            );

          checks.push({
            label:
              'Koneksi PostgreSQL',
            ok:
              connection.rows[0]
                ?.ok === 1,
          });
        } catch {
          checks.push({
            label:
              'Koneksi PostgreSQL',
            ok: false,
          });
        }


        try {
          const result =
            await pool.query(`
              SELECT
                COUNT(*)::int AS count
              FROM public.borrowings
            `);


          checks.push({
            label:
              'Query sederhana (COUNT borrowings)',
            ok:
              Number.isFinite(
                Number(
                  result.rows[0]
                    ?.count
                )
              ),
          });
        } catch {
          checks.push({
            label:
              'Query sederhana (COUNT borrowings)',
            ok: false,
          });
        }


        const allOk =
          checks.every(
            (check) =>
              check.ok
          );


        return res.json(
          makeResult(
            allOk
              ? 'pass'
              : 'fail',

            allOk
              ? 'PostgreSQL terhubung dan query berhasil.'
              : 'Koneksi PostgreSQL atau query gagal.',

            checks
          )
        );
      }


      // =================================================
      // USER MANAGEMENT
      // =================================================

      if (
        testKey ===
        'userManagement'
      ) {
        const checks = [];


        try {
          await pool.query(`
            SELECT id
            FROM public.admin_users
            LIMIT 1
          `);

          checks.push({
            label:
              'Load admin user',
            ok: true,
          });
        } catch {
          checks.push({
            label:
              'Load admin user',
            ok: false,
          });
        }


        try {
          await pool.query(`
            SELECT id
            FROM public.roles
            LIMIT 1
          `);

          checks.push({
            label:
              'Load role',
            ok: true,
          });
        } catch {
          checks.push({
            label:
              'Load role',
            ok: false,
          });
        }


        const allOk =
          checks.every(
            (check) =>
              check.ok
          );


        return res.json(
          makeResult(
            allOk
              ? 'pass'
              : 'warning',

            allOk
              ? 'Data user dan role PostgreSQL dapat dibaca.'
              : 'Sebagian data user management tidak dapat dibaca.',

            checks
          )
        );
      }


      // =================================================
      // BORROWING
      // =================================================

      if (
        testKey ===
        'borrowing'
      ) {
        const checks = [];


        try {
          await pool.query(`
            SELECT id
            FROM public.borrowings
            LIMIT 1
          `);

          checks.push({
            label:
              'Tabel borrowings dapat diakses',
            ok: true,
          });
        } catch {
          checks.push({
            label:
              'Tabel borrowings dapat diakses',
            ok: false,
          });
        }


        try {
          await pool.query(`
            SELECT id
            FROM public.borrowing_items
            LIMIT 1
          `);

          checks.push({
            label:
              'Tabel borrowing_items dapat diakses',
            ok: true,
          });
        } catch {
          checks.push({
            label:
              'Tabel borrowing_items dapat diakses',
            ok: false,
          });
        }


        try {
          const result =
            await pool.query(`
              SELECT COUNT(*)::int AS count
              FROM public.workflow_templates
              WHERE is_active = true
            `);


          checks.push({
            label:
              'Workflow aktif tersedia',
            ok:
              Number(
                result.rows[0]
                  ?.count ??
                  0
              ) > 0,
          });
        } catch {
          checks.push({
            label:
              'Workflow aktif tersedia',
            ok: false,
          });
        }


        const allOk =
          checks.every(
            (check) =>
              check.ok
          );


        return res.json(
          makeResult(
            allOk
              ? 'pass'
              : 'fail',

            allOk
              ? 'Modul peminjaman PostgreSQL siap.'
              : 'Sebagian komponen peminjaman belum siap.',

            checks
          )
        );
      }


      // =================================================
      // WORKFLOW
      // =================================================

      if (
        testKey ===
        'workflow'
      ) {
        const templateResult =
          await pool.query(`
            SELECT
              id,
              name
            FROM public.workflow_templates
            WHERE is_active = true
            ORDER BY created_at ASC
            LIMIT 1
          `);


        const template =
          templateResult.rows[0];


        if (!template) {
          return res.json(
            makeResult(
              'fail',
              'Tidak ada workflow template aktif.',
              [
                {
                  label:
                    'Workflow template aktif',
                  ok: false,
                },
              ]
            )
          );
        }


        const stepsResult =
          await pool.query(
            `
              SELECT
                step_order,
                step_label

              FROM public.workflow_steps

              WHERE
                workflow_template_id =
                  $1

              ORDER BY
                step_order ASC
            `,
            [
              template.id,
            ]
          );


        const stepLabels =
          stepsResult.rows.map(
            (step) =>
              String(
                step.step_label ??
                  ''
              )
          );


        const expectedSteps = [
          'User',
          'Pembina',
          'Wakasek',
          'PJ',
          'Kepala Sarpras',
        ];


        const missing =
          expectedSteps.filter(
            (expected) =>
              !stepLabels.some(
                (label) =>
                  label.includes(
                    expected
                  )
              )
          );


        const checks = [
          {
            label:
              'Workflow template aktif',
            ok: true,
          },

          {
            label:
              `Langkah workflow (${stepLabels.length} langkah)`,
            ok:
              stepLabels.length >
              0,
          },
        ];


        if (
          missing.length >
          0
        ) {
          checks.push({
            label:
              `Status hilang: ${missing.join(
                ', '
              )}`,
            ok: false,
          });


          return res.json(
            makeResult(
              'fail',

              `Status workflow hilang: ${missing.join(
                ', '
              )}`,

              checks
            )
          );
        }


        return res.json(
          makeResult(
            'pass',

            `Workflow "${template.name}" memiliki ${stepLabels.length} langkah: ${stepLabels.join(
              ' -> '
            )}`,

            checks
          )
        );
      }


      // =================================================
      // AGENDA
      // =================================================

      if (
        testKey ===
        'agenda'
      ) {
        try {
          await pool.query(`
            SELECT id
            FROM public.agendas
            LIMIT 1
          `);


          return res.json(
            makeResult(
              'pass',
              'Tabel agenda PostgreSQL dapat diakses.',
              [
                {
                  label:
                    'Tabel agenda dapat diakses',
                  ok: true,
                },
              ]
            )
          );
        } catch {
          return res.json(
            makeResult(
              'fail',
              'Tabel agenda PostgreSQL tidak dapat diakses.',
              [
                {
                  label:
                    'Tabel agenda dapat diakses',
                  ok: false,
                },
              ]
            )
          );
        }
      }


      // =================================================
      // TIMELINE
      // =================================================

      if (
        testKey ===
        'timeline'
      ) {
        const result =
          await pool.query(`
            WITH dates AS (
              SELECT
                date_trunc(
                  'month',
                  CURRENT_DATE
                )::date
                  AS month_start,

                (
                  date_trunc(
                    'month',
                    CURRENT_DATE
                  ) +
                  INTERVAL '1 month'
                )::date
                  AS next_month
            )

            SELECT

              (
                SELECT
                  COUNT(*)::int

                FROM
                  public.agendas a,
                  dates d

                WHERE
                  a.event_date >=
                    d.month_start

                  AND a.event_date <
                    d.next_month
              ) AS agenda_count,


              (
                SELECT
                  COUNT(*)::int

                FROM
                  public.borrowings b,
                  dates d

                WHERE
                  b.borrow_date <
                    d.next_month

                  AND
                  COALESCE(
                    b.return_date,
                    b.borrow_date
                  ) >=
                    d.month_start
              ) AS borrowing_count
          `);


        const row =
          result.rows[0] ??
          {};


        const agendaCount =
          Number(
            row.agenda_count ??
              0
          );


        const borrowingCount =
          Number(
            row.borrowing_count ??
              0
          );


        return res.json(
          makeResult(
            'pass',

            agendaCount +
              borrowingCount >
            0
              ? `Timeline berfungsi. ${agendaCount} agenda, ${borrowingCount} peminjaman bulan ini.`
              : 'Timeline berfungsi, namun tidak ada data bulan ini.',

            [
              {
                label:
                  'Agenda dapat diambil',
                ok: true,
              },

              {
                label:
                  'Peminjaman dapat diambil',
                ok: true,
              },
            ]
          )
        );
      }


      // =================================================
      // ANNOUNCEMENT
      // =================================================

      if (
        testKey ===
        'announcement'
      ) {
        const result =
          await pool.query(`
            SELECT
              id,
              title,
              status
            FROM public.announcements
            ORDER BY created_at DESC
            LIMIT 5
          `);


        const hasData =
          result.rows.length >
          0;


        return res.json(
          makeResult(
            hasData
              ? 'pass'
              : 'warning',

            hasData
              ? `${result.rows.length} pengumuman ditemukan.`
              : 'Tabel dapat dibaca tetapi belum ada pengumuman.',

            [
              {
                label:
                  'Membaca data pengumuman',
                ok: true,
              },

              {
                label:
                  'Data tersedia',
                ok:
                  hasData,
              },
            ]
          )
        );
      }


      // =================================================
      // INVENTORY
      // =================================================

      if (
        testKey ===
        'inventory'
      ) {
        const checks = [];


        try {
          const inventory =
            await pool.query(`
              SELECT
                id,
                name,
                condition
              FROM public.inventory
              LIMIT 5
            `);


          checks.push({
            label:
              'Load inventaris',
            ok: true,
          });


          checks.push({
            label:
              'Kondisi terbaca',
            ok:
              inventory.rows.length >
              0,
          });
        } catch {
          checks.push({
            label:
              'Load inventaris',
            ok: false,
          });

          checks.push({
            label:
              'Kondisi terbaca',
            ok: false,
          });
        }


        try {
          await pool.query(`
            SELECT
              id,
              name
            FROM public.categories
            LIMIT 1
          `);


          checks.push({
            label:
              'Kategori dapat diakses',
            ok: true,
          });
        } catch {
          checks.push({
            label:
              'Kategori dapat diakses',
            ok: false,
          });
        }


        const allOk =
          checks.every(
            (check) =>
              check.ok
          );


        return res.json(
          makeResult(
            allOk
              ? 'pass'
              : 'warning',

            allOk
              ? 'Modul inventaris PostgreSQL berfungsi.'
              : 'Sebagian komponen inventaris belum siap.',

            checks
          )
        );
      }


      // =================================================
      // POSTGRESQL ACCESS
      // Pengganti test RLS lama.
      // =================================================

      if (
        testKey ===
        'postgresAccess'
      ) {
        const tables = [
          'borrowings',
          'borrowing_items',
          'agendas',
          'announcements',
          'permissions',
          'role_permissions',
        ];


        const checks = [];


        for (
          const table of
          tables
        ) {
          try {
            await pool.query(
              `SELECT 1 FROM public.${table} LIMIT 1`
            );


            checks.push({
              label:
                `Tabel ${table}`,
              ok: true,
            });
          } catch {
            checks.push({
              label:
                `Tabel ${table}`,
              ok: false,
            });
          }
        }


        const allOk =
          checks.every(
            (check) =>
              check.ok
          );


        return res.json(
          makeResult(
            allOk
              ? 'pass'
              : 'fail',

            allOk
              ? 'Semua tabel utama PostgreSQL dapat diakses melalui backend.'
              : 'Beberapa tabel PostgreSQL tidak dapat diakses.',

            checks
          )
        );
      }


      return res.status(
        404
      ).json({
        ok: false,
        message:
          'Jenis system test tidak ditemukan',
      });
    } catch (error) {
      console.error(
        '[SYSTEM TESTING]',
        testKey,
        error
      );


      res.status(500).json({
        ok: false,
        message:
          `Test ${testKey} gagal dijalankan`,
      });
    }
  }
);

// =====================================================
// PUBLIC - TIMELINE
// =====================================================

// =====================================================
// EVENTS PER BULAN
// month = 1-12
// =====================================================

app.get(
  '/api/timeline/events',
  optionalAuth,
  async (req, res) => {
    try {
      const year = Number(
        req.query.year
      );

      const month = Number(
        req.query.month
      );

      const includeBorrowings =
        req.isSuperAdmin === true &&
        String(
          req.query.includeBorrowings ??
            'false'
        ) === 'true';


      if (
        !Number.isInteger(year) ||
        year < 2000 ||
        year > 2100 ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Tahun atau bulan tidak valid',
        });
      }


      const agendaResult =
        await pool.query(
          `
            WITH bounds AS (
              SELECT
                make_date(
                  $1,
                  $2,
                  1
                ) AS start_date,

                (
                  make_date(
                    $1,
                    $2,
                    1
                  ) +
                  INTERVAL '1 month'
                )::date AS next_month
            )

            SELECT
              a.id,
              a.title,
              to_jsonb(a)->>'category' AS category,
              LEFT(a.event_date::text, 10) AS event_date,
              NULLIF(
                LEFT(
                  COALESCE(
                    to_jsonb(a)->>'end_date',
                    ''
                  ),
                  10
                ),
                ''
              ) AS end_date,
              to_jsonb(a)->>'start_time' AS start_time,
              to_jsonb(a)->>'end_time' AS end_time,
              to_jsonb(a)->>'location' AS location,
              to_jsonb(a)->>'organizer' AS organizer,
              to_jsonb(a)->>'description' AS description,
              to_jsonb(a)->>'status' AS status,
              to_jsonb(a)->>'penyelenggara' AS penyelenggara,
              to_jsonb(a)->>'organisasi_jurusan' AS organisasi_jurusan,
              to_jsonb(a)->>'penanggung_jawab' AS penanggung_jawab,
              to_jsonb(a)->>'jenis_kegiatan' AS jenis_kegiatan,
              to_jsonb(a)->>'email' AS email,
              to_jsonb(a)->>'contact_phone' AS contact_phone,
              CASE
                WHEN (to_jsonb(a)->>'jumlah_peserta') ~ '^\d+$'
                  THEN (to_jsonb(a)->>'jumlah_peserta')::int
                ELSE 0
              END AS jumlah_peserta

            FROM
              public.agendas a,
              bounds b

            WHERE
              a.event_date <
                b.next_month

              AND
              a.end_date >=
                b.start_date

            ORDER BY
              a.event_date ASC,
              (to_jsonb(a)->>'start_time') ASC NULLS LAST
          `,
          [
            year,
            month,
          ]
        );


      let borrowings = [];


      if (
        includeBorrowings
      ) {
        const borrowingResult =
          await pool.query(
            `
              WITH bounds AS (
                SELECT
                  make_date(
                    $1,
                    $2,
                    1
                  ) AS start_date,

                  (
                    make_date(
                      $1,
                      $2,
                      1
                    ) +
                    INTERVAL '1 month'
                  )::date AS next_month
              )

              SELECT
                br.id,
                br.borrower_name,
                br.borrow_date,
                br.return_date,
                br.start_time,
                br.end_time,
                br.purpose,
                br.status::text AS status,
                br.item_type,
                br.notes

              FROM
                public.borrowings br,
                bounds b

              WHERE
                br.borrow_date <
                  b.next_month

                AND
                COALESCE(
                  br.return_date,
                  br.borrow_date
                ) >=
                  b.start_date

              ORDER BY
                br.borrow_date ASC
            `,
            [
              year,
              month,
            ]
          );


        borrowings =
          borrowingResult.rows;
      }


      res.json({
        ok: true,

        data: {
          agendas:
            agendaResult.rows,

          borrowings,
        },
      });
    } catch (error) {
      console.error(
        '[TIMELINE EVENTS] error:',
        error
      );


      res.status(500).json({
        ok: false,

        message:
          'Gagal mengambil data timeline',
      });
    }
  }
);


// =====================================================
// COUNTS
// =====================================================

app.get(
  '/api/timeline/counts',
  optionalAuth,
  async (req, res) => {
    try {
      const today =
        String(
          req.query.today ??
            ''
        );

      const weekEnd =
        String(
          req.query.weekEnd ??
            ''
        );

      const includeBorrowings =
        req.isSuperAdmin === true &&
        String(
          req.query.includeBorrowings ??
            'false'
        ) === 'true';


      const datePattern =
        /^\d{4}-\d{2}-\d{2}$/;


      if (
        !datePattern.test(today) ||
        !datePattern.test(weekEnd)
      ) {
        return res.status(400).json({
          ok: false,

          message:
            'Tanggal timeline tidak valid',
        });
      }


      const agendaResult =
        await pool.query(
          `
            SELECT
              COUNT(*) FILTER (
                WHERE
                  event_date <=
                    $1::date
                  AND
                  end_date >=
                    $1::date
              )::int
                AS today_count,

              COUNT(*) FILTER (
                WHERE
                  event_date <=
                    $2::date
                  AND
                  end_date >=
                    $1::date
              )::int
                AS week_count

            FROM
              public.agendas
          `,
          [
            today,
            weekEnd,
          ]
        );


      const agendaToday =
        Number(
          agendaResult.rows[0]
            ?.today_count ??
            0
        );


      const weekAgenda =
        Number(
          agendaResult.rows[0]
            ?.week_count ??
            0
        );


      let borrowToday =
        0;

      let weekBorrow =
        0;


      if (
        includeBorrowings
      ) {
        const borrowingResult =
          await pool.query(
            `
              SELECT
                COUNT(*) FILTER (
                  WHERE
                    borrow_date =
                      $1::date
                )::int
                  AS today_count,

                COUNT(*) FILTER (
                  WHERE
                    borrow_date >=
                      $1::date

                    AND
                    borrow_date <=
                      $2::date
                )::int
                  AS week_count

              FROM
                public.borrowings
            `,
            [
              today,
              weekEnd,
            ]
          );


        borrowToday =
          Number(
            borrowingResult
              .rows[0]
              ?.today_count ??
              0
          );


        weekBorrow =
          Number(
            borrowingResult
              .rows[0]
              ?.week_count ??
              0
          );
      }


      res.json({
        ok: true,

        data: {
          agendaToday,

          borrowToday,

          weekTotal:
            weekAgenda +
            weekBorrow,
        },
      });
    } catch (error) {
      console.error(
        '[TIMELINE COUNTS] error:',
        error
      );


      res.status(500).json({
        ok: false,

        message:
          'Gagal menghitung data timeline',
      });
    }
  }
);

// =====================================================
// PUBLIC - ASPIRASI
// =====================================================

app.post(
  '/api/aspirasi',
  publicWriteLimiter,
  async (req, res) => {
    try {
      const anonim =
        req.body?.anonim ===
        true;


      const judul =
        String(
          req.body?.judul ??
            ''
        ).trim();


      const isi =
        String(
          req.body?.isi ??
            ''
        ).trim();


      const kategori =
        String(
          req.body?.kategori ??
            'Lainnya'
        ).trim();


      if (!judul) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Judul wajib diisi',
        });
      }


      if (!isi) {
        return res.status(
          400
        ).json({
          ok: false,
          message:
            'Isi aspirasi wajib diisi',
        });
      }


      const nama =
        anonim
          ? 'Anonim'
          : String(
              req.body?.nama ??
                ''
            ).trim() ||
            'Anonim';


      const kelasUnit =
        anonim
          ? '-'
          : String(
              req.body?.kelas_unit ??
                ''
            ).trim() ||
            '-';


      const result =
        await pool.query(
          `
            INSERT INTO
              public.aspirasi (
                nama,
                kelas_unit,
                kategori,
                judul,
                isi,
                status
              )

            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              'pending'
            )

            RETURNING
              id,
              nama,
              kelas_unit,
              kategori,
              judul,
              isi,
              status::text AS status,
              created_at
          `,
          [
            nama,
            kelasUnit,
            kategori,
            judul,
            isi,
          ]
        );


      res.status(201).json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[PUBLIC ASPIRASI] POST error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal mengirim aspirasi',
      });
    }
  }
);

// =====================================================
// KAVLING
// =====================================================

// =====================================================
// MASTER OPTIONS
// =====================================================

app.get(
  '/api/kavling/options',

  async (req, res) => {
    try {
      const [
        kelasResult,
        ekstrakurikulerResult,
      ] =
        await Promise.all([
          pool.query(`
            SELECT
              id,
              nama,
              is_active,
              created_at

            FROM
              public.master_kelas

            WHERE
              is_active = true

            ORDER BY
              nama ASC
          `),


          pool.query(`
            SELECT
              id,
              nama,
              is_active,
              created_at

            FROM
              public.master_ekstrakurikuler

            WHERE
              is_active = true

            ORDER BY
              nama ASC
          `),
        ]);


      res.json({
        ok: true,

        data: {
          kelas:
            kelasResult.rows,

          ekstrakurikuler:
            ekstrakurikulerResult.rows,
        },
      });
    } catch (error) {
      console.error(
        '[KAVLING OPTIONS] error:',
        error
      );


      res.status(500).json({
        ok: false,

        message:
          'Gagal memuat pilihan kavling',
      });
    }
  }
);


// =====================================================
// CREATE KAVLING
// =====================================================

app.post(
  '/api/kavling',

  publicWriteLimiter,

  async (req, res) => {
    try {
      const allowedKategori = [
        'Kelas',
        'Ekstrakurikuler',
        'Unit',
      ];


      const namaPj =
        String(
          req.body?.nama_pj ??
            ''
        ).trim();


      const kategori =
        String(
          req.body?.kategori ??
            ''
        ).trim();


      const namaKategori =
        String(
          req.body?.nama_kategori ??
            ''
        ).trim();


      const tanggal =
        String(
          req.body?.tanggal ??
            ''
        ).trim();


      const lokasi =
        String(
          req.body?.lokasi ??
            ''
        ).trim();


      const judul =
        String(
          req.body?.judul ??
            ''
        ).trim();


      const deskripsi =
        String(
          req.body?.deskripsi ??
            ''
        ).trim();


      const hasil =
        String(
          req.body?.hasil ??
            ''
        ).trim();


      const catatan =
        String(
          req.body?.catatan ??
            ''
        ).trim();


      const fileUrl =
        String(
          req.body?.file_url ??
            ''
        ).trim();


      const fileName =
        String(
          req.body?.file_name ??
            ''
        ).trim();


      if (!namaPj) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Nama penanggung jawab wajib diisi',
          });
      }


      if (
        !allowedKategori.includes(
          kategori
        )
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Kategori kavling tidak valid',
          });
      }


      if (!namaKategori) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Nama kelas / ekstrakurikuler / organisasi wajib diisi',
          });
      }


      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          tanggal
        )
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Tanggal pelaksanaan tidak valid',
          });
      }


      if (!lokasi) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Lokasi kavling wajib diisi',
          });
      }


      if (!judul) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Judul kegiatan wajib diisi',
          });
      }


      if (!deskripsi) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Deskripsi kegiatan wajib diisi',
          });
      }


      if (!hasil) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Hasil kavling wajib diisi',
          });
      }


      if (
        !fileUrl ||
        !fileName
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Bukti pendukung wajib diupload',
          });
      }


      // ===============================================
      // Pastikan pilihan master masih aktif
      // ===============================================

      if (
        kategori ===
        'Kelas'
      ) {
        const valid =
          await pool.query(
            `
              SELECT 1

              FROM
                public.master_kelas

              WHERE
                nama = $1

                AND
                  is_active = true

              LIMIT 1
            `,
            [
              namaKategori,
            ]
          );


        if (
          valid.rowCount ===
          0
        ) {
          return res
            .status(400)
            .json({
              ok: false,

              message:
                'Kelas tidak tersedia atau sudah dinonaktifkan',
            });
        }
      }


      if (
        kategori ===
        'Ekstrakurikuler'
      ) {
        const valid =
          await pool.query(
            `
              SELECT 1

              FROM
                public.master_ekstrakurikuler

              WHERE
                nama = $1

                AND
                  is_active = true

              LIMIT 1
            `,
            [
              namaKategori,
            ]
          );


        if (
          valid.rowCount ===
          0
        ) {
          return res
            .status(400)
            .json({
              ok: false,

              message:
                'Ekstrakurikuler tidak tersedia atau sudah dinonaktifkan',
            });
        }
      }


      const result =
        await pool.query(
          `
            INSERT INTO
              public.kavling (
                nama_pj,
                kelas_unit,
                kategori,
                nama_kategori,
                tanggal,
                lokasi,
                judul,
                deskripsi,
                hasil,
                catatan,
                file_url,
                file_name,
                status,
                created_by
              )

            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5::date,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              $12,
              $13,
              $14
            )

            RETURNING
              id,
              nama_pj,
              kategori,
              nama_kategori,
              tanggal,
              lokasi,
              judul,
              status,
              created_at
          `,
          [
            namaPj,

            // kompatibilitas data lama
            kategori,

            kategori,

            namaKategori,

            tanggal,

            lokasi,

            judul,

            deskripsi,

            hasil,

            catatan,

            fileUrl,

            fileName,

            'Menunggu Verifikasi',

            // Input publik tidak memerlukan akun.
            req.authUser?.id ?? null,
          ]
        );


      res.status(201).json({
        ok: true,

        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[KAVLING CREATE] error:',
        error
      );


      res.status(500).json({
        ok: false,

        message:
          'Gagal menyimpan data kavling',
      });
    }
  }
);

// =====================================================
// KAVLING - DATA
// =====================================================

// =====================================================
// PUBLIC GET ALL
// Dipakai /kavling/data dan admin data kavling
// =====================================================

app.get(
  '/api/kavling',
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            nama_pj,
            kelas_unit,
            kategori,
            nama_kategori,
            tanggal,
            lokasi,
            judul,
            deskripsi,
            hasil,
            catatan,
            file_url,
            file_name,
            status,
            created_at,
            updated_at

          FROM
            public.kavling

          ORDER BY
            tanggal DESC,
            created_at DESC
        `);


      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[KAVLING GET] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat data kavling',
      });
    }
  }
);


// =====================================================
// ADMIN - EDIT DATA
// =====================================================

app.patch(
  '/api/admin/kavling/:id',

  requireAdmin,

  requirePermission(
    'kavling',
    'update'
  ),

  async (req, res) => {
    try {
      const namaPj =
        String(
          req.body?.nama_pj ??
            ''
        ).trim();


      const namaKategori =
        String(
          req.body?.nama_kategori ??
            ''
        ).trim();


      const tanggal =
        String(
          req.body?.tanggal ??
            ''
        ).trim();


      const lokasi =
        String(
          req.body?.lokasi ??
            ''
        ).trim();


      const judul =
        String(
          req.body?.judul ??
            ''
        ).trim();


      const deskripsi =
        String(
          req.body?.deskripsi ??
            ''
        ).trim();


      const hasil =
        String(
          req.body?.hasil ??
            ''
        ).trim();


      const catatan =
        String(
          req.body?.catatan ??
            ''
        ).trim();


      if (!namaPj) {
        return res.status(400).json({
          ok: false,
          message:
            'Nama PJ wajib diisi',
        });
      }


      if (!namaKategori) {
        return res.status(400).json({
          ok: false,
          message:
            'Nama kategori wajib diisi',
        });
      }


      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          tanggal
        )
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Tanggal tidak valid',
        });
      }


      if (
        !lokasi ||
        !judul ||
        !deskripsi ||
        !hasil
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Data wajib belum lengkap',
        });
      }


      const result =
        await pool.query(
          `
            UPDATE
              public.kavling

            SET
              nama_pj = $1,
              nama_kategori = $2,
              tanggal = $3,
              lokasi = $4,
              judul = $5,
              deskripsi = $6,
              hasil = $7,
              catatan = $8,
              updated_at = NOW()

            WHERE
              id = $9

            RETURNING
              id,
              nama_pj,
              kelas_unit,
              kategori,
              nama_kategori,
              tanggal,
              lokasi,
              judul,
              deskripsi,
              hasil,
              catatan,
              file_url,
              file_name,
              status,
              created_at,
              updated_at
          `,
          [
            namaPj,
            namaKategori,
            tanggal,
            lokasi,
            judul,
            deskripsi,
            hasil,
            catatan,
            req.params.id,
          ]
        );


      if (
        result.rowCount ===
        0
      ) {
        return res.status(404).json({
          ok: false,
          message:
            'Data kavling tidak ditemukan',
        });
      }


      res.json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[KAVLING UPDATE] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal memperbarui data kavling',
      });
    }
  }
);


// =====================================================
// ADMIN - VERIFY / REJECT
// =====================================================

app.patch(
  '/api/admin/kavling/:id/status',

  requireAdmin,

  requirePermission(
    'kavling',
    'verify'
  ),

  async (req, res) => {
    try {
      const status =
        String(
          req.body?.status ??
            ''
        ).trim();


      const allowedStatuses = [
        'Menunggu Verifikasi',
        'Diverifikasi',
        'Ditolak',
      ];


      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Status kavling tidak valid',
        });
      }


      const result =
        await pool.query(
          `
            UPDATE
              public.kavling

            SET
              status = $1,
              updated_at = NOW()

            WHERE
              id = $2

            RETURNING
              id,
              status,
              updated_at
          `,
          [
            status,
            req.params.id,
          ]
        );


      if (
        result.rowCount ===
        0
      ) {
        return res.status(404).json({
          ok: false,
          message:
            'Data kavling tidak ditemukan',
        });
      }


      res.json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[KAVLING STATUS] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal mengubah status kavling',
      });
    }
  }
);


// =====================================================
// ADMIN - DELETE
// =====================================================

app.delete(
  '/api/admin/kavling/:id',

  requireAdmin,

  requirePermission(
    'kavling',
    'delete'
  ),

  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            DELETE FROM
              public.kavling

            WHERE
              id = $1

            RETURNING
              id
          `,
          [
            req.params.id,
          ]
        );


      if (
        result.rowCount ===
        0
      ) {
        return res.status(404).json({
          ok: false,
          message:
            'Data kavling tidak ditemukan',
        });
      }


      res.json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[KAVLING DELETE] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal menghapus data kavling',
      });
    }
  }
);

// =====================================================
// PUBLIC - TEAM
// =====================================================

app.get(
  '/api/team',
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            name,
            position,
            role,
            photo_url,
            description,
            email,
            phone,
            "order"

          FROM
            public.team_members

          WHERE
            is_active = true

          ORDER BY
            "order" ASC,
            name ASC
        `);


      res.json({
        ok: true,
        data:
          result.rows,
      });
    } catch (error) {
      console.error(
        '[PUBLIC TEAM] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat tim pengelola',
      });
    }
  }
);

// =====================================================
// ADMIN - ROLES
// =====================================================

// =====================================================
// GET ROLES
// =====================================================

app.get(
  '/api/admin/roles',
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            name,
            description,
            level,
            is_system,
            is_active,
            created_at

          FROM
            public.roles

          ORDER BY
            level DESC NULLS LAST,
            name ASC
        `);


      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[ADMIN ROLES GET] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat role',
      });
    }
  }
);


// =====================================================
// CREATE ROLE
// =====================================================

app.post(
  '/api/admin/roles',

  requireAdmin,

  requirePermission(
    'roles',
    'create'
  ),

  async (req, res) => {
    try {
      const name =
        String(
          req.body?.name ??
            ''
        ).trim();


      const descriptionRaw =
        String(
          req.body?.description ??
            ''
        ).trim();


      const level =
        Number(
          req.body?.level ??
            0
        );


      const isActive =
        req.body?.is_active !==
        false;


      if (!name) {
        return res.status(400).json({
          ok: false,
          message:
            'Nama role wajib diisi',
        });
      }


      if (
        !Number.isInteger(level)
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Level role tidak valid',
        });
      }


      const duplicate =
        await pool.query(
          `
            SELECT id
            FROM public.roles
            WHERE LOWER(name) =
              LOWER($1)
            LIMIT 1
          `,
          [name]
        );


      if (
        duplicate.rowCount >
        0
      ) {
        return res.status(409).json({
          ok: false,
          message:
            'Nama role sudah digunakan',
        });
      }


      const result =
        await pool.query(
          `
            INSERT INTO
              public.roles (
                name,
                description,
                level,
                is_active,
                is_system
              )

            VALUES (
              $1,
              $2,
              $3,
              $4,
              false
            )

            RETURNING
              id,
              name,
              description,
              level,
              is_system,
              is_active,
              created_at
          `,
          [
            name,
            descriptionRaw || null,
            level,
            isActive,
          ]
        );


      res.status(201).json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[ADMIN ROLES CREATE] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal menambahkan role',
      });
    }
  }
);


// =====================================================
// UPDATE ROLE
// =====================================================

app.patch(
  '/api/admin/roles/:id',

  requireAdmin,

  requirePermission(
    'roles',
    'update'
  ),

  async (req, res) => {
    try {
      const roleResult =
        await pool.query(
          `
            SELECT
              id,
              is_system

            FROM
              public.roles

            WHERE
              id = $1

            LIMIT 1
          `,
          [
            req.params.id,
          ]
        );


      const currentRole =
        roleResult.rows[0];


      if (!currentRole) {
        return res.status(404).json({
          ok: false,
          message:
            'Role tidak ditemukan',
        });
      }


      const name =
        String(
          req.body?.name ??
            ''
        ).trim();


      const descriptionRaw =
        String(
          req.body?.description ??
            ''
        ).trim();


      const level =
        Number(
          req.body?.level ??
            0
        );


      const isActive =
        req.body?.is_active !==
        false;


      if (!name) {
        return res.status(400).json({
          ok: false,
          message:
            'Nama role wajib diisi',
        });
      }


      if (
        !Number.isInteger(level)
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Level role tidak valid',
        });
      }


      const duplicate =
        await pool.query(
          `
            SELECT id

            FROM
              public.roles

            WHERE
              LOWER(name) =
                LOWER($1)

              AND
                id <> $2

            LIMIT 1
          `,
          [
            name,
            req.params.id,
          ]
        );


      if (
        duplicate.rowCount >
        0
      ) {
        return res.status(409).json({
          ok: false,
          message:
            'Nama role sudah digunakan',
        });
      }


      const result =
        await pool.query(
          `
            UPDATE
              public.roles

            SET
              name = $1,
              description = $2,
              level = $3,
              is_active = $4

            WHERE
              id = $5

            RETURNING
              id,
              name,
              description,
              level,
              is_system,
              is_active,
              created_at
          `,
          [
            name,
            descriptionRaw || null,
            level,
            isActive,
            req.params.id,
          ]
        );


      res.json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[ADMIN ROLES UPDATE] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal memperbarui role',
      });
    }
  }
);


// =====================================================
// DELETE ROLE
// =====================================================

app.delete(
  '/api/admin/roles/:id',

  requireAdmin,

  requirePermission(
    'roles',
    'delete'
  ),

  async (req, res) => {
    const client =
      await pool.connect();


    try {
      await client.query(
        'BEGIN'
      );


      const roleResult =
        await client.query(
          `
            SELECT
              id,
              name,
              is_system

            FROM
              public.roles

            WHERE
              id = $1

            FOR UPDATE
          `,
          [
            req.params.id,
          ]
        );


      const role =
        roleResult.rows[0];


      if (!role) {
        await client.query(
          'ROLLBACK'
        );


        return res.status(404).json({
          ok: false,
          message:
            'Role tidak ditemukan',
        });
      }


      if (
        role.is_system ===
        true
      ) {
        await client.query(
          'ROLLBACK'
        );


        return res.status(400).json({
          ok: false,
          message:
            'Role sistem tidak dapat dihapus',
        });
      }


      // Hapus mapping permission role
      await client.query(
        `
          DELETE FROM
            public.role_permissions

          WHERE
            role_id = $1
        `,
        [
          role.id,
        ]
      );


      // Hapus assignment role ke admin
      await client.query(
        `
          DELETE FROM
            public.admin_user_roles

          WHERE
            role_id = $1
        `,
        [
          role.id,
        ]
      );


      await client.query(
        `
          DELETE FROM
            public.roles

          WHERE
            id = $1
        `,
        [
          role.id,
        ]
      );


      await client.query(
        'COMMIT'
      );


      res.json({
        ok: true,

        data: {
          id:
            role.id,

          name:
            role.name,
        },
      });
    } catch (error) {
      await client.query(
        'ROLLBACK'
      );


      console.error(
        '[ADMIN ROLES DELETE] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal menghapus role',
      });
    } finally {
      client.release();
    }
  }
);

// =====================================================
// ADMIN - USER MANAGEMENT
// =====================================================

// =====================================================
// GET USERS + ROLE
// =====================================================

app.get(
  '/api/admin/users',
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            au.id,
            au.user_id,
            au.email,
            au.name,
            au.role,
            au.is_active,
            au.created_at,

            (
              SELECT r.name
              FROM public.admin_user_roles aur
              INNER JOIN public.roles r
                ON r.id = aur.role_id
              WHERE aur.admin_user_id = au.id
              ORDER BY r.level DESC NULLS LAST
              LIMIT 1
            ) AS role_name

          FROM public.admin_users au

          ORDER BY
            au.created_at DESC
        `);


      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[ADMIN USERS GET] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat data pengguna',
      });
    }
  }
);


// =====================================================
// GET ACTIVE ROLES
// =====================================================

app.get(
  '/api/admin/users/roles',
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            name,
            level,
            is_active

          FROM public.roles

          WHERE
            is_active = true

          ORDER BY
            level DESC NULLS LAST,
            name ASC
        `);


      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[ADMIN USERS ROLES] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat daftar role',
      });
    }
  }
);


// =====================================================
// CREATE ADMIN USER
// =====================================================

app.post(
  '/api/admin/users',

  requireAdmin,

  requirePermission(
    'users',
    'create'
  ),

  async (req, res) => {
    const client =
      await pool.connect();


    try {
      const email =
        String(
          req.body?.email ??
            ''
        )
          .trim()
          .toLowerCase();


      const name =
        String(
          req.body?.name ??
            ''
        ).trim();


      const roleId =
        String(
          req.body?.role_id ??
            ''
        ).trim();


      if (!email) {
        return res.status(400).json({
          ok: false,
          message:
            'Email wajib diisi',
        });
      }


      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


      if (
        !emailPattern.test(
          email
        )
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Format email tidak valid',
        });
      }


      await client.query(
        'BEGIN'
      );


      const duplicate =
        await client.query(
          `
            SELECT id

            FROM public.admin_users

            WHERE
              LOWER(email) =
                LOWER($1)

            LIMIT 1
          `,
          [email]
        );


      if (
        duplicate.rowCount >
        0
      ) {
        await client.query(
          'ROLLBACK'
        );


        return res.status(409).json({
          ok: false,
          message:
            'Email sudah terdaftar sebagai admin',
        });
      }


      let roleName =
        null;


      if (roleId) {
        const roleResult =
          await client.query(
            `
              SELECT
                id,
                name

              FROM public.roles

              WHERE
                id = $1

                AND
                is_active = true

              LIMIT 1
            `,
            [roleId]
          );


        if (
          roleResult.rowCount ===
          0
        ) {
          await client.query(
            'ROLLBACK'
          );


          return res.status(400).json({
            ok: false,
            message:
              'Role tidak ditemukan atau sudah nonaktif',
          });
        }


        roleName =
          roleResult.rows[0].name;
      }


      const userResult =
        await client.query(
          `
            INSERT INTO
              public.admin_users (
                email,
                name,
                role,
                is_active
              )

            VALUES (
              $1,
              $2,
              $3,
              true
            )

            RETURNING
              id,
              user_id,
              email,
              name,
              role,
              is_active,
              created_at
          `,
          [
            email,
            name || null,
            roleName,
          ]
        );


      const user =
        userResult.rows[0];


      if (roleId) {
        await client.query(
          `
            INSERT INTO
              public.admin_user_roles (
                admin_user_id,
                role_id
              )

            VALUES (
              $1,
              $2
            )

            ON CONFLICT DO NOTHING
          `,
          [
            user.id,
            roleId,
          ]
        );
      }


      await client.query(
        'COMMIT'
      );


      res.status(201).json({
        ok: true,

        data: {
          ...user,
          role_name:
            roleName,
        },
      });
    } catch (error) {
      await client.query(
        'ROLLBACK'
      );


      console.error(
        '[ADMIN USERS CREATE] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal menambahkan pengguna',
      });
    } finally {
      client.release();
    }
  }
);


// =====================================================
// CHANGE ROLE
// =====================================================

app.patch(
  '/api/admin/users/:id/role',

  requireAdmin,

  requirePermission(
    'users',
    'update'
  ),

  async (req, res) => {
    const client =
      await pool.connect();


    try {
      const roleId =
        String(
          req.body?.role_id ??
            ''
        ).trim();


      if (!roleId) {
        return res.status(400).json({
          ok: false,
          message:
            'Role wajib dipilih',
        });
      }


      await client.query(
        'BEGIN'
      );


      const adminResult =
        await client.query(
          `
            SELECT id

            FROM public.admin_users

            WHERE
              id = $1

            FOR UPDATE
          `,
          [
            req.params.id,
          ]
        );


      if (
        adminResult.rowCount ===
        0
      ) {
        await client.query(
          'ROLLBACK'
        );


        return res.status(404).json({
          ok: false,
          message:
            'Pengguna tidak ditemukan',
        });
      }


      const roleResult =
        await client.query(
          `
            SELECT
              id,
              name

            FROM public.roles

            WHERE
              id = $1

              AND
              is_active = true

            LIMIT 1
          `,
          [
            roleId,
          ]
        );


      if (
        roleResult.rowCount ===
        0
      ) {
        await client.query(
          'ROLLBACK'
        );


        return res.status(400).json({
          ok: false,
          message:
            'Role tidak ditemukan atau sudah nonaktif',
        });
      }


      const role =
        roleResult.rows[0];


      await client.query(
        `
          UPDATE
            public.admin_users

          SET
            role = $1

          WHERE
            id = $2
        `,
        [
          role.name,
          req.params.id,
        ]
      );


      await client.query(
        `
          DELETE FROM
            public.admin_user_roles

          WHERE
            admin_user_id = $1
        `,
        [
          req.params.id,
        ]
      );


      await client.query(
        `
          INSERT INTO
            public.admin_user_roles (
              admin_user_id,
              role_id
            )

          VALUES (
            $1,
            $2
          )
        `,
        [
          req.params.id,
          role.id,
        ]
      );


      await client.query(
        'COMMIT'
      );


      res.json({
        ok: true,

        data: {
          id:
            req.params.id,

          role_id:
            role.id,

          role_name:
            role.name,
        },
      });
    } catch (error) {
      await client.query(
        'ROLLBACK'
      );


      console.error(
        '[ADMIN USERS ROLE] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal memperbarui role pengguna',
      });
    } finally {
      client.release();
    }
  }
);


// =====================================================
// ACTIVE / NONACTIVE
// =====================================================

app.patch(
  '/api/admin/users/:id/status',

  requireAdmin,

  requirePermission(
    'users',
    'update'
  ),

  async (req, res) => {
    try {
      if (
        typeof req.body?.is_active !==
        'boolean'
      ) {
        return res.status(400).json({
          ok: false,
          message:
            'Status pengguna tidak valid',
        });
      }


      const result =
        await pool.query(
          `
            UPDATE
              public.admin_users

            SET
              is_active = $1

            WHERE
              id = $2

            RETURNING
              id,
              email,
              is_active
          `,
          [
            req.body.is_active,
            req.params.id,
          ]
        );


      if (
        result.rowCount ===
        0
      ) {
        return res.status(404).json({
          ok: false,
          message:
            'Pengguna tidak ditemukan',
        });
      }


      res.json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[ADMIN USERS STATUS] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal mengubah status pengguna',
      });
    }
  }
);


// =====================================================
// DELETE USER
// =====================================================

app.delete(
  '/api/admin/users/:id',

  requireAdmin,

  requirePermission(
    'users',
    'delete'
  ),

  async (req, res) => {
    const client =
      await pool.connect();


    try {
      await client.query(
        'BEGIN'
      );


      const userResult =
        await client.query(
          `
            SELECT
              id,
              email

            FROM public.admin_users

            WHERE
              id = $1

            FOR UPDATE
          `,
          [
            req.params.id,
          ]
        );


      const user =
        userResult.rows[0];


      if (!user) {
        await client.query(
          'ROLLBACK'
        );


        return res.status(404).json({
          ok: false,
          message:
            'Pengguna tidak ditemukan',
        });
      }


      await client.query(
        `
          DELETE FROM
            public.admin_user_roles

          WHERE
            admin_user_id = $1
        `,
        [
          user.id,
        ]
      );


      await client.query(
        `
          DELETE FROM
            public.admin_users

          WHERE
            id = $1
        `,
        [
          user.id,
        ]
      );


      await client.query(
        'COMMIT'
      );


      res.json({
        ok: true,

        data: {
          id:
            user.id,

          email:
            user.email,
        },
      });
    } catch (error) {
      await client.query(
        'ROLLBACK'
      );


      console.error(
        '[ADMIN USERS DELETE] error:',
        error
      );


      res.status(500).json({
        ok: false,
        message:
          'Gagal menghapus pengguna',
      });
    } finally {
      client.release();
    }
  }
);

// =====================================================
// HISTORY
// =====================================================

app.get(
  '/api/history',
  requireAuth,
  async (req, res) => {
    try {
      const [borrowingsResult, agendasResult] = await Promise.all([
        pool.query(`
          SELECT
            b.id,
            b.borrower_name,
            b.borrower_class,
            b.borrow_date,
            b.return_date,
            b.status,
            b.purpose,
            b.notes,
            b.item_type,
            b.created_at
          FROM public.borrowings b
          ORDER BY b.created_at DESC
        `),
        pool.query(`
          SELECT
            a.id,
            a.title,
            a.event_date,
            a.end_date,
            a.location,
            a.organisasi_jurusan,
            a.status,
            a.jenis_kegiatan
          FROM public.agendas a
          ORDER BY a.event_date DESC, a.created_at DESC
        `),
      ]);

      const borrowings = borrowingsResult.rows;
      const borrowingIds = borrowings.map((row) => row.id);

      let itemRows = [];

      if (borrowingIds.length > 0) {
        const itemsResult = await pool.query(
          `
            SELECT
              id,
              borrowing_id,
              item_type,
              item_name,
              quantity,
              status,
              current_status_label
            FROM public.borrowing_items
            WHERE borrowing_id = ANY($1::uuid[])
            ORDER BY created_at ASC
          `,
          [borrowingIds]
        );

        itemRows = itemsResult.rows;
      }

      for (const borrowing of borrowings) {
        borrowing.borrowing_items = itemRows.filter(
          (item) => String(item.borrowing_id) === String(borrowing.id)
        );
      }

      res.json({
        ok: true,
        data: {
          borrowings,
          agendas: agendasResult.rows,
        },
      });
    } catch (error) {
      console.error('[HISTORY] GET error:', error);

      res.status(500).json({
        ok: false,
        message: 'Gagal memuat riwayat',
      });
    }
  }
);

app.delete(
  '/api/admin/history/borrowings/:id',
  requireAdmin,
  requirePermission('history', 'delete'),
  async (req, res) => {
    try {
      const id = String(req.params.id ?? '').trim();

      const result = await pool.query(
        `
          DELETE FROM public.borrowings
          WHERE id = $1
          RETURNING id
        `,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Data peminjaman tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error('[HISTORY] DELETE borrowing error:', error);

      res.status(500).json({
        ok: false,
        message: 'Gagal menghapus riwayat peminjaman',
      });
    }
  }
);

app.delete(
  '/api/admin/history/agendas/:id',
  requireAdmin,
  requirePermission('history', 'delete'),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const id = String(req.params.id ?? '').trim();

      await client.query('BEGIN');

      await client.query(
        `DELETE FROM public.agenda_attachments WHERE agenda_id = $1`,
        [id]
      );

      const result = await client.query(
        `
          DELETE FROM public.agendas
          WHERE id = $1
          RETURNING id, title
        `,
        [id]
      );

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');

        return res.status(404).json({
          ok: false,
          message: 'Agenda tidak ditemukan',
        });
      }

      await client.query('COMMIT');

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[HISTORY] DELETE agenda error:', error);

      res.status(500).json({
        ok: false,
        message: 'Gagal menghapus agenda',
      });
    } finally {
      client.release();
    }
  }
);


// =====================================================
// ADMIN - REKAP DATA
// =====================================================

app.get(
  '/api/admin/rekap-data',

  requireAdmin,

  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            b.id::text AS id,
            b.borrow_date AS tanggal,
            'Peminjaman'::text AS jenis,

            COALESCE(
              NULLIF(
                b.purpose,
                ''
              ),
              '-'
            ) AS nama_kegiatan,

            COALESCE(
              NULLIF(
                b.borrower_class,
                ''
              ),
              '-'
            ) AS organisasi,

            COALESCE(
              NULLIF(
                b.approver_position,
                ''
              ),

              NULLIF(
                b.borrower_name,
                ''
              ),

              '-'
            ) AS penanggung_jawab,

            COALESCE(
              b.status::text,
              'pending'
            ) AS status,

            '-'::text AS lokasi

          FROM
            public.borrowings b


          UNION ALL


          SELECT
            a.id::text AS id,
            a.event_date AS tanggal,
            'Agenda'::text AS jenis,

            COALESCE(
              NULLIF(
                a.title,
                ''
              ),
              '-'
            ) AS nama_kegiatan,

            COALESCE(
              NULLIF(
                a.organisasi_jurusan,
                ''
              ),

              NULLIF(
                a.penyelenggara,
                ''
              ),

              '-'
            ) AS organisasi,

            COALESCE(
              NULLIF(
                a.penanggung_jawab,
                ''
              ),
              '-'
            ) AS penanggung_jawab,

            COALESCE(
              a.status::text,
              'draft'
            ) AS status,

            COALESCE(
              NULLIF(
                a.location,
                ''
              ),
              '-'
            ) AS lokasi

          FROM
            public.agendas a

          ORDER BY
            tanggal DESC
        `);


      const rows =
        result.rows.map(
          (
            row
          ) => ({
            id:
              row.id,

            tanggal:
              row.tanggal,

            jenis:
              row.jenis,

            namaKegiatan:
              row.nama_kegiatan,

            organisasi:
              row.organisasi,

            penanggungJawab:
              row.penanggung_jawab,

            status:
              row.status,

            lokasi:
              row.lokasi,
          })
        );


      res.json({
        ok: true,
        data:
          rows,
      });
    } catch (error) {
      console.error(
        '[ADMIN REKAP DATA] error:',
        error
      );


      res.status(500).json({
        ok: false,

        message:
          'Gagal memuat rekap data',
      });
    }
  }
);

// =====================================================
// PUBLIC - REKAP
// =====================================================

app.get(
  '/api/rekap',
  requireAuth,
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            a.id::text AS id,

            a.event_date::text
              AS tanggal,

            'Agenda'::text
              AS jenis,

            COALESCE(
              NULLIF(
                a.title,
                ''
              ),
              '-'
            ) AS nama_kegiatan,

            COALESCE(
              NULLIF(
                a.organisasi_jurusan,
                ''
              ),

              NULLIF(
                a.organizer,
                ''
              ),

              NULLIF(
                a.penyelenggara,
                ''
              ),

              '-'
            ) AS organisasi,

            COALESCE(
              NULLIF(
                a.penanggung_jawab,
                ''
              ),
              '-'
            ) AS penanggung_jawab,

            COALESCE(
              a.status::text,
              'draft'
            ) AS status,

            COALESCE(
              NULLIF(
                a.location,
                ''
              ),
              '-'
            ) AS lokasi

          FROM
            public.agendas a


          UNION ALL


          SELECT
            b.id::text AS id,

            COALESCE(
              b.borrow_date::text,
              b.created_at::date::text
            ) AS tanggal,

            'Peminjaman'::text
              AS jenis,

            COALESCE(
              NULLIF(
                b.purpose,
                ''
              ),

              NULLIF(
                (
                  SELECT
                    string_agg(
                      COALESCE(
                        NULLIF(
                          bi.item_name,
                          ''
                        ),
                        'Item'
                      ),
                      ', '
                      ORDER BY
                        bi.id
                    )

                  FROM
                    public.borrowing_items bi

                  WHERE
                    bi.borrowing_id =
                      b.id
                ),
                ''
              ),

              'Peminjaman'
            ) AS nama_kegiatan,

            COALESCE(
              NULLIF(
                b.borrower_class,
                ''
              ),
              '-'
            ) AS organisasi,

            COALESCE(
              NULLIF(
                b.borrower_name,
                ''
              ),
              '-'
            ) AS penanggung_jawab,

            COALESCE(
              NULLIF(
                b.current_status_label,
                ''
              ),

              b.status::text,

              'pending'
            ) AS status,

            '-'::text
              AS lokasi

          FROM
            public.borrowings b

          ORDER BY
            tanggal DESC
        `);


      const rows =
        result.rows.map(
          (
            row
          ) => ({
            id:
              row.id,

            tanggal:
              row.tanggal,

            jenis:
              row.jenis,

            namaKegiatan:
              row.nama_kegiatan,

            organisasi:
              row.organisasi,

            penanggungJawab:
              row.penanggung_jawab,

            status:
              row.status,

            lokasi:
              row.lokasi,
          })
        );


      res.json({
        ok: true,
        data:
          rows,
      });
    } catch (error) {
      console.error(
        '[PUBLIC REKAP] error:',
        error
      );


      res.status(500).json({
        ok: false,

        message:
          'Gagal memuat rekap kegiatan',
      });
    }
  }
);

// =====================================================
// AGENDA - ATTACHMENT METADATA
// =====================================================

app.post(
  '/api/agendas/:id/attachments',
  publicWriteLimiter,
  async (req, res) => {
    try {
      const agendaId =
        String(
          req.params.id || ''
        ).trim();

      const fileName =
        String(
          req.body?.file_name || ''
        ).trim();

      const filePath =
        String(
          req.body?.file_path || ''
        ).trim();

      const fileUrl =
        String(
          req.body?.file_url || ''
        ).trim();

      const fileSize =
        Number(
          req.body?.file_size || 0
        );

      const fileType =
        String(
          req.body?.file_type || ''
        ).trim();


      if (
        !agendaId ||
        !fileName ||
        !filePath ||
        !fileUrl
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Metadata lampiran tidak lengkap',
          });
      }


      const agendaResult =
        await pool.query(
          `
            SELECT id
            FROM public.agendas
            WHERE id = $1
            LIMIT 1
          `,
          [agendaId]
        );


      if (
        agendaResult.rowCount ===
        0
      ) {
        return res
          .status(404)
          .json({
            ok: false,
            message:
              'Agenda tidak ditemukan',
          });
      }


      const result =
        await pool.query(
          `
            INSERT INTO
              public.agenda_attachments (
                agenda_id,
                file_name,
                file_path,
                file_url,
                file_size,
                file_type
              )

            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6
            )

            RETURNING
              id,
              agenda_id,
              file_name,
              file_path,
              file_url,
              file_size,
              file_type
          `,
          [
            agendaId,
            fileName,
            filePath,
            fileUrl,
            Number.isFinite(fileSize)
              ? fileSize
              : 0,
            fileType || null,
          ]
        );


      res
        .status(201)
        .json({
          ok: true,
          data:
            result.rows[0],
        });
    } catch (error) {
      console.error(
        '[AGENDA ATTACHMENT] error:',
        error
      );


      res
        .status(500)
        .json({
          ok: false,
          message:
            'Gagal menyimpan metadata lampiran',
        });
    }
  }
);


// =====================================================
// AGENDA - NOTIFY FIRST APPROVER
// =====================================================

app.post(
  '/api/agendas/:id/notify',
  publicWriteLimiter,
  async (req, res) => {
    try {
      const agendaId =
        String(
          req.params.id || ''
        ).trim();

      const roleId =
        String(
          req.body?.role_id || ''
        ).trim();

      const uploadedFileCount =
        Math.max(
          0,
          Number(
            req.body
              ?.uploaded_file_count ||
              0
          )
        );


      if (
        !agendaId ||
        !roleId
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Agenda atau role approver tidak valid',
          });
      }


      // =================================================
      // LOAD AGENDA
      // =================================================

      const agendaResult =
        await pool.query(
          `
            SELECT
              id,
              title,
              jenis_kegiatan,
              organisasi_jurusan,
              penanggung_jawab,
              contact_phone,
              location,
              event_date,
              end_date,
              start_time,
              end_time

            FROM
              public.agendas

            WHERE
              id = $1

            LIMIT 1
          `,
          [agendaId]
        );


      const agenda =
        agendaResult.rows[0];


      if (!agenda) {
        return res
          .status(404)
          .json({
            ok: false,
            message:
              'Agenda tidak ditemukan',
          });
      }


      // =================================================
      // VALIDATE ROLE
      // =================================================

      const roleResult =
        await pool.query(
          `
            SELECT id
            FROM public.roles
            WHERE id = $1
              AND COALESCE(
                is_active,
                true
              ) = true
            LIMIT 1
          `,
          [roleId]
        );


      if (
        roleResult.rowCount ===
        0
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Role approver tidak ditemukan',
          });
      }


      // =================================================
      // FIND ACTIVE ADMIN EMAILS
      // =================================================

      const adminsResult =
        await pool.query(
          `
            SELECT DISTINCT
              au.email

            FROM
              public.admin_user_roles aur

            INNER JOIN
              public.admin_users au
                ON au.id =
                  aur.admin_user_id

            WHERE
              aur.role_id = $1

              AND
                au.is_active = true

              AND
                au.email IS NOT NULL

              AND
                au.email <> ''
          `,
          [roleId]
        );


      const recipientEmails =
        adminsResult.rows
          .map(
            (row) =>
              row.email
          )
          .filter(Boolean);


      if (
        recipientEmails.length ===
        0
      ) {
        return res.json({
          ok: true,

          data: {
            queued: 0,
          },

          message:
            'Tidak ada approver aktif pada role ini',
        });
      }


      // =================================================
      // SAFE EMAIL CONTENT
      // =================================================

      const origin =
        String(
          req.headers.origin ||
            ''
        ).trim();


      const frontendOrigin =
        /^https?:\/\/[^/]+$/i.test(
          origin
        )
          ? origin
          : 'https://sarpras.smkn1-cmi.sch.id';


      const message = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">

          <h2 style="color:#0f766e;">
            Agenda Baru Dibuat
          </h2>

          <p>
            Ada agenda kegiatan baru yang memerlukan perhatian Anda:
          </p>

          <table style="width:100%;border-collapse:collapse;margin:16px 0;">

            <tr>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;font-weight:bold;">
                Judul
              </td>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;">
                ${escapeBorrowAdminHtml(
                  agenda.title
                )}
              </td>
            </tr>

            <tr>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;font-weight:bold;">
                Jenis
              </td>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;">
                ${escapeBorrowAdminHtml(
                  agenda.jenis_kegiatan
                )}
              </td>
            </tr>

            <tr>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;font-weight:bold;">
                Organisasi
              </td>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;">
                ${escapeBorrowAdminHtml(
                  agenda.organisasi_jurusan
                )}
              </td>
            </tr>

            <tr>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;font-weight:bold;">
                Penanggung Jawab
              </td>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;">
                ${escapeBorrowAdminHtml(
                  agenda.penanggung_jawab
                )}
              </td>
            </tr>

            <tr>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;font-weight:bold;">
                Tanggal
              </td>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;">
                ${escapeBorrowAdminHtml(
                  agenda.event_date
                )}
                ${
                  agenda.end_date
                    ? ` s/d ${escapeBorrowAdminHtml(
                        agenda.end_date
                      )}`
                    : ''
                }
              </td>
            </tr>

            <tr>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;font-weight:bold;">
                Waktu
              </td>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;">
                ${escapeBorrowAdminHtml(
                  agenda.start_time
                )}
                ${
                  agenda.end_time
                    ? ` - ${escapeBorrowAdminHtml(
                        agenda.end_time
                      )}`
                    : ''
                }
              </td>
            </tr>

            <tr>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;font-weight:bold;">
                Lokasi
              </td>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;">
                ${escapeBorrowAdminHtml(
                  agenda.location
                )}
              </td>
            </tr>

            <tr>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;font-weight:bold;">
                No. HP
              </td>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;">
                ${escapeBorrowAdminHtml(
                  agenda.contact_phone
                )}
              </td>
            </tr>

            <tr>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;font-weight:bold;">
                Lampiran
              </td>
              <td style="padding:6px 12px;border:1px solid #e2e8f0;">
                ${uploadedFileCount} file
              </td>
            </tr>

          </table>

          <a
            href="${frontendOrigin}/admin/agenda"
            style="display:inline-block;margin-top:16px;background:#0f766e;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;"
          >
            Lihat Agenda
          </a>

        </div>
      `;


      // =================================================
      // BACKGROUND EMAIL
      // =================================================

      void Promise.allSettled(
        recipientEmails.map(
          (recipientEmail) =>
            sendBorrowAdminEmail({
              recipientEmail,

              subject:
                'Agenda Baru - Smart Sarpras',

              message,
            })
        )
      );


      res.json({
        ok: true,

        data: {
          queued:
            recipientEmails.length,
        },
      });
    } catch (error) {
      console.error(
        '[AGENDA NOTIFY] error:',
        error
      );


      res
        .status(500)
        .json({
          ok: false,
          message:
            'Gagal memproses notifikasi agenda',
        });
    }
  }
);

// =====================================================
// PUBLIC ANNOUNCEMENTS
// =====================================================

app.get(
  '/api/announcements',
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            title,
            description,
            published_at,
            image_url

          FROM
            public.announcements

          WHERE
            status = 'published'

          ORDER BY
            published_at DESC NULLS LAST

          LIMIT 5
        `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[PUBLIC ANNOUNCEMENTS] error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal mengambil pengumuman',
      });
    }
  }
);

// =====================================================
// ADMIN INVENTORY
// Tempel sebelum START SERVER / app.listen()
// =====================================================

function parseInventoryBody(body = {}) {
  const name =
    typeof body.name === 'string'
      ? body.name.trim()
      : '';

  if (!name) {
    return {
      error: 'Nama barang wajib diisi',
    };
  }

  const quantity =
    body.quantity === '' ||
    body.quantity === null ||
    body.quantity === undefined
      ? 0
      : Number(body.quantity);

  if (
    !Number.isInteger(quantity) ||
    quantity < 0
  ) {
    return {
      error: 'Jumlah barang tidak valid',
    };
  }

  const allowedConditions = [
    'good',
    'fair',
    'poor',
  ];

  const condition =
    allowedConditions.includes(
      body.condition
    )
      ? body.condition
      : 'good';

  const price =
    body.price === '' ||
    body.price === null ||
    body.price === undefined
      ? null
      : Number(body.price);

  if (
    price !== null &&
    (
      !Number.isFinite(price) ||
      price < 0
    )
  ) {
    return {
      error: 'Harga tidak valid',
    };
  }

  const purchaseDate =
    typeof body.purchase_date ===
      'string' &&
    body.purchase_date.trim()
      ? body.purchase_date.trim()
      : null;

  if (
    purchaseDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(
      purchaseDate
    )
  ) {
    return {
      error:
        'Tanggal pembelian tidak valid',
    };
  }

  const imageUrl =
    typeof body.image_url === 'string'
      ? body.image_url.trim()
      : '';

  if (!imageUrl) {
    return {
      error:
        'Foto atau URL gambar wajib diisi',
    };
  }

  return {
    data: {
      code:
        typeof body.code === 'string' &&
        body.code.trim()
          ? body.code.trim()
          : null,

      name,

      category_id:
        typeof body.category_id ===
          'string' &&
        body.category_id.trim()
          ? body.category_id.trim()
          : null,

      quantity,

      // Pertahankan perilaku frontend lama:
      // available_quantity ikut quantity saat save.
      available_quantity:
        quantity,

      condition,

      location:
        typeof body.location ===
          'string' &&
        body.location.trim()
          ? body.location.trim()
          : null,

      purchase_date:
        purchaseDate,

      price,

      description:
        typeof body.description ===
          'string' &&
        body.description.trim()
          ? body.description.trim()
          : null,

      manager_name:
        typeof body.manager_name ===
          'string' &&
        body.manager_name.trim()
          ? body.manager_name.trim()
          : null,

      // PJ inventaris pada halaman ini
      // tetap nama bebas, bukan akun admin.
      manager_id:
        null,

      manager_role:
        null,

      image_url:
        imageUrl,
    },
  };
}


// Ambil inventaris untuk halaman admin
app.get(
  '/api/admin/inventory',
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            i.*,

            CASE
              WHEN c.id IS NULL
                THEN NULL

              ELSE
                json_build_object(
                  'id',
                  c.id,

                  'name',
                  c.name
                )
            END AS categories

          FROM
            public.inventory i

          LEFT JOIN
            public.categories c
              ON c.id =
                i.category_id

          ORDER BY
            i.created_at DESC
            NULLS LAST,
            i.name ASC
        `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[ADMIN INVENTORY] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal mengambil inventaris',
      });
    }
  }
);


// Tambah inventaris
app.post(
  '/api/admin/inventory',
  requireAdmin,
  requirePermission(
    'inventory',
    'create'
  ),
  async (req, res) => {
    try {
      const parsed =
        parseInventoryBody(
          req.body
        );

      if (parsed.error) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              parsed.error,
          });
      }

      const item =
        parsed.data;

      const result =
        await pool.query(
          `
            INSERT INTO
              public.inventory (
                code,
                name,
                category_id,
                quantity,
                available_quantity,
                condition,
                location,
                purchase_date,
                price,
                description,
                manager_name,
                manager_id,
                manager_role,
                image_url
              )

            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              $12,
              $13,
              $14
            )

            RETURNING *
          `,
          [
            item.code,
            item.name,
            item.category_id,
            item.quantity,
            item.available_quantity,
            item.condition,
            item.location,
            item.purchase_date,
            item.price,
            item.description,
            item.manager_name,
            item.manager_id,
            item.manager_role,
            item.image_url,
          ]
        );

      res.status(201).json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[ADMIN INVENTORY] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal menambahkan inventaris',
      });
    }
  }
);


// Update inventaris
app.patch(
  '/api/admin/inventory/:id',
  requireAdmin,
  requirePermission(
    'inventory',
    'update'
  ),
  async (req, res) => {
    try {
      const id =
        String(
          req.params.id || ''
        ).trim();

      if (!id) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'ID inventaris tidak valid',
          });
      }

      const parsed =
        parseInventoryBody(
          req.body
        );

      if (parsed.error) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              parsed.error,
          });
      }

      const item =
        parsed.data;

      const result =
        await pool.query(
          `
            UPDATE
              public.inventory

            SET
              code = $1,
              name = $2,
              category_id = $3,
              quantity = $4,
              available_quantity = $5,
              condition = $6,
              location = $7,
              purchase_date = $8,
              price = $9,
              description = $10,
              manager_name = $11,
              manager_id = $12,
              manager_role = $13,
              image_url = $14

            WHERE
              id = $15

            RETURNING *
          `,
          [
            item.code,
            item.name,
            item.category_id,
            item.quantity,
            item.available_quantity,
            item.condition,
            item.location,
            item.purchase_date,
            item.price,
            item.description,
            item.manager_name,
            item.manager_id,
            item.manager_role,
            item.image_url,
            id,
          ]
        );

      if (
        result.rowCount === 0
      ) {
        return res
          .status(404)
          .json({
            ok: false,
            message:
              'Inventaris tidak ditemukan',
          });
      }

      res.json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[ADMIN INVENTORY] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memperbarui inventaris',
      });
    }
  }
);


// Hapus inventaris
app.delete(
  '/api/admin/inventory/:id',
  requireAdmin,
  requirePermission(
    'inventory',
    'delete'
  ),
  async (req, res) => {
    try {
      const id =
        String(
          req.params.id || ''
        ).trim();

      if (!id) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'ID inventaris tidak valid',
          });
      }

      const result =
        await pool.query(
          `
            DELETE FROM
              public.inventory

            WHERE
              id = $1

            RETURNING
              id,
              name
          `,
          [id]
        );

      if (
        result.rowCount === 0
      ) {
        return res
          .status(404)
          .json({
            ok: false,
            message:
              'Inventaris tidak ditemukan',
          });
      }

      res.json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[ADMIN INVENTORY] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal menghapus inventaris',
      });
    }
  }
);

// =====================================================
// SYSTEM TESTING - EMAIL FUNCTION STATUS
// Tempel sebelum START SERVER / app.listen()
// =====================================================

app.get(
  '/api/admin/system-testing/email-function/status',
  requireAdmin,
  async (req, res) => {
    try {
      const supabaseUrl =
        String(
          process.env.SUPABASE_URL || ''
        )
          .trim()
          .replace(/\/+$/, '');

      if (!supabaseUrl) {
        return res
          .status(500)
          .json({
            ok: false,
            message:
              'SUPABASE_URL backend belum tersedia',
          });
      }

      const response =
        await fetch(
          `${supabaseUrl}/functions/v1/send-borrowing-email`,
          {
            method:
              'OPTIONS',

            headers: {
              'Content-Type':
                'application/json',

              apikey:
                process.env.SUPABASE_ANON_KEY,

              Authorization:
                String(
                  req.headers.authorization ||
                  ''
                ),
            },
          }
        );

      const reachable =
        response.ok ||
        response.status === 200 ||
        response.status === 204;

      return res.json({
        ok: true,

        data: {
          status:
            reachable
              ? 'pass'
              : 'fail',

          details:
            reachable
              ? 'Email service dapat dihubungi melalui backend.'
              : `Email service merespons status ${response.status}.`,

          checks: [
            {
              label:
                'Backend dapat menghubungi email service',

              ok:
                reachable,
            },
          ],
        },
      });
    } catch (error) {
      console.error(
        '[SYSTEM TESTING] Email function status error:',
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : 'Gagal menguji email service',
        });
    }
  }
);

// =====================================================
// ADMIN - PUBLIC FEATURE FLAGS
// =====================================================

app.patch(
  '/api/admin/public-features/borrowing',
  requireAdmin,
  async (req, res) => {
    try {
      if (!req.isSuperAdmin) {
        return res
          .status(403)
          .json({
            ok: false,
            message:
              'Hanya Super Admin yang dapat mengubah visibilitas fitur peminjaman publik',
          });
      }

      if (
        typeof req.body?.enabled !==
        'boolean'
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Nilai enabled harus boolean',
          });
      }

      const result =
        await pool.query(
          `
            UPDATE public.system_config
            SET
              value = $1::jsonb,
              updated_by = $2,
              updated_at = NOW()
            WHERE key =
              'public_borrowing_enabled'
            RETURNING key, value
          `,
          [
            JSON.stringify(
              req.body.enabled
            ),
            req.adminUser.id,
          ]
        );

      if (
        result.rowCount === 0
      ) {
        return res
          .status(404)
          .json({
            ok: false,
            message:
              'Konfigurasi peminjaman publik tidak ditemukan',
          });
      }

      res.json({
        ok: true,
        data: {
          borrowingEnabled:
            result.rows[0]
              .value === true,
        },
      });
    } catch (error) {
      console.error(
        '[PUBLIC FEATURES] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memperbarui visibilitas peminjaman publik',
      });
    }
  }
);


// =====================================================
// ADMIN - SYSTEM CONFIG
// =====================================================

app.get(
  '/api/admin/system-config',
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            key,
            value,
            label,
            description,
            config_group,
            updated_at
          FROM public.system_config
          ORDER BY
            config_group ASC NULLS LAST,
            key ASC
        `);

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[SYSTEM CONFIG] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat konfigurasi sistem',
      });
    }
  }
);


app.patch(
  '/api/admin/system-config/:id',
  requireAdmin,
  requirePermission(
    'system_config',
    'manage'
  ),
  async (req, res) => {
    try {
      const id =
        String(
          req.params.id || ''
        ).trim();

      if (!id) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'ID konfigurasi tidak valid',
          });
      }

      if (
        !Object.prototype.hasOwnProperty.call(
          req.body ?? {},
          'value'
        )
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Nilai konfigurasi wajib dikirim',
          });
      }

      const serializedValue =
        JSON.stringify(
          req.body.value
        );

      if (
        serializedValue ===
        undefined
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            message:
              'Nilai konfigurasi tidak valid',
          });
      }

      const result =
        await pool.query(
          `
            UPDATE public.system_config
            SET
              value = $1::jsonb,
              updated_by = $2,
              updated_at = NOW()
            WHERE id = $3
            RETURNING
              id,
              key,
              value,
              label,
              description,
              config_group,
              updated_at
          `,
          [
            serializedValue,
            req.adminUser.id,
            id,
          ]
        );

      if (
        result.rowCount === 0
      ) {
        return res
          .status(404)
          .json({
            ok: false,
            message:
              'Konfigurasi tidak ditemukan',
          });
      }

      res.json({
        ok: true,
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        '[SYSTEM CONFIG] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal menyimpan konfigurasi sistem',
      });
    }
  }
);

// =====================================================
// BORROWING GUIDE
// =====================================================

// Panduan yang tampil ke user.
// Tetap wajib login karena seluruh area publik aplikasi memakai RequireAuth.
app.get(
  '/api/borrowing-guide',
  requireAuth,
  async (_req, res) => {
    try {
      const result =
        await pool.query(
          `
            SELECT
              id,
              title,
              description,
              image_url,
              sort_order
            FROM public.borrowing_guide_steps
            WHERE is_active = true
            ORDER BY
              sort_order ASC,
              created_at ASC
          `
        );

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[BORROWING GUIDE] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat panduan peminjaman',
      });
    }
  }
);


// Semua langkah untuk editor Super Admin.
app.get(
  '/api/admin/borrowing-guide',
  requireAdmin,
  requireSuperAdminAccess,
  async (_req, res) => {
    try {
      const result =
        await pool.query(
          `
            SELECT
              id,
              title,
              description,
              image_url,
              image_file_id,
              sort_order,
              is_active,
              created_at,
              updated_at
            FROM public.borrowing_guide_steps
            ORDER BY
              sort_order ASC,
              created_at ASC
          `
        );

      res.json({
        ok: true,
        data: result.rows,
      });
    } catch (error) {
      console.error(
        '[BORROWING GUIDE ADMIN] GET error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memuat editor panduan peminjaman',
      });
    }
  }
);


app.post(
  '/api/admin/borrowing-guide',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const title =
        String(
          req.body?.title ??
          ''
        ).trim();

      const description =
        String(
          req.body?.description ??
          ''
        ).trim();

      const imageUrl =
        String(
          req.body?.image_url ??
          ''
        ).trim();

      const imageFileId =
        String(
          req.body?.image_file_id ??
          ''
        ).trim();

      const sortOrder =
        Number.isFinite(
          Number(
            req.body?.sort_order
          )
        )
          ? Math.trunc(
              Number(
                req.body.sort_order
              )
            )
          : 0;

      const isActive =
        req.body?.is_active !==
        false;

      if (!description) {
        return res.status(400).json({
          ok: false,
          message:
            'Teks panduan wajib diisi',
        });
      }

      if (!imageUrl) {
        return res.status(400).json({
          ok: false,
          message:
            'Gambar panduan wajib diisi',
        });
      }

      const result =
        await pool.query(
          `
            INSERT INTO public.borrowing_guide_steps (
              title,
              description,
              image_url,
              image_file_id,
              sort_order,
              is_active,
              created_by,
              updated_by
            )
            VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $7
            )
            RETURNING *
          `,
          [
            title || null,
            description,
            imageUrl,
            imageFileId || null,
            sortOrder,
            isActive,
            req.adminUser.id,
          ]
        );

      res.status(201).json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[BORROWING GUIDE ADMIN] POST error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal menambahkan langkah panduan',
      });
    }
  }
);


app.patch(
  '/api/admin/borrowing-guide/:id',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const id =
        String(
          req.params.id ||
          ''
        ).trim();

      const title =
        String(
          req.body?.title ??
          ''
        ).trim();

      const description =
        String(
          req.body?.description ??
          ''
        ).trim();

      const imageUrl =
        String(
          req.body?.image_url ??
          ''
        ).trim();

      const imageFileId =
        String(
          req.body?.image_file_id ??
          ''
        ).trim();

      const sortOrder =
        Number.isFinite(
          Number(
            req.body?.sort_order
          )
        )
          ? Math.trunc(
              Number(
                req.body.sort_order
              )
            )
          : 0;

      const isActive =
        req.body?.is_active !==
        false;

      if (!id) {
        return res.status(400).json({
          ok: false,
          message:
            'ID panduan tidak valid',
        });
      }

      if (!description) {
        return res.status(400).json({
          ok: false,
          message:
            'Teks panduan wajib diisi',
        });
      }

      if (!imageUrl) {
        return res.status(400).json({
          ok: false,
          message:
            'Gambar panduan wajib diisi',
        });
      }

      const result =
        await pool.query(
          `
            UPDATE public.borrowing_guide_steps
            SET
              title = $1,
              description = $2,
              image_url = $3,
              image_file_id = $4,
              sort_order = $5,
              is_active = $6,
              updated_by = $7,
              updated_at = NOW()
            WHERE id = $8
            RETURNING *
          `,
          [
            title || null,
            description,
            imageUrl,
            imageFileId || null,
            sortOrder,
            isActive,
            req.adminUser.id,
            id,
          ]
        );

      if (
        result.rowCount ===
        0
      ) {
        return res.status(404).json({
          ok: false,
          message:
            'Langkah panduan tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[BORROWING GUIDE ADMIN] PATCH error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal memperbarui langkah panduan',
      });
    }
  }
);


app.delete(
  '/api/admin/borrowing-guide/:id',
  requireAdmin,
  requireSuperAdminAccess,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            DELETE FROM public.borrowing_guide_steps
            WHERE id = $1
            RETURNING id, title
          `,
          [
            req.params.id,
          ]
        );

      if (
        result.rowCount ===
        0
      ) {
        return res.status(404).json({
          ok: false,
          message:
            'Langkah panduan tidak ditemukan',
        });
      }

      res.json({
        ok: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error(
        '[BORROWING GUIDE ADMIN] DELETE error:',
        error
      );

      res.status(500).json({
        ok: false,
        message:
          'Gagal menghapus langkah panduan',
      });
    }
  }
);


// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
  console.log('');
  console.log('SMART SARPRAS BACKEND AKTIF');
  console.log(`http://localhost:${PORT}`);
  console.log(
    `http://localhost:${PORT}/api/health`
  );
  console.log(
    `http://localhost:${PORT}/api/db-summary`
  );
  console.log(
    `http://localhost:${PORT}/api/admin/me`
  );
});
