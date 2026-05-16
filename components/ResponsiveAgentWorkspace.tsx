'use client';

import { useEffect, useState } from 'react';

import AgentWorkspace from '@/components/AgentWorkspace';
import MobileAgentWorkspace from '@/components/MobileAgentWorkspace';

export default function ResponsiveAgentWorkspace() {
  const [isMobile, setIsMobile] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const apply = () => {
      setIsMobile(media.matches);
      setIsHydrated(true);
    };

    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  if (!isHydrated) {
    return <AgentWorkspace />;
  }

  return isMobile ? <MobileAgentWorkspace /> : <AgentWorkspace />;
}
