import { clsx, type ClassValue } from "clsx"

/**
 * Menggabungkan class, nilai false/undefined dilewati. Class yang bentrok tidak diselesaikan di sini,
 * jadi jangan memberi dua class untuk properti yang sama (misalnya flex dan hidden sekaligus).
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
