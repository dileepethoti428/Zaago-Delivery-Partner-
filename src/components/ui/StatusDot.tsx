import { cn } from '@/lib/utils';

type DotStatus = 'active' | 'warning' | 'error' | 'inactive';

interface StatusDotProps {
  status: DotStatus;
  className?: string;
  pulse?: boolean;
}

const statusColors: Record<DotStatus, string> = {
  active: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  inactive: 'bg-gray-400',
};

export function StatusDot({ status, className, pulse = false }: StatusDotProps) {
  return (
    <span className={cn('relative flex h-2 w-2 rounded-full', className)}>
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
            statusColors[status]
          )}
        />
      )}
      <span
        className={cn(
          'relative inline-flex h-2 w-2 rounded-full',
          statusColors[status]
        )}
      />
    </span>
  );
}
