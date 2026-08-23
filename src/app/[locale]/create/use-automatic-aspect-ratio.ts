import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { pickClosestAspectRatio } from './create-utils';

type Options = {
  source?: string | null;
  aspectRatios: string[];
  setAspectRatio: Dispatch<SetStateAction<string>>;
};

export function useAutomaticAspectRatio({
  source,
  aspectRatios,
  setAspectRatio,
}: Options) {
  useEffect(() => {
    if (!source) return;

    let cancelled = false;
    const image = new globalThis.Image();
    image.decoding = 'async';
    image.loading = 'eager';
    image.onload = () => {
      if (cancelled || !image.naturalWidth || !image.naturalHeight) return;
      const nextAspectRatio = pickClosestAspectRatio(
        image.naturalWidth,
        image.naturalHeight,
        aspectRatios,
      );
      setAspectRatio((previous) =>
        previous === nextAspectRatio ? previous : nextAspectRatio,
      );
    };
    image.src = source;

    return () => {
      cancelled = true;
    };
  }, [aspectRatios, setAspectRatio, source]);
}