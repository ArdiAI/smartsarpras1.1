import { isValidElement, type ReactNode, type ElementType } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../utils/cn';

export default function EmptyState({ title = 'Tidak ada data', description, icon, className }: { title?: string; description?: string; icon?: ReactNode | ElementType; className?: string }) {
  const Icon = icon as ElementType;
  return (
    <div className={cn('flex flex-col items-center justify-center py-10 text-center', className)}>
      <div className="mb-3 text-slate-300 dark:text-slate-600">{icon ? (isValidElement(icon) ? icon : <Icon className="h-7 w-7" />) : <Inbox className="h-7 w-7" />}</div>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {description && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{description}</p>}
    </div>
  );
}
