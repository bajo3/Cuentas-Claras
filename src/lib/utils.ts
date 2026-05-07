import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatARS(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  })
    .format(value || 0)
    .replace('$', '$ ')
}

export function formatDateAR(value: string) {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

export function todayISO(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function monthInput(date = new Date()) {
  return date.toISOString().slice(0, 7)
}
