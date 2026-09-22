require('dotenv').config();

const baseUrl =
  String(
    process.env.ACCEPTANCE_BASE_URL ||
    process.env.VITE_API_URL ||
    'http://localhost:3001'
  ).replace(/\/+$/, '');

const accessToken =
  String(
    process.env.ACCEPTANCE_ACCESS_TOKEN ||
    ''
  ).trim();

const checks = [];

async function runCheck(
  name,
  fn
) {
  try {
    const detail =
      await fn();

    checks.push({
      name,
      ok: true,
      detail,
    });

    console.log(
      `PASS  ${name}${detail ? ` - ${detail}` : ''}`
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    checks.push({
      name,
      ok: false,
      detail: message,
    });

    console.error(
      `FAIL  ${name} - ${message}`
    );
  }
}

async function request(
  path,
  options = {}
) {
  const headers =
    new Headers(
      options.headers
    );

  if (
    accessToken &&
    !headers.has(
      'Authorization'
    )
  ) {
    headers.set(
      'Authorization',
      `Bearer ${accessToken}`
    );
  }

  const response =
    await fetch(
      `${baseUrl}${path}`,
      {
        ...options,
        headers,
      }
    );

  const body =
    await response
      .json()
      .catch(
        () => null
      );

  return {
    response,
    body,
  };
}

(async () => {
  console.log(
    `Smart Sarpras acceptance target: ${baseUrl}`
  );

  await runCheck(
    'Backend health',
    async () => {
      const {
        response,
        body,
      } =
        await request(
          '/api/health'
        );

      if (
        !response.ok ||
        body?.ok !== true
      ) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      return 'backend + PostgreSQL merespons';
    }
  );

  await runCheck(
    'Public feature flags',
    async () => {
      const {
        response,
        body,
      } =
        await request(
          '/api/public/features'
        );

      if (
        !response.ok ||
        body?.ok !== true
      ) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      return `borrowingEnabled=${String(
        body?.data?.borrowingEnabled
      )}`;
    }
  );

  const publicPaths = [
    '/api/timeline/events?year=2026&month=9',
    '/api/reports/recent?email=test@example.com',
    '/api/kavling/options',
  ];

  for (
    const path of
    publicPaths
  ) {
    await runCheck(
      `Public without login: ${path.split('?')[0]}`,
      async () => {
        const {
          response,
          body,
        } =
          await request(
            path
          );

        if (
          !response.ok ||
          body?.ok !== true
        ) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        return 'akses publik OK';
      }
    );
  }

  const protectedPaths = [
    '/api/proposals',
    '/api/rekap',
    '/api/admin/me',
  ];

  if (!accessToken) {
    for (
      const path of
      protectedPaths
    ) {
      await runCheck(
        `Admin/protected without token: ${path}`,
        async () => {
          const {
            response,
          } =
            await request(
              path
            );

          if (
            response.status !==
            401
          ) {
            throw new Error(
              `expected 401, got ${response.status}`
            );
          }

          return '401 sesuai';
        }
      );
    }

    console.log(
      '\nINFO  Endpoint backend publik lolos tanpa token. UI Smart Sarpras tetap mewajibkan login; set ACCEPTANCE_ACCESS_TOKEN untuk smoke test endpoint authenticated.'
    );
  } else {
    await runCheck(
      'Authenticated proposals',
      async () => {
        const {
          response,
          body,
        } =
          await request(
            '/api/proposals'
          );

        if (
          !response.ok ||
          body?.ok !== true
        ) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        return 'OK';
      }
    );

    await runCheck(
      'Authenticated timeline',
      async () => {
        const now =
          new Date();

        const {
          response,
          body,
        } =
          await request(
            `/api/timeline/events?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
          );

        if (
          !response.ok ||
          body?.ok !== true
        ) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        return 'OK';
      }
    );

    await runCheck(
      'Authenticated rekap',
      async () => {
        const {
          response,
          body,
        } =
          await request(
            '/api/rekap'
          );

        if (
          !response.ok ||
          body?.ok !== true
        ) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        return 'OK';
      }
    );
  }

  const failed =
    checks.filter(
      (check) =>
        !check.ok
    );

  console.log(
    `\nResult: ${checks.length - failed.length}/${checks.length} PASS`
  );

  if (
    failed.length >
    0
  ) {
    process.exit(1);
  }
})();
