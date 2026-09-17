import {
  useEffect,
  useState,
} from 'react';

import {
  Target,
  Eye,
  Mail,
  Phone,
  Building2,
} from 'lucide-react';

import { brand } from '../brand/config';
import EmptyState from '../components/EmptyState';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

interface TeamMember {
  id: string;
  name: string;
  position: string;
  role: string | null;
  photo_url: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
}

interface AboutSettings {
  id: string;
  section: string;
  content: any;
}

interface AboutResponse {
  ok: boolean;
  data?: {
    settings: AboutSettings[];
    team: TeamMember[];
  };
  message?: string;
}

export default function AboutPage() {
  const [
    vision,
    setVision,
  ] = useState('');

  const [
    mission,
    setMission,
  ] = useState<string[]>([]);

  const [
    team,
    setTeam,
  ] = useState<TeamMember[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
    const fetchAbout =
      async () => {
        try {
          const response =
            await fetch(
              `${API_BASE_URL}/api/about`
            );

          const result =
            (await response.json()) as AboutResponse;

          if (
            !response.ok ||
            !result.ok ||
            !result.data
          ) {
            throw new Error(
              result.message ??
                'Gagal memuat halaman tentang'
            );
          }

          const settings =
            result.data.settings ??
            [];

          const visionSetting =
            settings.find(
              (item) =>
                item.section ===
                'vision'
            );

          const missionSetting =
            settings.find(
              (item) =>
                item.section ===
                'mission'
            );

          if (
            visionSetting
              ?.content?.text
          ) {
            setVision(
              visionSetting
                .content
                .text as string
            );
          }

          if (
            Array.isArray(
              missionSetting
                ?.content?.items
            )
          ) {
            setMission(
              missionSetting
                ?.content
                ?.items as string[]
            );
          }

          setTeam(
            result.data.team ??
              []
          );
        } catch (error) {
          console.error(
            '[AboutPage] GET error:',
            error
          );

          setVision('');
          setMission([]);
          setTeam([]);
        } finally {
          setLoading(false);
        }
      };

    void fetchAbout();
  }, []);

  return (
    <div className="relative pb-12">
      <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-3xl px-4 py-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-700 text-white">
            <Building2 className="h-5 w-5" />
          </div>

          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Tentang {brand.name}
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {brand.description}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Eye className="h-4 w-4" />
              </div>

              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Visi
              </h3>
            </div>

            {loading ? (
              <div className="h-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            ) : vision ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {vision}
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                Visi belum diatur.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Target className="h-4 w-4" />
              </div>

              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Misi
              </h3>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(
                  (i) => (
                    <div
                      key={i}
                      className="h-4 animate-pulse rounded bg-slate-100 dark:bg-slate-800"
                    />
                  )
                )}
              </div>
            ) : mission.length >
              0 ? (
              <ul className="space-y-1.5">
                {mission.map(
                  (item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />

                      {item}
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">
                Misi belum diatur.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-8">
        <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
          Tim Pengelola
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(
              (i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="mx-auto h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />

                  <div className="mt-3 h-4 w-3/4 mx-auto rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              )
            )}
          </div>
        ) : team.length ===
          0 ? (
          <EmptyState
            title="Belum ada tim"
            description="Anggota tim akan ditampilkan di sini."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {team.map(
              (member) => (
                <div
                  key={
                    member.id
                  }
                  className="rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    {member.photo_url ? (
                      <img
                        src={
                          member.photo_url
                        }
                        alt={
                          member.name
                        }
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-bold text-slate-400">
                        {member.name.charAt(
                          0
                        )}
                      </div>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {
                      member.name
                    }
                  </h3>

                  <p className="mt-0.5 text-xs text-brand-700 dark:text-brand-300">
                    {
                      member.position
                    }
                  </p>

                  {member.description && (
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {
                        member.description
                      }
                    </p>
                  )}

                  <div className="mt-2.5 flex justify-center gap-3 text-slate-400">
                    {member.email && (
                      <a
                        href={`mailto:${member.email}`}
                        className="hover:text-brand-700"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                    )}

                    {member.phone && (
                      <a
                        href={`tel:${member.phone}`}
                        className="hover:text-brand-700"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
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