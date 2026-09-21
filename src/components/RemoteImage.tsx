import {
  useEffect,
  useMemo,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from 'react';

import {
  ImageOff,
} from 'lucide-react';

function extractDriveFileId(
  value?: string | null
) {
  if (!value) {
    return null;
  }

  const fileMatch =
    value.match(
      /\/file\/d\/([^/?#]+)/
    );

  if (fileMatch?.[1]) {
    return fileMatch[1];
  }

  const googleContentMatch =
    value.match(
      /googleusercontent\.com\/d\/([^=/?#]+)/
    );

  if (
    googleContentMatch?.[1]
  ) {
    return googleContentMatch[1];
  }

  try {
    const parsed =
      new URL(value);

    return (
      parsed.searchParams.get(
        'id'
      ) ||
      null
    );
  } catch {
    return null;
  }
}

function buildCandidates(
  value?: string | null
) {
  const source =
    String(value || '').trim();

  if (!source) {
    return [];
  }

  const id =
    extractDriveFileId(
      source
    );

  if (!id) {
    return [source];
  }

  const encoded =
    encodeURIComponent(id);

  const driveCandidates = [
    `https://drive.google.com/thumbnail?id=${encoded}&sz=w1600`,
    `https://lh3.googleusercontent.com/d/${encoded}=w1600`,
    `https://drive.usercontent.google.com/download?id=${encoded}&export=view&authuser=0`,
  ];

  if (
    source.includes(
      'googleusercontent.com'
    ) ||
    source.includes(
      'drive.usercontent.google.com'
    )
  ) {
    return [
      source,
      ...driveCandidates,
    ].filter(
      (
        candidate,
        index,
        list
      ) =>
        list.indexOf(
          candidate
        ) === index
    );
  }

  return driveCandidates;
}

interface RemoteImageProps
  extends Omit<
    ImgHTMLAttributes<HTMLImageElement>,
    'src'
  > {
  src?: string | null;
  fallbackClassName?: string;
}

export default function RemoteImage({
  src,
  alt = '',
  className,
  fallbackClassName,
  onError,
  ...props
}: RemoteImageProps) {
  const candidates =
    useMemo(
      () =>
        buildCandidates(
          src
        ),
      [src]
    );

  const [
    candidateIndex,
    setCandidateIndex,
  ] = useState(0);

  const [
    failed,
    setFailed,
  ] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setFailed(false);
  }, [src]);

  const handleError = (
    event:
      SyntheticEvent<
        HTMLImageElement
      >
  ) => {
    onError?.(event);

    if (
      candidateIndex <
      candidates.length - 1
    ) {
      setCandidateIndex(
        (current) =>
          current + 1
      );

      return;
    }

    setFailed(true);
  };

  if (
    failed ||
    candidates.length === 0
  ) {
    return (
      <div
        className={
          fallbackClassName ||
          className ||
          'flex h-24 w-24 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
        }
        role="img"
        aria-label={
          alt ||
          'Gambar tidak tersedia'
        }
      >
        <ImageOff className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      {...props}
      src={
        candidates[
          candidateIndex
        ]
      }
      alt=""
      aria-label={
        alt ||
        'Gambar'
      }
      className={
        className
      }
      onError={
        handleError
      }
    />
  );
}
