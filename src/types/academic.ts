export type DiaSemana =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type EstadoReprogramacion = 'SOLICITADO' | 'CONFIRMADO' | 'RECHAZADO';

export type RolUsuario = 'Coordinador Académico' | 'Docente' | 'Estudiante';

export interface Docente {
  codigo: string;
  nombres: string;
  apellidos: string;
  cursosCount?: number;
  horasSemanales?: number;
}

export interface Estudiante {
  codigo: string;
  nombres: string;
  apellidos: string;
  cursos?: string[];
}

export interface Aula {
  codigo: string;
  pabellon: string;
  sede: string;
  aforo: number;
}

export interface Horario {
  id: number;
  docenteCodigo: string;
  docenteNombre?: string;
  curso: string;
  dia: DiaSemana;
  horaInicio: string; // HH:MM
  horaFin: string; // HH:MM
  aula: string;
  inscritos?: number;
}

export interface Matricula {
  id: number;
  estudianteCodigo: string;
  curso: string;
}

export interface Reprogramacion {
  id: number;
  codigoSolicitud: string;
  docenteCodigo: string;
  docenteNombre?: string;
  curso: string;
  fecha: string; // YYYY-MM-DD
  horaInicio: string; // HH:MM
  horaFin: string; // HH:MM
  aula: string;
  motivo?: string;
  estado: EstadoReprogramacion;
  fechaRegistro: string;
  porcentajeAsistencia?: number;
  totalEstudiantes?: number;
  disponibles?: number;
}

export interface ConflictoDetalle {
  tipo: 'DOCENTE' | 'ESTUDIANTE' | 'AULA';
  severidad: 'SOLAPAMIENTO' | 'INTERVALO_15MIN' | 'AFORO';
  entidadCodigo: string;
  entidadNombre?: string;
  cursoConflicto: string;
  horaInicio: string;
  horaFin: string;
  origen: 'HORARIO_REGULAR' | 'REPROGRAMACION' | 'AFORO';
  minutosSeparacion?: number;
  mensaje: string;
}

export interface ReglaEvaluada {
  id:
    | 'rangoHorario'
    | 'fechaVigente'
    | 'cruceDocente'
    | 'intervaloMinimo'
    | 'cruceEstudiantes'
    | 'aulaYAforo';
  titulo: string;
  estado: 'ok' | 'error' | 'warning';
  detalle: string;
}

export interface DisponibilidadPresencial {
  totalEstudiantes: number;
  disponibles: number;
  conCruce: number;
  conCruceDirecto: number;
  conCruceIntervalo: number;
  porcentajeAsistencia: number;
  estudiantesAfectados: ConflictoDetalle[];
}

export interface ResultadoValidacion {
  valido: boolean;
  resumen: string;
  bufferMinutos: number;
  diaSemana: DiaSemana | null;
  reglas: ReglaEvaluada[];
  conflictosDocente: ConflictoDetalle[];
  conflictosAula: ConflictoDetalle[];
  disponibilidad: DisponibilidadPresencial;
  aulaInfo: Aula | null;
}

export interface FranjaSugerida {
  fecha: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
  porcentajeAsistencia: number;
  disponibles: number;
  totalEstudiantes: number;
  aulasLibres: Aula[];
}

export interface ResumenSistema {
  totalDocentes: number;
  totalEstudiantes: number;
  totalHorarios: number;
  totalMatriculas: number;
  totalAulas: number;
  reprogramacionesSolicitadas: number;
  reprogramacionesConfirmadas: number;
  reprogramacionesRechazadas: number;
  cursosUnicos: string[];
  sedes: string[];
}
