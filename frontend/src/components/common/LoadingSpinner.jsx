import React from 'react';
import { cn } from '../../lib/utils';

export const LoadingSpinner = ({ size = 'md', className }) => {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-2', lg: 'w-12 h-12 border-3' };
  return (
    <div className={cn('border-blue-600 border-t-transparent rounded-full animate-spin', sizes[size], className)} />
  );
};

export const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <LoadingSpinner size="lg" className="mx-auto" />
      <p className="text-gray-400 text-sm mt-3">Chargement...</p>
    </div>
  </div>
);

export default LoadingSpinner;
