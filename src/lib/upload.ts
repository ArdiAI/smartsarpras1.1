import { supabase } from './supabase';

export interface UploadResult { url: string; fileId: string; }

const BUCKET = 'borrowing-documents';

export async function uploadFileToDrive(file: File, fileName?: string): Promise<UploadResult | null> {
  try {
    const filePath = `${fileName ?? file.name}`;
    const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, { upsert: true });
    if (error) {
      console.error('Supabase Storage upload error:', error.message);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    return { url: data.publicUrl, fileId: filePath };
  } catch {
    return null;
  }
}
