import React from 'react';
import { useVeyra } from '../../context/VeyraContext';
import { cn } from '../../lib/cn';

/**
 * Renders the flat geometric Veyra brand emblem (dark or light surface variant)
 * with an optional clean typographic wordmark.
 */
export function VeyraLogo({
  size = 'md',
  showWordmark = true,
  className,
}: {
  size?: 'xs' | 'sm' | 'md';
  showWordmark?: boolean;
  className?: string;
}) {
  const { theme } = useVeyra();
  const src = theme === 'light' ? '/veyra-logo-light.jpg' : '/veyra-logo-dark.jpg';

  const imgSize =
    size === 'xs' ? 'h-4 w-4 rounded' : size === 'sm' ? 'h-5 w-5 rounded-md' : 'h-6 w-6 rounded-md';
  const textSize =
    size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-base' : 'text-lg';

  return (
    <span className={cn('inline-flex items-center gap-2 shrink-0', className)}>
      <img
        src={src}
        alt="Veyra"
        className={cn(imgSize, 'object-cover border border-[#e4e4e7] dark:border-white/10 shrink-0')}
      />
      {showWordmark && (
        <span className={cn('font-display font-semibold tracking-tight text-[#09090b] dark:text-white', textSize)}>
          VEYRA
        </span>
      )}
    </span>
  );
}
