import { authFetch } from './authFetch';

export type EventColorCategory =
  | 'agenda'
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'borrowed'
  | 'returned';


export interface TimelineEvent {
  id: string;

  jenis:
    | 'Agenda'
    | 'Peminjaman';

  title: string;
  date: string;

  startDate:
    | string
    | null;

  endDate:
    | string
    | null;

  startTime:
    | string
    | null;

  endTime:
    | string
    | null;

  location:
    | string
    | null;

  organisasi:
    | string
    | null;

  penanggungJawab:
    | string
    | null;

  email:
    | string
    | null;

  contactPhone:
    | string
    | null;

  status: string;

  colorCategory:
    EventColorCategory;

  description:
    | string
    | null;
}


interface AgendaApiRow {
  id: string;

  title:
    | string
    | null;

  category:
    | string
    | null;

  event_date:
    | string
    | null;

  end_date:
    | string
    | null;

  start_time:
    | string
    | null;

  end_time:
    | string
    | null;

  location:
    | string
    | null;

  organizer:
    | string
    | null;

  description:
    | string
    | null;

  status:
    | string
    | null;

  penyelenggara:
    | string
    | null;

  organisasi_jurusan:
    | string
    | null;

  penanggung_jawab:
    | string
    | null;

  jenis_kegiatan:
    | string
    | null;

  email:
    | string
    | null;

  contact_phone:
    | string
    | null;

  jumlah_peserta:
    | number
    | null;
}


interface BorrowingApiRow {
  id: string;

  borrower_name:
    | string
    | null;

  borrow_date:
    | string
    | null;

  return_date:
    | string
    | null;

  start_time:
    | string
    | null;

  end_time:
    | string
    | null;

  purpose:
    | string
    | null;

  status:
    | string
    | null;

  item_type:
    | string
    | null;

  notes:
    | string
    | null;
}


interface TimelineApiData {
  agendas:
    AgendaApiRow[];

  borrowings:
    BorrowingApiRow[];
}


interface TimelineCounts {
  agendaToday: number;
  borrowToday: number;
  weekTotal: number;
}


interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}


const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';


/*
 * false = peminjaman disembunyikan
 * true  = peminjaman ditampilkan
 *
 * Data peminjaman tidak dihapus.
 */
const SHOW_BORROWINGS =
  false;


export const colorCategoryStyles:
  Record<
    EventColorCategory,
    {
      bg: string;
      dot: string;
      text: string;
      label: string;
    }
  > = {
    agenda: {
      bg:
        'bg-blue-100 dark:bg-blue-900/40',

      dot:
        'bg-blue-500',

      text:
        'text-blue-700 dark:text-blue-300',

      label:
        'Agenda',
    },


    approved: {
      bg:
        'bg-emerald-100 dark:bg-emerald-900/40',

      dot:
        'bg-emerald-500',

      text:
        'text-emerald-700 dark:text-emerald-300',

      label:
        'Disetujui',
    },


    pending: {
      bg:
        'bg-amber-100 dark:bg-amber-900/40',

      dot:
        'bg-amber-500',

      text:
        'text-amber-700 dark:text-amber-300',

      label:
        'Menunggu',
    },


    rejected: {
      bg:
        'bg-red-100 dark:bg-red-900/40',

      dot:
        'bg-red-500',

      text:
        'text-red-700 dark:text-red-300',

      label:
        'Ditolak',
    },


    borrowed: {
      bg:
        'bg-purple-100 dark:bg-purple-900/40',

      dot:
        'bg-purple-500',

      text:
        'text-purple-700 dark:text-purple-300',

      label:
        'Dipinjam',
    },


    returned: {
      bg:
        'bg-slate-100 dark:bg-slate-700/40',

      dot:
        'bg-slate-500',

      text:
        'text-slate-700 dark:text-slate-300',

      label:
        'Dikembalikan',
    },
  };


export function colorCategoryFor(
  jenis: string,
  status: string
): EventColorCategory {
  if (
    jenis === 'Agenda' ||
    jenis === 'agenda'
  ) {
    return 'agenda';
  }


  switch (status) {
    case 'approved':
      return 'approved';

    case 'pending':
      return 'pending';

    case 'rejected':
      return 'rejected';

    case 'returned':
    case 'completed':
      return 'returned';

    default:
      return 'borrowed';
  }
}


function pad(
  value: number
) {
  return value
    .toString()
    .padStart(
      2,
      '0'
    );
}


function normalizeDateOnly(
  value?: string | null
) {
  if (!value) {
    return null;
  }

  const match =
    String(value).match(
      /^(\d{4}-\d{2}-\d{2})/
    );

  return match?.[1] ?? null;
}


