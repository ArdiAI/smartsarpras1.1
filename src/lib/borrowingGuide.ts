import { authFetch } from './authFetch';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

export interface BorrowingGuideStep {
  id: string;
  title: string | null;
  description: string;
  image_url: string;
  image_file_id?: string | null;
  sort_order: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function fetchBorrowingGuide(
  admin = false
): Promise<BorrowingGuideStep[]> {
  const response =
    await authFetch(
      admin
        ? `${API_BASE_URL}/api/admin/borrowing-guide`
        : `${API_BASE_URL}/api/borrowing-guide`
    );

  const result =
    await response
      .json()
      .catch(
        () => null
      );

  if (
    !response.ok ||
    !result?.ok
  ) {
    throw new Error(
      result?.message ??
        'Gagal memuat panduan peminjaman'
    );
  }

  return (
    result.data ??
    []
  ) as BorrowingGuideStep[];
}

export async function saveBorrowingGuideStep(
  step:
    | BorrowingGuideStep
    | Omit<
        BorrowingGuideStep,
        'id'
      >,
  id?: string
): Promise<BorrowingGuideStep> {
  const response =
    await authFetch(
      id
        ? `${API_BASE_URL}/api/admin/borrowing-guide/${id}`
        : `${API_BASE_URL}/api/admin/borrowing-guide`,
      {
        method:
          id
            ? 'PATCH'
            : 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body:
          JSON.stringify(
            step
          ),
      }
    );

  const result =
    await response
      .json()
      .catch(
        () => null
      );

  if (
    !response.ok ||
    !result?.ok
  ) {
    throw new Error(
      result?.message ??
        'Gagal menyimpan panduan peminjaman'
    );
  }

  return result.data as BorrowingGuideStep;
}

export async function deleteBorrowingGuideStep(
  id: string
): Promise<void> {
  const response =
    await authFetch(
      `${API_BASE_URL}/api/admin/borrowing-guide/${id}`,
      {
        method:
          'DELETE',
      }
    );

  const result =
    await response
      .json()
      .catch(
        () => null
      );

  if (
    !response.ok ||
    !result?.ok
  ) {
    throw new Error(
      result?.message ??
        'Gagal menghapus panduan peminjaman'
    );
  }
}
