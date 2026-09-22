import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

import { getSessionToken } from '../../lib/appSession';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';

import {
  CalendarDays,
  Trash2,
  Plus,
  Loader2,
} from 'lucide-react';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));

interface Agenda {
  id: string;
  title: string;
  category: string | null;
  event_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  organizer: string | null;
  description: string | null;
  penyelenggara: string | null;
  organisasi_jurusan: string | null;
  penanggung_jawab: string | null;
  status: string | null;
  email: string | null;
  jumlah_peserta: number | null;
  jenis_kegiatan: string | null;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

const emptyForm = {
  title: '',
  jenis_kegiatan: '',
  organisasi_jurusan: '',
  penanggung_jawab: '',
  email: '',
  location: '',
  event_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  description: '',
};

async function getAccessToken() {
  const token =
    getSessionToken();

  if (!token) {
    throw new Error(
      'Sesi login tidak ditemukan. Silakan login kembali.'
    );
  }

  return token;
}

async function adminApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAccessToken();

  const headers =
    new Headers(options.headers);

  headers.set(
    'Authorization',
    `Bearer ${token}`
  );

  if (
    options.body &&
    !headers.has('Content-Type')
  ) {
    headers.set(
      'Content-Type',
      'application/json'
    );
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers,
    }
  );

  const result =
    (await response.json()) as ApiResponse<T>;

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new Error(
      result.message ??
        `HTTP ${response.status}`
    );
  }

  return result;
}

