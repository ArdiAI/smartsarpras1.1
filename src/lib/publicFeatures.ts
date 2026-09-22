const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));

export interface PublicFeatures {
  borrowingEnabled: boolean;
}

export async function fetchPublicFeatures(): Promise<PublicFeatures> {
  const response =
    await fetch(
      `${API_BASE_URL}/api/public/features`
    );

  const result =
    (await response
      .json()
      .catch(() => null)) as
      | {
          ok?: boolean;
          data?: Partial<PublicFeatures>;
          message?: string;
        }
      | null;

  if (
    !response.ok ||
    !result?.ok
  ) {
    throw new Error(
      result?.message ??
        'Gagal memuat pengaturan fitur publik'
    );
  }

  return {
    borrowingEnabled:
      result.data
        ?.borrowingEnabled ===
      true,
  };
}
