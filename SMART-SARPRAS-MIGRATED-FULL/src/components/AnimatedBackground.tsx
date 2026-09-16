import { cn } from '../utils/cn';
export default function AnimatedBackground({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-brand-100/40 dark:bg-brand-900/10" />
      <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-slate-100/40 dark:bg-slate-800/20" />
    </div>
  );
}
