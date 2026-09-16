import { cn } from '../lib/utils';

interface StatusBadgeProps {
  status: 'compliant' | 'warning' | 'ng' | 'pending' | 'na';
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = {
    compliant: { label: 'Compliant', classes: 'bg-green-100 text-green-800 border-green-200' },
    warning: { label: 'Warning', classes: 'bg-amber-100 text-amber-800 border-amber-200' },
    ng: { label: 'NG', classes: 'bg-red-100 text-red-800 border-red-200' },
    pending: { label: 'Pending', classes: 'bg-gray-100 text-gray-800 border-gray-200' },
    na: { label: 'N/A', classes: 'bg-gray-100 text-gray-500 border-gray-200' },
  };

  const { label, classes } = config[status] || config.pending;

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', classes, className)}>
      {label}
    </span>
  );
}