function datesInRange(
  startDate: string,
  endDate: string
) {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (
    Number.isNaN(current.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < current
  ) {
    return [startDate];
  }

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}


// =====================================================
// FETCH TIMELINE
// =====================================================

export async function fetchTimelineEvents(
  year: number,
  month: number,
  includeBorrowings = false
): Promise<TimelineEvent[]> {
  const params =
    new URLSearchParams({
      year:
        String(year),

      month:
        String(
          month + 1
        ),

      includeBorrowings:
        String(
          includeBorrowings
        ),
    });


  const response =
    await authFetch(
      `${API_BASE_URL}/api/timeline/events?${params.toString()}`
    );


  const result =
    (await response
      .json()
      .catch(
        () => null
      )) as
        | ApiResponse<TimelineApiData>
        | null;


  if (
    !response.ok ||
    !result?.ok ||
    !result.data
  ) {
    throw new Error(
      result?.message ??
        'Gagal mengambil timeline'
    );
  }


  const events:
    TimelineEvent[] = [];


  // ===================================================
  // AGENDA
  // ===================================================

  for (
    const agenda of
    result.data.agendas ??
    []
  ) {
    const eventDate =
      normalizeDateOnly(
        agenda.event_date
      );

    if (!eventDate) {
      continue;
    }

    const endDate =
      normalizeDateOnly(
        agenda.end_date
      );


    const occupiedDates =
      datesInRange(
        eventDate,
        endDate ?? eventDate
      );

    for (const occupiedDate of occupiedDates) {
      events.push({
        id:
          agenda.id,

        jenis:
          'Agenda',

        title:
          agenda.title ??
          'Agenda',

        date:
          occupiedDate,

        startDate:
          eventDate,

        endDate:
          endDate ?? eventDate,

        startTime:
          agenda.start_time ??
          null,

        endTime:
          agenda.end_time ??
          null,

        location:
          agenda.location ??
          null,

        organisasi:
          agenda.organisasi_jurusan ??
          agenda.penyelenggara ??
          agenda.organizer ??
          null,

        penanggungJawab:
          agenda.penanggung_jawab ??
          null,

        email:
          agenda.email ??
          null,

        contactPhone:
          agenda.contact_phone ??
          null,

        status:
          agenda.status ??
          'scheduled',

        colorCategory:
          'agenda',

        description:
          agenda.description ??
          null,
      });
    }
  }


  // ===================================================
  // PEMINJAMAN
  // ===================================================

  if (
    includeBorrowings
  ) {
    for (
      const borrowing of
      result.data.borrowings ??
      []
    ) {
      const date =
        borrowing.borrow_date ??
        borrowing.return_date;


      if (!date) {
        continue;
      }


      events.push({
        id:
          borrowing.id,

        jenis:
          'Peminjaman',

        title:
          borrowing.purpose ??
          borrowing.borrower_name ??
          'Peminjaman',

        date,

        startDate:
          borrowing.borrow_date ??
          null,

        endDate:
          borrowing.return_date ??
          null,

        startTime:
          borrowing.start_time ??
          null,

        endTime:
          borrowing.end_time ??
          null,

        location:
          null,

        organisasi:
          null,

        penanggungJawab:
          borrowing.borrower_name ??
          null,

        email:
          null,

        contactPhone:
          null,

        status:
          borrowing.status ??
          'pending',

        colorCategory:
          colorCategoryFor(
            'Peminjaman',
            borrowing.status ??
              'pending'
          ),

        description:
          borrowing.notes ??
          null,
      });
    }
  }


  events.sort(
    (
      first,
      second
    ) => {
      if (
        first.date <
        second.date
      ) {
        return -1;
      }


      if (
        first.date >
        second.date
      ) {
        return 1;
      }


      return 0;
    }
  );


  return events;
}


// =====================================================
// COUNT HARI INI
// =====================================================

export async function fetchTodayCounts(): Promise<TimelineCounts> {
  const now =
    new Date();


  const today =
    `${now.getFullYear()}-${pad(
      now.getMonth() +
        1
    )}-${pad(
      now.getDate()
    )}`;


  const weekEnd =
    new Date(
      now.getTime() +
        6 *
          24 *
          60 *
          60 *
          1000
    );


  const weekEndString =
    `${weekEnd.getFullYear()}-${pad(
      weekEnd.getMonth() +
        1
    )}-${pad(
      weekEnd.getDate()
    )}`;


  const params =
    new URLSearchParams({
      today,

      weekEnd:
        weekEndString,

      includeBorrowings:
        String(
          SHOW_BORROWINGS
        ),
    });


  const response =
    await authFetch(
      `${API_BASE_URL}/api/timeline/counts?${params.toString()}`
    );


  const result =
    (await response
      .json()
      .catch(
        () => null
      )) as
        | ApiResponse<TimelineCounts>
        | null;


  if (
    !response.ok ||
    !result?.ok ||
    !result.data
  ) {
    throw new Error(
      result?.message ??
        'Gagal menghitung timeline'
    );
  }


  return {
    agendaToday:
      Number(
        result.data
          .agendaToday ??
          0
      ),

    borrowToday:
      Number(
        result.data
          .borrowToday ??
          0
      ),

    weekTotal:
      Number(
        result.data
          .weekTotal ??
          0
      ),
  };
}