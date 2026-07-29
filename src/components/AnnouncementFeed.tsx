import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Megaphone } from 'lucide-react';

export default function AnnouncementFeed() {
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('announcements').select('*').eq('status', 'aktif').order('published_at', { ascending: false }).limit(5);
      setAnnouncements(data || []);
    };
    fetch();
  }, []);

  if (announcements.length === 0) return null;

  return (
    <div className="space-y-3">
      {announcements.map((a, i) => (
        <div key={a.id} className="flex items-start gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-700/50 animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white">{a.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
            <p className="text-xs text-slate-400 mt-1">{new Date(a.published_at).toLocaleDateString('id-ID')}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
