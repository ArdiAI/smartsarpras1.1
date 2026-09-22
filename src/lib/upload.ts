import { getSessionToken } from './appSession';

export interface UploadResult {
  url: string;
  fileId: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

export type DriveCategory =
  | 'surat_peminjaman'
  | 'laporan'
  | 'foto_kavling'
  | 'foto_pengumuman'
  | 'inventory'
  | 'fasilitas'
  | 'tim_pengelola'
  | 'panduan_peminjaman';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));

/**
 * Upload file aplikasi ke Google Drive melalui backend.
 * Token login diambil dari session backend Smart Sarpras.
 */
export async function uploadFileToDrive(
  file: File,
  fileName?: string,
  category: DriveCategory = 'laporan'
): Promise<UploadResult | null> {
  try {
    const token =
      getSessionToken();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    if (fileName) {
      formData.append('fileName', fileName);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/upload-drive`,
      {
        method: 'POST',
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
        body: formData,
      }
    );

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok || !result?.file?.url) {
      console.error(
        'Google Drive upload error:',
        result?.message ?? `HTTP ${response.status}`
      );
      return null;
    }

    return {
      url: result.file.url,
      fileId: result.file.id ?? '',
      name:
        result.file.originalName ??
        result.file.name ??
        fileName ??
        file.name,
      mimeType: result.file.mimeType ?? file.type,
      size: Number(result.file.size ?? file.size),
    };
  } catch (error) {
    console.error('Google Drive upload error:', error);
    return null;
  }
}
