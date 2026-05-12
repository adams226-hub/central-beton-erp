import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'blue', trend, trendValue, delay = 0 }) => {
  const colors = {
    blue: { bg: 'bg-blue-50', icon: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-100' },
    green: { bg: 'bg-green-50', icon: 'bg-green-600', text: 'text-green-600', border: 'border-green-100' },
    orange: { bg: 'bg-orange-50', icon: 'bg-orange-600', text: 'text-orange-600', border: 'border-orange-100' },
    red: { bg: 'bg-red-50', icon: 'bg-red-600', text: 'text-red-600', border: 'border-red-100' },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-100' },
    teal: { bg: 'bg-teal-50', icon: 'bg-teal-600', text: 'text-teal-600', border: 'border-teal-100' },
  };
  const c = colors[color] || colors.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn('amp-stat-card border', c.border)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1 truncate">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', trend >= 0 ? 'text-green-600' : 'text-red-600')}>
              {trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              <span>{trendValue || `${Math.abs(trend)}%`}</span>
              <span className="text-gray-400 font-normal">vs mois passé</span>
            </div>
          )}
        </div>
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ml-3', c.icon)}>
          {Icon && <Icon size={21} className="text-white" />}
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
