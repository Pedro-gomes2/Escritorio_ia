import { format, formatDistanceToNow, isPast, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDate(date: string | Date) {
  return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR })
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
}

export function prazoUrgencia(date: string | Date): 'vencido' | 'urgente' | 'proximo' | 'ok' {
  const d = new Date(date)
  if (isPast(d)) return 'vencido'
  const dias = differenceInDays(d, new Date())
  if (dias <= 2) return 'urgente'
  if (dias <= 7) return 'proximo'
  return 'ok'
}

export function formatMoeda(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}
