import type { DiaSemana } from '../types/academic';

export const DIAS_ORDEN: DiaSemana[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export const DIAS_ES: Record<DiaSemana, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

export const DIAS_CORTO: Record<DiaSemana, string> = {
  MONDAY: 'Lun',
  TUESDAY: 'Mar',
  WEDNESDAY: 'Mié',
  THURSDAY: 'Jue',
  FRIDAY: 'Vie',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};

const DIAS_JS: DiaSemana[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export function horaAMinutos(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})/.exec((hhmm || '').trim());
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function fechaADiaSemana(fechaIso: string): DiaSemana | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((fechaIso || '').trim());
  if (!match) return null;
  const dt = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return DIAS_JS[dt.getDay()];
}

export function fechaFuturaIso(diasDesdeHoy = 2): string {
  const d = new Date();
  d.setDate(d.getDate() + diasDesdeHoy);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatearFechaCorta(fechaIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((fechaIso || '').trim());
  if (!match) return fechaIso;
  const dia = fechaADiaSemana(fechaIso);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const mes = meses[Number(match[2]) - 1] ?? match[2];
  return `${dia ? DIAS_CORTO[dia] + ' ' : ''}${Number(match[3])} ${mes} ${match[1]}`;
}
