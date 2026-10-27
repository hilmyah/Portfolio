import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Menggabungkan class; kalau ada class Tailwind yang bentrok, yang terakhir menang. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
