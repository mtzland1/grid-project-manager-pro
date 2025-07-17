
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NotificationBadgeProps {
  count: number;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export const NotificationBadge = ({ 
  count, 
  onClick, 
  className,
  variant = 'destructive' 
}: NotificationBadgeProps) => {
  if (count === 0) return null;

  return (
    <Badge 
      variant={variant}
      className={cn(
        "ml-2 px-2 py-1 text-xs font-bold cursor-pointer hover:opacity-80 transition-opacity",
        "bg-red-500 text-white hover:bg-red-600",
        className
      )}
      onClick={onClick}
    >
      {count > 99 ? '99+' : count}
    </Badge>
  );
};
