import { useEffect, useState } from 'react';

export function useIsPortrait(): boolean {
  const [portrait, setPortrait] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < window.innerHeight : false
  );

  useEffect(() => {
    function handleResize() {
      setPortrait(window.innerWidth < window.innerHeight);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return portrait;
}