export default function AgendaAdminPage() {
  const { isSuperAdmin } =
    useAuth();

  const [
    agendas,
    setAgendas,
  ] = useState<Agenda[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState({
    ...emptyForm,
  });

  const fetchAgendas =
    async () => {
      setLoading(true);

      try {
        const result =
          await adminApi<
            Agenda[]
          >(
            '/api/admin/agendas'
          );

        setAgendas(
          result.data ?? []
        );
      } catch (error) {
        console.error(
          '[AgendaAdminPage] GET error:',
          error
        );

        setAgendas([]);

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal memuat data agenda',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void fetchAgendas();
  }, []);

  const handleChange = (
    e: ChangeEvent<
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
    >
  ) => {
    const {
      name,
      value,
    } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (
    e: FormEvent
  ) => {
    e.preventDefault();

    if (
      !form.title ||
      !form.event_date ||
      !form.end_date
    ) {
      showToast(
        'Judul, tanggal mulai, dan tanggal selesai wajib diisi',
        'warning'
      );

      return;
    }

    if (form.end_date < form.event_date) {
      showToast(
        'Tanggal selesai tidak boleh sebelum tanggal mulai',
        'warning'
      );

      return;
    }

    setSubmitting(true);

    try {
      await adminApi<Agenda>(
        '/api/admin/agendas',
        {
          method: 'POST',

          body: JSON.stringify({
            title:
              form.title,

            jenis_kegiatan:
              form.jenis_kegiatan,

            organisasi_jurusan:
              form.organisasi_jurusan,

            penanggung_jawab:
              form.penanggung_jawab,

            email:
              form.email,

            location:
              form.location,

            event_date:
              form.event_date,

            end_date:
              form.end_date,

            start_time:
              form.start_time ||
              null,

            end_time:
              form.end_time ||
              null,

            description:
              form.description,
          }),
        }
      );

      showToast(
        'Agenda berhasil ditambahkan'
      );

      setForm({
        ...emptyForm,
      });

      await fetchAgendas();
    } catch (error) {
      console.error(
        '[AgendaAdminPage] POST error:',
        error
      );

      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal menambahkan agenda',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete =
    async (
      id: string
    ) => {
      if (
        !window.confirm(
          'Apakah Anda yakin ingin menghapus agenda ini? Tindakan ini tidak dapat dibatalkan.'
        )
      ) {
        return;
      }

      try {
        await adminApi<null>(
          `/api/admin/agendas/${encodeURIComponent(
            id
          )}`,
          {
            method: 'DELETE',
          }
        );

        showToast(
          'Agenda berhasil dihapus.'
        );

        await fetchAgendas();
      } catch (error) {
        console.error(
          '[AgendaAdminPage] DELETE error:',
          error
        );

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal menghapus agenda',
          'error'
        );
      }
    };

  return (
    <div className="pb-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Kelola Agenda
        </h1>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Tambahkan dan kelola agenda kegiatan sarana prasarana.
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Plus className="h-5 w-5" />
          Tambah Agenda
        </h2>

        <form
          onSubmit={
            handleSubmit
          }
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Judul Agenda *
            </label>

            <input
              name="title"
              value={
                form.title
              }
              onChange={
                handleChange
              }
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Jenis Kegiatan
            </label>

            <select
              name="jenis_kegiatan"
              value={
                form.jenis_kegiatan
              }
              onChange={
                handleChange
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">
                Pilih jenis
              </option>
              <option value="Akademik">
                Akademik
              </option>
              <option value="Non-Akademik">
                Non-Akademik
              </option>
              <option value="Organisasi">
                Organisasi
              </option>
              <option value="Lainnya">
                Lainnya
              </option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Organisasi / Jurusan
            </label>

            <input
              name="organisasi_jurusan"
              value={
                form.organisasi_jurusan
              }
              onChange={
                handleChange
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Penanggung Jawab
            </label>

            <input
              name="penanggung_jawab"
              value={
                form.penanggung_jawab
              }
              onChange={
                handleChange
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>

            <input
              name="email"
              type="email"
              value={
                form.email
              }
              onChange={
                handleChange
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Lokasi
            </label>

            <input
              name="location"
              value={
                form.location
              }
              onChange={
                handleChange
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Tanggal Mulai *
            </label>

            <input
              name="event_date"
              type="date"
              value={
                form.event_date
              }
              onChange={
                handleChange
              }
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Tanggal Selesai *
            </label>

            <input
              name="end_date"
              type="date"
              value={
                form.end_date
              }
              min={form.event_date || undefined}
              onChange={
                handleChange
              }
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Waktu Mulai
            </label>

            <input
              name="start_time"
              type="time"
              value={
                form.start_time
              }
              onChange={
                handleChange
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Waktu Selesai
            </label>

            <input
              name="end_time"
              type="time"
              value={
                form.end_time
              }
              onChange={
                handleChange
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Deskripsi
            </label>

            <textarea
              name="description"
              value={
                form.description
              }
              onChange={
                handleChange
              }
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={
                submitting
              }
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}

              {submitting
                ? 'Menyimpan...'
                : 'Simpan Agenda'}
            </button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <CalendarDays className="h-5 w-5" />
          Daftar Agenda
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        ) : agendas.length ===
          0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Belum ada agenda.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agendas.map(
              (agenda) => (
                <div
                  key={
                    agenda.id
                  }
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {agenda.title ??
                          'Tanpa Judul'}
                      </h3>

                      {agenda.jenis_kegiatan && (
                        <span className="mt-1 inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                          {
                            agenda.jenis_kegiatan
                          }
                        </span>
                      )}
                    </div>

                    {isSuperAdmin && (
                      <button
                        onClick={() =>
                          handleDelete(
                            agenda.id
                          )
                        }
                        className="shrink-0 rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                    <p>
                      <span className="font-medium">
                        Tanggal:
                      </span>{' '}
                      {agenda.event_date ??
                        '-'}
                      {agenda.end_date
                        ? ` s/d ${agenda.end_date}`
                        : ''}
                    </p>

                    <p>
                      <span className="font-medium">
                        Waktu:
                      </span>{' '}
                      {agenda.start_time ??
                        '-'}
                      {agenda.end_time
                        ? ` - ${agenda.end_time}`
                        : ''}
                    </p>

                    <p>
                      <span className="font-medium">
                        Lokasi:
                      </span>{' '}
                      {agenda.location ??
                        '-'}
                    </p>

                    <p>
                      <span className="font-medium">
                        PJ:
                      </span>{' '}
                      {agenda.penanggung_jawab ??
                        '-'}
                    </p>

                    <p>
                      <span className="font-medium">
                        Organisasi:
                      </span>{' '}
                      {agenda.organisasi_jurusan ??
                        '-'}
                    </p>

                    {agenda.description && (
                      <p className="mt-2 line-clamp-2 text-slate-500 dark:text-slate-400">
                        {
                          agenda.description
                        }
                      </p>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}