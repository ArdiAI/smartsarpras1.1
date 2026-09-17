import {
  useEffect,
  useState,
} from 'react';

import {
  motion,
} from 'framer-motion';

import {
  User,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Users,
  ChevronRight,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AnimatedBackground from '../components/AnimatedBackground';

import {
  cn,
} from '../utils/cn';


const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';


interface TeamMember {
  id: string;
  name: string;
  position: string;
  role: string;

  photo_url:
    | string
    | null;

  description:
    | string
    | null;

  email:
    | string
    | null;

  phone:
    | string
    | null;

  order: number;
}


interface TeamApiResponse {
  ok: boolean;

  data?:
    TeamMember[];

  message?: string;
}


const roleColors:
  Record<
    string,
    {
      bg: string;
      text: string;
      border: string;
    }
  > = {
    head: {
      bg:
        'bg-yellow-100 dark:bg-yellow-900/30',

      text:
        'text-yellow-700 dark:text-yellow-400',

      border:
        'border-yellow-300 dark:border-yellow-700',
    },

    coordinator: {
      bg:
        'bg-blue-100 dark:bg-blue-900/30',

      text:
        'text-blue-700 dark:text-blue-400',

      border:
        'border-blue-300 dark:border-blue-700',
    },

    staff: {
      bg:
        'bg-slate-100 dark:bg-slate-700/50',

      text:
        'text-slate-700 dark:text-slate-300',

      border:
        'border-slate-300 dark:border-slate-600',
    },

    wakapras: {
      bg:
        'bg-cyan-100 dark:bg-cyan-900/30',

      text:
        'text-cyan-700 dark:text-cyan-400',

      border:
        'border-cyan-300 dark:border-cyan-700',
    },
  };


export default function TeamPage() {
  const [
    members,
    setMembers,
  ] =
    useState<
      TeamMember[]
    >([]);


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    selectedMember,
    setSelectedMember,
  ] =
    useState<
      TeamMember | null
    >(null);


  // =====================================================
  // LOAD TEAM
  // =====================================================

  useEffect(() => {
    let mounted =
      true;


    void (async () => {
      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/team`
          );


        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | TeamApiResponse
              | null;


        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal memuat tim pengelola'
          );
        }


        if (!mounted) {
          return;
        }


        setMembers(
          result.data ??
            []
        );
      } catch (error) {
        console.error(
          '[TeamPage] load:',
          error
        );


        if (
          mounted
        ) {
          setMembers(
            []
          );
        }
      } finally {
        if (
          mounted
        ) {
          setLoading(
            false
          );
        }
      }
    })();


    return () => {
      mounted =
        false;
    };
  }, []);


  const head =
    members.find(
      (
        member
      ) =>
        member.role ===
        'head'
    );


  const coordinator =
    members.find(
      (
        member
      ) =>
        member.role ===
          'coordinator' ||
        member.role ===
          'wakapras'
    );


  const staffs =
    members.filter(
      (
        member
      ) =>
        member.role !==
          'head' &&
        member.role !==
          'coordinator' &&
        member.role !==
          'wakapras'
    );


  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">

      <AnimatedBackground />

      <Navbar />


      {/* HEADER */}
      <section className="relative z-10 pb-12 pt-24">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}

            animate={{
              opacity: 1,
              y: 0,
            }}

            className="mb-8 text-center"
          >

            <motion.div
              initial={{
                scale: 0.9,
              }}

              animate={{
                scale: 1,
              }}

              className="mb-4 inline-flex items-center gap-3"
            >

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-xl shadow-blue-500/30">

                <Users className="h-7 w-7 text-white" />

              </div>

            </motion.div>


            <h1 className="mb-3 text-4xl font-bold text-slate-900 dark:text-white">
              Tim Pengelola Sarpras
            </h1>


            <p className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Struktur organisasi dan daftar pengelola sarana prasarana sekolah
            </p>

          </motion.div>


          {/* BREADCRUMB */}
          <motion.div
            initial={{
              opacity: 0,
            }}

            animate={{
              opacity: 1,
            }}

            transition={{
              delay: 0.2,
            }}

            className="mb-8 flex items-center justify-center gap-2 text-sm"
          >

            <Link
              to="/about"

              className="text-slate-500 transition-colors hover:text-blue-500 dark:text-slate-400"
            >
              Tentang Sarpras
            </Link>


            <ChevronRight className="h-4 w-4 text-slate-400" />


            <span className="font-medium text-slate-900 dark:text-white">
              Tim Pengelola
            </span>

          </motion.div>

        </div>

      </section>


      {/* ORGANIZATION */}
      <section className="relative z-10 pb-12">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <motion.div
            initial={{
              opacity: 0,
              y: 30,
            }}

            whileInView={{
              opacity: 1,
              y: 0,
            }}

            viewport={{
              once: true,
            }}

            className="mb-12 rounded-2xl border border-slate-200/50 bg-white/70 p-6 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/70 lg:p-8"
          >

            <div className="mb-6 flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">

                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />

              </div>


              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Struktur Organisasi
              </h2>

            </div>


            <div className="flex flex-col items-center">

              {/* HEAD */}
              {head && (
                <motion.div
                  initial={{
                    opacity: 0,
                    scale: 0.9,
                  }}

                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}

                  className="mb-6"
                >

                  <div
                    className={cn(
                      'rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 px-6 py-4 text-center text-white shadow-xl shadow-yellow-500/20'
                    )}
                  >

                    <p className="text-lg font-bold">
                      {
                        head.name
                      }
                    </p>


                    <p className="text-sm text-yellow-100">
                      {
                        head.position
                      }
                    </p>

                  </div>

                </motion.div>
              )}


              {coordinator && (
                <div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-600" />
              )}


              {/* COORDINATOR */}
              {coordinator && (
                <motion.div
                  initial={{
                    opacity: 0,
                    scale: 0.9,
                  }}

                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}

                  transition={{
                    delay: 0.1,
                  }}

                  className="mb-6"
                >

                  <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 px-6 py-4 text-center text-white shadow-xl shadow-blue-500/20">

                    <p className="text-lg font-bold">
                      {
                        coordinator.name
                      }
                    </p>


                    <p className="text-sm text-blue-100">
                      {
                        coordinator.position
                      }
                    </p>

                  </div>

                </motion.div>
              )}


              {staffs.length >
                0 && (
                <>

                  <div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-600" />

                  <div className="mb-6 h-0.5 w-full max-w-3xl bg-slate-300 dark:bg-slate-600" />

                </>
              )}


              {/* STAFF */}
              {staffs.length >
                0 && (
                <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

                  {staffs.map(
                    (
                      staff,
                      index
                    ) => (
                      <motion.div
                        key={
                          staff.id
                        }

                        initial={{
                          opacity: 0,
                          y: 20,
                        }}

                        animate={{
                          opacity: 1,
                          y: 0,
                        }}

                        transition={{
                          delay:
                            0.2 +
                            index *
                              0.05,
                        }}

                        className="flex flex-col items-center"
                      >

                        <div className="h-4 w-0.5 bg-slate-300 dark:bg-slate-600" />


                        <div className="rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-center shadow-sm dark:border-slate-600 dark:bg-slate-700">

                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {
                              staff.name
                            }
                          </p>


                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {
                              staff.position
                            }
                          </p>

                        </div>

                      </motion.div>
                    )
                  )}

                </div>
              )}

            </div>

          </motion.div>


          {/* PROFILE TITLE */}
          <div className="mb-8">

            <div className="mb-6 flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 dark:bg-cyan-900/30">

                <User className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />

              </div>


              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Profil Pengelola
              </h2>

            </div>

          </div>


          {/* TEAM CARDS */}
          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">

              {[...Array(
                6
              )].map(
                (
                  _,
                  index
                ) => (
                  <div
                    key={
                      index
                    }

                    className="h-72 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700"
                  />
                )
              )}

            </div>
          ) : members.length ===
            0 ? (
            <div className="py-12 text-center">

              <Users className="mx-auto mb-4 h-16 w-16 text-slate-300 dark:text-slate-600" />


              <p className="text-slate-600 dark:text-slate-400">
                Belum ada anggota tim
              </p>

            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">

              {members.map(
                (
                  member,
                  index
                ) => (
                  <motion.div
                    key={
                      member.id
                    }

                    initial={{
                      opacity: 0,
                      y: 30,
                    }}

                    whileInView={{
                      opacity: 1,
                      y: 0,
                    }}

                    viewport={{
                      once: true,
                    }}

                    transition={{
                      delay:
                        index *
                        0.05,
                    }}

                    whileHover={{
                      y: -8,
                    }}

                    onClick={() =>
                      setSelectedMember(
                        member
                      )
                    }

                    className="group cursor-pointer"
                  >

                    <div className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white/70 backdrop-blur-xl transition-all hover:shadow-2xl dark:border-slate-700/50 dark:bg-slate-800/70">

                      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600">

                        {member.photo_url ? (
                          <img
                            src={
                              member.photo_url
                            }

                            alt={
                              member.name
                            }

                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">

                            <div className="text-center">

                              <div className="mx-auto mb-2 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 shadow-lg">

                                <User className="h-12 w-12 text-white" />

                              </div>


                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Tidak ada foto
                              </p>

                            </div>

                          </div>
                        )}


                        <div
                          className={cn(
                            'absolute right-4 top-4 rounded-full border px-3 py-1 text-xs font-medium',

                            roleColors[
                              member.role
                            ]?.bg ||
                              'bg-slate-100',

                            roleColors[
                              member.role
                            ]?.text ||
                              'text-slate-700',

                            roleColors[
                              member.role
                            ]?.border ||
                              'border-slate-300'
                          )}
                        >
                          {
                            member.position
                          }
                        </div>

                      </div>


                      <div className="p-5">

                        <h3 className="mb-2 font-bold text-slate-900 dark:text-white">
                          {
                            member.name
                          }
                        </h3>


                        <p className="mb-4 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                          {member.description ||
                            'Pengelola sarana prasarana sekolah'}
                        </p>


                        {member.email && (
                          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">

                            <Mail className="h-4 w-4" />

                            <span className="truncate">
                              {
                                member.email
                              }
                            </span>

                          </div>
                        )}

                      </div>

                    </div>

                  </motion.div>
                )
              )}

            </div>
          )}

        </div>

      </section>


      {/* MODAL */}
      {selectedMember && (
        <motion.div
          initial={{
            opacity: 0,
          }}

          animate={{
            opacity: 1,
          }}

          exit={{
            opacity: 0,
          }}

          onClick={() =>
            setSelectedMember(
              null
            )
          }

          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >

          <motion.div
            initial={{
              scale: 0.9,
              opacity: 0,
            }}

            animate={{
              scale: 1,
              opacity: 1,
            }}

            exit={{
              scale: 0.9,
              opacity: 0,
            }}

            onClick={(
              event
            ) =>
              event.stopPropagation()
            }

            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800"
          >

            <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600">

              {selectedMember.photo_url ? (
                <img
                  src={
                    selectedMember.photo_url
                  }

                  alt={
                    selectedMember.name
                  }

                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">

                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 shadow-2xl">

                    <User className="h-12 w-12 text-white" />

                  </div>

                </div>
              )}


              <button
                onClick={() =>
                  setSelectedMember(
                    null
                  )
                }

                className="absolute right-4 top-4 rounded-lg bg-white/90 p-2 shadow-lg hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-700"
              >
                <svg
                  className="h-5 w-5"

                  fill="none"

                  viewBox="0 0 24 24"

                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"

                    strokeLinejoin="round"

                    strokeWidth={
                      2
                    }

                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>

              </button>

            </div>


            <div className="p-6">

              <div className="mb-2 flex items-center gap-3">

                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {
                    selectedMember.name
                  }
                </h2>

              </div>


              <div
                className={cn(
                  'mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',

                  roleColors[
                    selectedMember.role
                  ]?.bg ||
                    'bg-slate-100',

                  roleColors[
                    selectedMember.role
                  ]?.text ||
                    'text-slate-700'
                )}
              >

                <Briefcase className="h-3.5 w-3.5" />

                {
                  selectedMember.position
                }

              </div>


              {selectedMember.description && (
                <p className="mb-6 leading-relaxed text-slate-600 dark:text-slate-400">
                  {
                    selectedMember.description
                  }
                </p>
              )}


              <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">

                {selectedMember.email && (
                  <a
                    href={`mailto:${selectedMember.email}`}

                    className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 transition-colors hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700"
                  >

                    <Mail className="h-5 w-5 text-blue-500" />


                    <span className="text-slate-700 dark:text-slate-300">
                      {
                        selectedMember.email
                      }
                    </span>

                  </a>
                )}


                {selectedMember.phone && (
                  <a
                    href={`tel:${selectedMember.phone}`}

                    className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 transition-colors hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700"
                  >

                    <Phone className="h-5 w-5 text-green-500" />


                    <span className="text-slate-700 dark:text-slate-300">
                      {
                        selectedMember.phone
                      }
                    </span>

                  </a>
                )}

              </div>

            </div>

          </motion.div>

        </motion.div>
      )}


      <Footer />

    </div>
  );
}