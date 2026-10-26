import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names, letting later Tailwind classes override earlier ones (shadcn/ui's helper). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
