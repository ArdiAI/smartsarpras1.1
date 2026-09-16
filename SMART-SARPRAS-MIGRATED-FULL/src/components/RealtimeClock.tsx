import { useEffect, useState } from 'react';

export default function RealtimeClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-sm text-slate-500 dark:text-slate-400">
      {time.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} &middot; {time.toLocaleTimeString('id-ID')}
    </div>
  );
}
