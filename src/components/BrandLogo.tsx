'use client';

import React from 'react';
import BRAND_CONFIG from '@/lib/brandConfig';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showText?: boolean;
  textClassName?: string;
  subtitleClassName?: string;
}

const sizeMap = {
  xs: { box: 'w-6 h-6 rounded-md text-[11px]', text: 'text-xs' },
  sm: { box: 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs sm:text-sm', text: 'text-sm' },
  md: { box: 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-sm sm:text-base', text: 'text-base' },
  lg: { box: 'w-12 h-12 rounded-xl text-lg sm:text-xl', text: 'text-lg' },
  xl: { box: 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl text-2xl sm:text-3xl', text: 'text-xl sm:text-2xl' },
  '2xl': { box: 'w-20 h-20 rounded-3xl text-3xl sm:text-4xl', text: 'text-2xl sm:text-3xl' },
};

export default function BrandLogo({
  size = 'md',
  className = '',
  showText = false,
  textClassName = '',
  subtitleClassName = '',
}: BrandLogoProps) {
  const { box, text } = sizeMap[size] || sizeMap.md;

  return (
    <div className={`inline-flex items-center space-x-2.5 ${className}`}>
      {/* Official S.H Monogram Logo Mark */}
      <div
        className={`
          ${box}
          bg-linear-to-br from-blue-500 via-blue-600 to-blue-800
          text-white font-black tracking-tight
          flex items-center justify-center shrink-0
          shadow-md shadow-blue-900/30
          border border-white/20 select-none
        `}
        aria-label={`${BRAND_CONFIG.shopName} Logo`}
      >
        <span>{BRAND_CONFIG.badge}</span>
      </div>

      {/* Optional Brand Text */}
      {showText && (
        <div className="flex flex-col min-w-0">
          <span className={`font-black tracking-tight text-white leading-tight truncate ${text} ${textClassName}`}>
            {BRAND_CONFIG.shopName}
          </span>
          <span className={`text-[10px] text-blue-300 font-medium leading-none truncate ${subtitleClassName}`}>
            {BRAND_CONFIG.tagline}
          </span>
        </div>
      )}
    </div>
  );
}
