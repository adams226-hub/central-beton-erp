import React from 'react';
import { cn } from '../../lib/utils';
import { STATUT_CONFIG } from '../../utils/formatters';

const StatusBadge = ({ statut, size = 'sm' }) => {
  const config = STATUT_CONFIG[statut] || { label: statut, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium', config.color, size === 'sm' ? 'text-xs' : 'text-sm')}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dot)} />
      {config.label}
    </span>
  );
};

export default StatusBadge;
