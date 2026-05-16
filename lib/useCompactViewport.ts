'use client';

import { useEffect, useState } from 'react';

const COMPACT_VIEWPORT_QUERY = '(max-width: 767px)';

export function useCompactViewport() {
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(COMPACT_VIEWPORT_QUERY);
    const apply = () => {
      setIsCompactViewport(media.matches);
    };

    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  return isCompactViewport;
}
