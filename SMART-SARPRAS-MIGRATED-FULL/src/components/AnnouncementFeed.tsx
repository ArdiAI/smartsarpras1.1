import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, X } from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

interface Announcement {
  id: string;
  title: string | null;
  description: string | null;
  published_at: string | null;
  image_url: string | null;
}

export default function AnnouncementFeed() {
  const [announcements, setAnnouncements] =
    useState<Announcement[]>([]);

  const [previewImage, setPreviewImage] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchAnnouncements = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/announcements`
        );

        const result =
          await response
            .json()
            .catch(() => null);

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              `HTTP ${response.status}`
          );
        }

        if (!cancelled) {
          setAnnouncements(
            Array.isArray(result.data)
              ? result.data
              : []
          );
        }
      } catch (error) {
        console.error(
          'Gagal mengambil pengumuman:',
          error
        );

        if (!cancelled) {
          setAnnouncements([]);
        }
      }
    };

    void fetchAnnouncements();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        setPreviewImage(null);
      }
    };

    if (previewImage) {
      document.body.style.overflow =
        'hidden';

      window.addEventListener(
        'keydown',
        handleEscape
      );
    }

    return () => {
      document.body.style.overflow = '';

      window.removeEventListener(
        'keydown',
        handleEscape
      );
    };
  }, [previewImage]);

  if (announcements.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3">
        {announcements.map(
          (announcement, index) => (
            <div
              key={announcement.id}
              className="flex items-start gap-3 rounded-xl border border-slate-200/50 bg-white p-4 animate-slide-up dark:border-slate-700/50 dark:bg-slate-800"
              style={{
                animationDelay:
                  `${index * 0.1}s`,
              }}
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Megaphone className="h-4 w-4 text-blue-500" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {announcement.title}
                </p>

                {announcement.image_url && (
                  <img
                    src={
                      announcement.image_url
                    }
                    alt={
                      announcement.title ??
                      'Pengumuman'
                    }
                    onClick={() =>
                      setPreviewImage(
                        announcement.image_url
                      )
                    }
                    className="mt-2 max-h-32 max-w-full cursor-zoom-in rounded-lg border border-slate-200 object-cover transition duration-200 hover:opacity-90 dark:border-slate-700"
                  />
                )}

                {announcement.description && (
                  <p className="mt-1 text-xs text-slate-500">
                    {
                      announcement.description
                    }
                  </p>
                )}

                <p className="mt-1 text-xs text-slate-400">
                  {announcement.published_at
                    ? new Date(
                        announcement.published_at
                      ).toLocaleDateString(
                        'id-ID'
                      )
                    : ''}
                </p>
              </div>
            </div>
          )
        )}
      </div>

      {previewImage &&
        createPortal(
          <div
            className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/90 p-4"
            onClick={() =>
              setPreviewImage(null)
            }
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setPreviewImage(null);
              }}
              className="absolute right-5 top-5 z-[1000000] flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
              aria-label="Tutup gambar"
            >
              <X className="h-6 w-6" />
            </button>

            <img
              src={previewImage}
              alt="Preview pengumuman"
              onClick={(event) =>
                event.stopPropagation()
              }
              className="max-h-[90vh] max-w-[95vw] object-contain"
            />
          </div>,
          document.body
        )}
    </>
  );
}
