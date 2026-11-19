import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import type {
  Aula,
  ConflictoDetalle,
  DiaSemana,
  DisponibilidadPresencial,
  Docente,
  EstadoReprogramacion,
  Estudiante,
  FranjaSugerida,
  Horario,
  Matricula,
  ReglaEvaluada,
  Reprogramacion,
  ResultadoValidacion,
  ResumenSistema,
} from './src/types/academic.ts';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');

const DIAS_JS: DiaSemana[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

const DIAS_LABEL_ES: Record<DiaSemana, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

// --- In-memory indexed store (eliminates N+1 queries from original JPA loops) ---
const docentesMap = new Map<string, Docente>();
const estudiantesMap = new Map<string, Estudiante>();
const aulasMap = new Map<string, Aula>();
let horariosList: Horario[] = [];
let matriculasList: Matricula[] = [];
let reprogramacionesList: Reprogramacion[] = [];

// Pre-computed fast lookup indexes
const horariosPorDocente = new Map<string, Horario[]>();
const horariosPorCurso = new Map<string, Horario[]>();
const horariosPorAula = new Map<string, Horario[]>();
const cursosPorEstudiante = new Map<string, Set<string>>();
const estudiantesPorCurso = new Map<string, Set<string>>();

let nextHorarioId = 1;
let nextMatriculaId = 1;
let nextReprogramacionId = 1;

function leerCsv(filename: string): string[][] {
  const fullPath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    return [];
  }
  const raw = fs.readFileSync(fullPath, 'utf-8');
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];
  return lines.slice(1).map((line) => line.split(';').map((c) => c.trim()));
}

function normalizarHora(valor: string): string {
  const clean = (valor || '').trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(clean);
  if (!match) return '';
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function horaAMinutos(hhmm: string): number {
  const norm = normalizarHora(hhmm);
  if (!norm) return -1;
  const [h, m] = norm.split(':').map(Number);
  return h * 60 + m;
}

function minutosAHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fechaADiaSemana(fechaIso: string): DiaSemana | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((fechaIso || '').trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return DIAS_JS[dt.getDay()];
}

function hoyIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sumarDiasIso(baseIso: string, dias: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dias);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function reconstruirIndices(): void {
  horariosPorDocente.clear();
  horariosPorCurso.clear();
  horariosPorAula.clear();
  cursosPorEstudiante.clear();
  estudiantesPorCurso.clear();

  for (const h of horariosList) {
    const docKey = h.docenteCodigo.toUpperCase();
    if (!horariosPorDocente.has(docKey)) horariosPorDocente.set(docKey, []);
    horariosPorDocente.get(docKey)!.push(h);

    const cursoKey = h.curso.toLowerCase();
    if (!horariosPorCurso.has(cursoKey)) horariosPorCurso.set(cursoKey, []);
    horariosPorCurso.get(cursoKey)!.push(h);

    if (h.aula) {
      const aulaKey = h.aula.toUpperCase();
      if (!horariosPorAula.has(aulaKey)) horariosPorAula.set(aulaKey, []);
      horariosPorAula.get(aulaKey)!.push(h);
    }
  }

  for (const mat of matriculasList) {
    const estKey = mat.estudianteCodigo.toUpperCase();
    const cursoKey = mat.curso.toLowerCase();
    if (!cursosPorEstudiante.has(estKey)) cursosPorEstudiante.set(estKey, new Set());
    cursosPorEstudiante.get(estKey)!.add(mat.curso);

    if (!estudiantesPorCurso.has(cursoKey)) estudiantesPorCurso.set(cursoKey, new Set());
    estudiantesPorCurso.get(cursoKey)!.add(estKey);
  }
}

function cargarDatosIniciales(): void {
  docentesMap.clear();
  estudiantesMap.clear();
  aulasMap.clear();
  horariosList = [];
  matriculasList = [];
  reprogramacionesList = [];

  for (const cols of leerCsv('aulas.csv')) {
    if (cols.length < 4 || !cols[0]) continue;
    const codigo = cols[0].toUpperCase();
    aulasMap.set(codigo, {
      codigo,
      pabellon: cols[1] || codigo.charAt(0),
      sede: cols[2] || 'Campus Arequipa',
      aforo: Number(cols[3]) || 30,
    });
  }

  for (const cols of leerCsv('docentes.csv')) {
    if (cols.length < 3 || !cols[0]) continue;
    const codigo = cols[0].toUpperCase();
    docentesMap.set(codigo, {
      codigo,
      nombres: cols[1],
      apellidos: cols[2],
    });
  }

  for (const cols of leerCsv('estudiantes.csv')) {
    if (cols.length < 3 || !cols[0]) continue;
    const codigo = cols[0].toUpperCase();
    estudiantesMap.set(codigo, {
      codigo,
      nombres: cols[1],
      apellidos: cols[2],
    });
  }

  for (const cols of leerCsv('horarios.csv')) {
    if (cols.length < 6 || !cols[0]) continue;
    const docenteCodigo = cols[0].toUpperCase();
    const curso = cols[1];
    const dia = cols[2].toUpperCase() as DiaSemana;
    const horaInicio = normalizarHora(cols[3]);
    const horaFin = normalizarHora(cols[4]);
    const aula = (cols[5] || '').toUpperCase();
    if (!horaInicio || !horaFin) continue;

    // Ensure classroom referenced in regular schedule also exists in aulasMap
    if (aula && !aulasMap.has(aula)) {
      aulasMap.set(aula, {
        codigo: aula,
        pabellon: aula.charAt(0) || 'A',
        sede: 'Campus Arequipa',
        aforo: 36,
      });
    }

    horariosList.push({
      id: nextHorarioId++,
      docenteCodigo,
      curso,
      dia,
      horaInicio,
      horaFin,
      aula,
    });
  }

  for (const cols of leerCsv('matriculas.csv')) {
    if (cols.length < 2 || !cols[0] || !cols[1]) continue;
    matriculasList.push({
      id: nextMatriculaId++,
      estudianteCodigo: cols[0].toUpperCase(),
      curso: cols[1],
    });
  }

  reconstruirIndices();

  // Seed 2 realistic future reschedulings for immediate demonstration in Requests/Confirmation view
  const proxSabado = (() => {
    const base = hoyIso();
    for (let i = 2; i <= 10; i++) {
      const candidate = sumarDiasIso(base, i);
      if (fechaADiaSemana(candidate) === 'SATURDAY') return candidate;
    }
    return sumarDiasIso(base, 4);
  })();

  const proxJueves = (() => {
    const base = hoyIso();
    for (let i = 3; i <= 12; i++) {
      const candidate = sumarDiasIso(base, i);
      if (fechaADiaSemana(candidate) === 'THURSDAY') return candidate;
    }
    return sumarDiasIso(base, 5);
  })();

  const demo1 = evaluarReprogramacion({
    docenteCodigo: 'DOC-101',
    curso: 'Desarrollo Web Integrado',
    fecha: proxSabado,
    horaInicio: '10:30',
    horaFin: '12:30',
    aula: 'A0107',
    bufferMinutos: 15,
  });

  reprogramacionesList.push({
    id: nextReprogramacionId++,
    codigoSolicitud: 'REP-2026-001',
    docenteCodigo: 'DOC-101',
    curso: 'Desarrollo Web Integrado',
    fecha: proxSabado,
    horaInicio: '10:30',
    horaFin: '12:30',
    aula: 'A0107',
    motivo: 'Recuperación de sesión de laboratorio por feriado institucional',
    estado: 'CONFIRMADO',
    fechaRegistro: new Date(Date.now() - 86400000).toISOString(),
    porcentajeAsistencia: demo1.disponibilidad.porcentajeAsistencia,
    totalEstudiantes: demo1.disponibilidad.totalEstudiantes,
    disponibles: demo1.disponibilidad.disponibles,
  });

  const demo2 = evaluarReprogramacion({
    docenteCodigo: 'DOC-103',
    curso: 'Calidad de Software',
    fecha: proxJueves,
    horaInicio: '16:30',
    horaFin: '18:30',
    aula: 'A0108',
    bufferMinutos: 15,
  });

  reprogramacionesList.push({
    id: nextReprogramacionId++,
    codigoSolicitud: 'REP-2026-002',
    docenteCodigo: 'DOC-103',
    curso: 'Calidad de Software',
    fecha: proxJueves,
    horaInicio: '16:30',
    horaFin: '18:30',
    aula: 'A0108',
    motivo: 'Sesión práctica de pruebas automatizadas con disponibilidad ampliada',
    estado: 'SOLICITADO',
    fechaRegistro: new Date(Date.now() - 14400000).toISOString(),
    porcentajeAsistencia: demo2.disponibilidad.porcentajeAsistencia,
    totalEstudiantes: demo2.disponibilidad.totalEstudiantes,
    disponibles: demo2.disponibilidad.disponibles,
  });
}

function nombreDocente(codigo: string): string {
  const d = docentesMap.get((codigo || '').toUpperCase());
  return d ? `${d.nombres} ${d.apellidos}` : codigo;
}

function nombreEstudiante(codigo: string): string {
  const e = estudiantesMap.get((codigo || '').toUpperCase());
  return e ? `${e.nombres} ${e.apellidos}` : codigo;
}

function enriquecerHorario(h: Horario): Horario {
  const inscritos = estudiantesPorCurso.get(h.curso.toLowerCase())?.size ?? 0;
  return {
    ...h,
    docenteNombre: nombreDocente(h.docenteCodigo),
    inscritos,
  };
}

function enriquecerReprogramacion(r: Reprogramacion): Reprogramacion {
  return {
    ...r,
    docenteNombre: nombreDocente(r.docenteCodigo),
  };
}

function detectarTipoSolapamiento(
  s1: number,
  e1: number,
  s2: number,
  e2: number,
  bufferMin: number
): { tipo: 'SOLAPAMIENTO' | 'INTERVALO_15MIN'; separacion: number } | null {
  if (s1 < e2 && s2 < e1) {
    return { tipo: 'SOLAPAMIENTO', separacion: 0 };
  }
  if (bufferMin > 0 && s1 < e2 + bufferMin && s2 < e1 + bufferMin) {
    const gap = Math.max(s1 - e2, s2 - e1);
    return { tipo: 'INTERVALO_15MIN', separacion: Math.max(0, gap) };
  }
  return null;
}

interface SolicitudEvaluacion {
  docenteCodigo: string;
  curso: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  aula?: string;
  bufferMinutos?: number;
  ignorarReprogramacionId?: number;
}

function evaluarReprogramacion(input: SolicitudEvaluacion): ResultadoValidacion {
  const docenteCodigo = (input.docenteCodigo || '').trim().toUpperCase();
  const curso = (input.curso || '').trim();
  const fecha = (input.fecha || '').trim();
  const horaInicio = normalizarHora(input.horaInicio || '');
  const horaFin = normalizarHora(input.horaFin || '');
  const aulaCodigo = (input.aula || '').trim().toUpperCase();
  const bufferMin = Number.isFinite(input.bufferMinutos) ? Math.max(0, Number(input.bufferMinutos)) : 15;

  const sNew = horaAMinutos(horaInicio);
  const eNew = horaAMinutos(horaFin);
  const diaSemana = fechaADiaSemana(fecha);
  const hoy = hoyIso();
  const limitePeriodo = sumarDiasIso(hoy, 180);

  const reglas: ReglaEvaluada[] = [];
  const conflictosDocente: ConflictoDetalle[] = [];
  const conflictosAula: ConflictoDetalle[] = [];
  const estudiantesAfectados: ConflictoDetalle[] = [];

  // 1. Regla: Rango horario válido (horaFin > horaInicio, >= 30 min, 07:00 - 22:30)
  const rangoValido =
    sNew >= 0 && eNew >= 0 && eNew > sNew && eNew - sNew >= 30 && sNew >= 7 * 60 && eNew <= 22 * 60 + 30;
  if (sNew < 0 || eNew < 0) {
    reglas.push({
      id: 'rangoHorario',
      titulo: 'Hora de fin posterior a inicio',
      estado: 'error',
      detalle: 'Ingresa una hora de inicio y hora de fin válidas (formato HH:MM).',
    });
  } else if (eNew <= sNew) {
    reglas.push({
      id: 'rangoHorario',
      titulo: 'Hora de fin posterior a inicio',
      estado: 'error',
      detalle: `La hora de fin (${horaFin}) debe ser posterior a la hora de inicio (${horaInicio}).`,
    });
  } else if (eNew - sNew < 30) {
    reglas.push({
      id: 'rangoHorario',
      titulo: 'Hora de fin posterior a inicio',
      estado: 'error',
      detalle: `La duración (${eNew - sNew} min) debe ser de al menos 30 minutos.`,
    });
  } else if (sNew < 7 * 60 || eNew > 22 * 60 + 30) {
    reglas.push({
      id: 'rangoHorario',
      titulo: 'Hora de fin posterior a inicio',
      estado: 'error',
      detalle: 'La franja académica permitida es de 07:00 a 22:30.',
    });
  } else {
    reglas.push({
      id: 'rangoHorario',
      titulo: 'Hora de fin posterior a inicio',
      estado: 'ok',
      detalle: `Franja válida de ${horaInicio} a ${horaFin} (${eNew - sNew} min).`,
    });
  }

  // 2. Regla: Fecha con anticipación y dentro del periodo vigente
  let fechaValida = false;
  if (!diaSemana) {
    reglas.push({
      id: 'fechaVigente',
      titulo: 'Fecha vigente con anticipación',
      estado: 'error',
      detalle: 'Selecciona una fecha válida en formato AAAA-MM-DD.',
    });
  } else if (fecha < hoy) {
    reglas.push({
      id: 'fechaVigente',
      titulo: 'Fecha vigente con anticipación',
      estado: 'error',
      detalle: `La fecha ${fecha} es anterior a hoy (${hoy}). No se permiten fechas pasadas.`,
    });
  } else if (fecha > limitePeriodo) {
    reglas.push({
      id: 'fechaVigente',
      titulo: 'Fecha vigente con anticipación',
      estado: 'error',
      detalle: `La fecha ${fecha} excede el periodo académico vigente (hasta ${limitePeriodo}).`,
    });
  } else {
    fechaValida = true;
    reglas.push({
      id: 'fechaVigente',
      titulo: 'Fecha vigente con anticipación',
      estado: 'ok',
      detalle: `${DIAS_LABEL_ES[diaSemana]} ${fecha} dentro del periodo vigente.`,
    });
  }

  const reprogsActivasMismaFecha = diaSemana
    ? reprogramacionesList.filter(
        (r) =>
          r.estado !== 'RECHAZADO' &&
          r.fecha === fecha &&
          (input.ignorarReprogramacionId == null || r.id !== input.ignorarReprogramacionId)
      )
    : [];

  // 3. Regla: Disponibilidad del docente (regular + reprogramaciones activas)
  if (rangoValido && diaSemana && docenteCodigo) {
    const regularesDocente = (horariosPorDocente.get(docenteCodigo) ?? []).filter((h) => h.dia === diaSemana);
    for (const h of regularesDocente) {
      const overlap = detectarTipoSolapamiento(
        horaAMinutos(h.horaInicio),
        horaAMinutos(h.horaFin),
        sNew,
        eNew,
        bufferMin
      );
      if (overlap) {
        conflictosDocente.push({
          tipo: 'DOCENTE',
          severidad: overlap.tipo,
          entidadCodigo: docenteCodigo,
          entidadNombre: nombreDocente(docenteCodigo),
          cursoConflicto: h.curso,
          horaInicio: h.horaInicio,
          horaFin: h.horaFin,
          origen: 'HORARIO_REGULAR',
          minutosSeparacion: overlap.separacion,
          mensaje:
            overlap.tipo === 'SOLAPAMIENTO'
              ? `El docente ${docenteCodigo} dicta "${h.curso}" (${h.horaInicio}–${h.horaFin}) en horario regular.`
              : `Solo hay ${overlap.separacion} min de separación con "${h.curso}" (${h.horaInicio}–${h.horaFin}); se requieren ${bufferMin} min.`,
        });
      }
    }

    for (const r of reprogsActivasMismaFecha) {
      if (r.docenteCodigo !== docenteCodigo) continue;
      const overlap = detectarTipoSolapamiento(
        horaAMinutos(r.horaInicio),
        horaAMinutos(r.horaFin),
        sNew,
        eNew,
        bufferMin
      );
      if (overlap) {
        conflictosDocente.push({
          tipo: 'DOCENTE',
          severidad: overlap.tipo,
          entidadCodigo: docenteCodigo,
          entidadNombre: nombreDocente(docenteCodigo),
          cursoConflicto: r.curso,
          horaInicio: r.horaInicio,
          horaFin: r.horaFin,
          origen: 'REPROGRAMACION',
          minutosSeparacion: overlap.separacion,
          mensaje:
            overlap.tipo === 'SOLAPAMIENTO'
              ? `El docente ${docenteCodigo} ya tiene una reprogramación (${r.codigoSolicitud}) de "${r.curso}" de ${r.horaInicio} a ${r.horaFin}.`
              : `Separación de ${overlap.separacion} min respecto a reprogramación ${r.codigoSolicitud} (${r.horaInicio}–${r.horaFin}).`,
        });
      }
    }
  }

  const conflictosDocenteDirectos = conflictosDocente.filter((c) => c.severidad === 'SOLAPAMIENTO');
  if (!docenteCodigo) {
    reglas.push({
      id: 'cruceDocente',
      titulo: 'Sin cruce de docente',
      estado: 'error',
      detalle: 'Selecciona un docente titular.',
    });
  } else if (conflictosDocenteDirectos.length > 0) {
    reglas.push({
      id: 'cruceDocente',
      titulo: 'Sin cruce de docente',
      estado: 'error',
      detalle: conflictosDocenteDirectos[0].mensaje,
    });
  } else if (conflictosDocente.length > 0) {
    reglas.push({
      id: 'cruceDocente',
      titulo: 'Sin cruce de docente',
      estado: 'error',
      detalle: conflictosDocente[0].mensaje,
    });
  } else {
    reglas.push({
      id: 'cruceDocente',
      titulo: 'Sin cruce de docente',
      estado: 'ok',
      detalle: `${nombreDocente(docenteCodigo)} disponible en esta franja.`,
    });
  }

  // 4. Evaluar estudiantes matriculados en el curso (O(E) usando índices precalculados)
  const inscritosSet = curso ? estudiantesPorCurso.get(curso.toLowerCase()) ?? new Set<string>() : new Set<string>();
  const totalEstudiantes = inscritosSet.size;
  let conCruceDirecto = 0;
  let conCruceIntervalo = 0;

  if (rangoValido && diaSemana && totalEstudiantes > 0) {
    for (const estCodigo of inscritosSet) {
      const cursosEst = cursosPorEstudiante.get(estCodigo);
      if (!cursosEst) continue;

      let mejorConflictoEst: ConflictoDetalle | null = null;

      for (const otroCurso of cursosEst) {
        const horariosOtro = (horariosPorCurso.get(otroCurso.toLowerCase()) ?? []).filter(
          (h) => h.dia === diaSemana
        );
        for (const h of horariosOtro) {
          const overlap = detectarTipoSolapamiento(
            horaAMinutos(h.horaInicio),
            horaAMinutos(h.horaFin),
            sNew,
            eNew,
            bufferMin
          );
          if (overlap) {
            const detalle: ConflictoDetalle = {
              tipo: 'ESTUDIANTE',
              severidad: overlap.tipo,
              entidadCodigo: estCodigo,
              entidadNombre: nombreEstudiante(estCodigo),
              cursoConflicto: h.curso,
              horaInicio: h.horaInicio,
              horaFin: h.horaFin,
              origen: 'HORARIO_REGULAR',
              minutosSeparacion: overlap.separacion,
              mensaje:
                overlap.tipo === 'SOLAPAMIENTO'
                  ? `Estudiante ${estCodigo} tiene "${h.curso}" (${h.horaInicio}–${h.horaFin}).`
                  : `Estudiante ${estCodigo} tiene "${h.curso}" (${h.horaInicio}–${h.horaFin}) con solo ${overlap.separacion} min de traslado.`,
            };
            if (!mejorConflictoEst || (mejorConflictoEst.severidad !== 'SOLAPAMIENTO' && detalle.severidad === 'SOLAPAMIENTO')) {
              mejorConflictoEst = detalle;
            }
          }
        }

        for (const r of reprogsActivasMismaFecha) {
          if (r.curso.toLowerCase() !== otroCurso.toLowerCase()) continue;
          const overlap = detectarTipoSolapamiento(
            horaAMinutos(r.horaInicio),
            horaAMinutos(r.horaFin),
            sNew,
            eNew,
            bufferMin
          );
          if (overlap) {
            const detalle: ConflictoDetalle = {
              tipo: 'ESTUDIANTE',
              severidad: overlap.tipo,
              entidadCodigo: estCodigo,
              entidadNombre: nombreEstudiante(estCodigo),
              cursoConflicto: r.curso,
              horaInicio: r.horaInicio,
              horaFin: r.horaFin,
              origen: 'REPROGRAMACION',
              minutosSeparacion: overlap.separacion,
              mensaje:
                overlap.tipo === 'SOLAPAMIENTO'
                  ? `Estudiante ${estCodigo} tiene reprogramación de "${r.curso}" (${r.horaInicio}–${r.horaFin}).`
                  : `Estudiante ${estCodigo} tiene solo ${overlap.separacion} min respecto a reprogramación de "${r.curso}".`,
            };
            if (!mejorConflictoEst || (mejorConflictoEst.severidad !== 'SOLAPAMIENTO' && detalle.severidad === 'SOLAPAMIENTO')) {
              mejorConflictoEst = detalle;
            }
          }
        }
      }

      if (mejorConflictoEst) {
        estudiantesAfectados.push(mejorConflictoEst);
        if (mejorConflictoEst.severidad === 'SOLAPAMIENTO') conCruceDirecto++;
        else conCruceIntervalo++;
      }
    }
  }

  const conCruce = estudiantesAfectados.length;
  const disponibles = Math.max(0, totalEstudiantes - conCruce);
  const porcentajeAsistencia =
    totalEstudiantes === 0 ? 100 : Math.round((disponibles * 1000) / totalEstudiantes) / 10;

  // 5. Regla: Aula disponible y aforo suficiente
  const aulaInfo = aulaCodigo ? aulasMap.get(aulaCodigo) ?? null : null;
  if (aulaCodigo && rangoValido && diaSemana) {
    const horariosAula = (horariosPorAula.get(aulaCodigo) ?? []).filter((h) => h.dia === diaSemana);
    for (const h of horariosAula) {
      const overlap = detectarTipoSolapamiento(
        horaAMinutos(h.horaInicio),
        horaAMinutos(h.horaFin),
        sNew,
        eNew,
        bufferMin
      );
      if (overlap) {
        conflictosAula.push({
          tipo: 'AULA',
          severidad: overlap.tipo,
          entidadCodigo: aulaCodigo,
          cursoConflicto: h.curso,
          horaInicio: h.horaInicio,
          horaFin: h.horaFin,
          origen: 'HORARIO_REGULAR',
          minutosSeparacion: overlap.separacion,
          mensaje:
            overlap.tipo === 'SOLAPAMIENTO'
              ? `El aula ${aulaCodigo} está ocupada por "${h.curso}" (${h.horaInicio}–${h.horaFin}).`
              : `El aula ${aulaCodigo} se desocupa/ocupa con "${h.curso}" (${h.horaInicio}–${h.horaFin}) dejando solo ${overlap.separacion} min.`,
        });
      }
    }

    for (const r of reprogsActivasMismaFecha) {
      if ((r.aula || '').toUpperCase() !== aulaCodigo) continue;
      const overlap = detectarTipoSolapamiento(
        horaAMinutos(r.horaInicio),
        horaAMinutos(r.horaFin),
        sNew,
        eNew,
        bufferMin
      );
      if (overlap) {
        conflictosAula.push({
          tipo: 'AULA',
          severidad: overlap.tipo,
          entidadCodigo: aulaCodigo,
          cursoConflicto: r.curso,
          horaInicio: r.horaInicio,
          horaFin: r.horaFin,
          origen: 'REPROGRAMACION',
          minutosSeparacion: overlap.separacion,
          mensaje: `El aula ${aulaCodigo} ya está reservada por ${r.codigoSolicitud} (${r.horaInicio}–${r.horaFin}).`,
        });
      }
    }

    if (aulaInfo && totalEstudiantes > aulaInfo.aforo) {
      conflictosAula.push({
        tipo: 'AULA',
        severidad: 'AFORO',
        entidadCodigo: aulaCodigo,
        cursoConflicto: curso,
        horaInicio,
        horaFin,
        origen: 'AFORO',
        mensaje: `El aula ${aulaCodigo} tiene aforo de ${aulaInfo.aforo} asientos, insuficiente para los ${totalEstudiantes} estudiantes matriculados.`,
      });
    }
  }

  // Regla explícita de intervalo mínimo de 15 min
  const violacionesIntervalo = [
    ...conflictosDocente.filter((c) => c.severidad === 'INTERVALO_15MIN'),
    ...estudiantesAfectados.filter((c) => c.severidad === 'INTERVALO_15MIN'),
    ...conflictosAula.filter((c) => c.severidad === 'INTERVALO_15MIN'),
  ];

  if (bufferMin === 0) {
    reglas.push({
      id: 'intervaloMinimo',
      titulo: 'Intervalo mínimo de 15 min entre clases',
      estado: 'warning',
      detalle: 'Margen de traslado desactivado (0 min) para simulación.',
    });
  } else if (violacionesIntervalo.length > 0) {
    reglas.push({
      id: 'intervaloMinimo',
      titulo: `Intervalo mínimo de ${bufferMin} min entre clases`,
      estado: 'error',
      detalle: `${violacionesIntervalo.length} conflicto(s) por traslado menor a ${bufferMin} min (${violacionesIntervalo[0].mensaje})`,
    });
  } else {
    reglas.push({
      id: 'intervaloMinimo',
      titulo: `Intervalo mínimo de ${bufferMin} min entre clases`,
      estado: 'ok',
      detalle: `Se respeta la separación mínima de ${bufferMin} min en todos los bloques adyacentes.`,
    });
  }

  // Regla de estudiantes
  if (!curso) {
    reglas.push({
      id: 'cruceEstudiantes',
      titulo: 'Disponibilidad de estudiantes matriculados',
      estado: 'error',
      detalle: 'Selecciona un curso para verificar a sus estudiantes matriculados.',
    });
  } else if (conCruce > 0) {
    reglas.push({
      id: 'cruceEstudiantes',
      titulo: 'Disponibilidad de estudiantes matriculados',
      estado: 'error',
      detalle: `${conCruce} de ${totalEstudiantes} estudiantes presentan cruce (${porcentajeAsistencia}% disponibles).`,
    });
  } else {
    reglas.push({
      id: 'cruceEstudiantes',
      titulo: 'Disponibilidad de estudiantes matriculados',
      estado: 'ok',
      detalle:
        totalEstudiantes === 0
          ? 'Sin estudiantes matriculados registrados en este curso.'
          : `${totalEstudiantes} de ${totalEstudiantes} estudiantes disponibles (100% asistencia presencial).`,
    });
  }

  // Regla de aula y aforo
  if (!aulaCodigo) {
    reglas.push({
      id: 'aulaYAforo',
      titulo: 'Disponibilidad y aforo de aula',
      estado: 'error',
      detalle: 'Selecciona un aula del catálogo para reservar y validar su aforo.',
    });
  } else if (!aulaInfo) {
    reglas.push({
      id: 'aulaYAforo',
      titulo: 'Disponibilidad y aforo de aula',
      estado: 'error',
      detalle: `El aula "${aulaCodigo}" no existe en el catálogo de aulas.`,
    });
  } else if (conflictosAula.length > 0) {
    reglas.push({
      id: 'aulaYAforo',
      titulo: 'Disponibilidad y aforo de aula',
      estado: 'error',
      detalle: conflictosAula[0].mensaje,
    });
  } else {
    reglas.push({
      id: 'aulaYAforo',
      titulo: 'Disponibilidad y aforo de aula',
      estado: 'ok',
      detalle: `Aula ${aulaInfo.codigo} (Pab. ${aulaInfo.pabellon}, aforo ${aulaInfo.aforo}) libre y suficiente para ${totalEstudiantes} inscritos.`,
    });
  }

  const valido =
    rangoValido &&
    fechaValida &&
    Boolean(docenteCodigo) &&
    Boolean(curso) &&
    Boolean(aulaInfo) &&
    conflictosDocente.length === 0 &&
    estudiantesAfectados.length === 0 &&
    conflictosAula.length === 0;

  let resumen = 'Reprogramación viable: cumple las 6 reglas sin cruces.';
  if (!valido) {
    const primeraFalla = reglas.find((r) => r.estado === 'error');
    resumen = primeraFalla ? primeraFalla.detalle : 'Existen conflictos que impiden la reprogramación.';
  }

  const disponibilidad: DisponibilidadPresencial = {
    totalEstudiantes,
    disponibles,
    conCruce,
    conCruceDirecto,
    conCruceIntervalo,
    porcentajeAsistencia,
    estudiantesAfectados: estudiantesAfectados.slice(0, 50),
  };

  return {
    valido,
    resumen,
    bufferMinutos: bufferMin,
    diaSemana,
    reglas,
    conflictosDocente,
    conflictosAula,
    disponibilidad,
    aulaInfo,
  };
}

function sugerirFranjasLibres(params: {
  docenteCodigo: string;
  curso: string;
  fechaBase: string;
  duracionMin: number;
  bufferMinutos: number;
}): FranjaSugerida[] {
  const docenteCodigo = (params.docenteCodigo || '').trim().toUpperCase();
  const curso = (params.curso || '').trim();
  const hoy = hoyIso();
  const base = params.fechaBase && params.fechaBase >= hoy ? params.fechaBase : hoy;
  const duracion = Math.max(60, Math.min(240, params.duracionMin || 120));
  const bufferMin = Number.isFinite(params.bufferMinutos) ? Math.max(0, params.bufferMinutos) : 15;
  const totalInscritos = estudiantesPorCurso.get(curso.toLowerCase())?.size ?? 0;

  // Candidate classrooms sorted by capacity closest-above enrolled students
  const aulasCandidatas = Array.from(aulasMap.values())
    .filter((a) => a.aforo >= totalInscritos)
    .sort((a, b) => a.aforo - b.aforo);

  const sugerencias: FranjaSugerida[] = [];

  for (let offset = 0; offset < 6; offset++) {
    const fecha = sumarDiasIso(base, offset);
    const dia = fechaADiaSemana(fecha);
    if (!dia || dia === 'SUNDAY') continue;

    // Candidate blocks every 30 min from 07:30 to 20:00
    for (let startMin = 7 * 60 + 30; startMin + duracion <= 22 * 60; startMin += 60) {
      const hi = minutosAHora(startMin);
      const hf = minutosAHora(startMin + duracion);

      // Quick check without aula first
      const evalSlot = evaluarReprogramacion({
        docenteCodigo,
        curso,
        fecha,
        horaInicio: hi,
        horaFin: hf,
        bufferMinutos: bufferMin,
      });

      if (evalSlot.conflictosDocente.length > 0) continue;

      // Find up to 3 free classrooms for this slot
      const reprogsMismaFecha = reprogramacionesList.filter(
        (r) => r.estado !== 'RECHAZADO' && r.fecha === fecha
      );

      const libres: Aula[] = [];
      for (const aula of aulasCandidatas) {
        const regAula = (horariosPorAula.get(aula.codigo) ?? []).filter((h) => h.dia === dia);
        const chocReg = regAula.some(
          (h) =>
            detectarTipoSolapamiento(
              horaAMinutos(h.horaInicio),
              horaAMinutos(h.horaFin),
              startMin,
              startMin + duracion,
              bufferMin
            ) !== null
        );
        if (chocReg) continue;

        const chocRep = reprogsMismaFecha.some(
          (r) =>
            (r.aula || '').toUpperCase() === aula.codigo &&
            detectarTipoSolapamiento(
              horaAMinutos(r.horaInicio),
              horaAMinutos(r.horaFin),
              startMin,
              startMin + duracion,
              bufferMin
            ) !== null
        );
        if (chocRep) continue;

        libres.push(aula);
        if (libres.length >= 3) break;
      }

      if (libres.length === 0) continue;

      sugerencias.push({
        fecha,
        diaSemana: dia,
        horaInicio: hi,
        horaFin: hf,
        porcentajeAsistencia: evalSlot.disponibilidad.porcentajeAsistencia,
        disponibles: evalSlot.disponibilidad.disponibles,
        totalEstudiantes: evalSlot.disponibilidad.totalEstudiantes,
        aulasLibres: libres,
      });
    }
  }

  return sugerencias
    .sort((a, b) => {
      if (b.porcentajeAsistencia !== a.porcentajeAsistencia) {
        return b.porcentajeAsistencia - a.porcentajeAsistencia;
      }
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
      return a.horaInicio.localeCompare(b.horaInicio);
    })
    .slice(0, 8);
}

cargarDatosIniciales();

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  // --- API Routes ---
  app.get('/api/resumen', (_req, res) => {
    const cursosSet = new Set(horariosList.map((h) => h.curso));
    const sedesSet = new Set(Array.from(aulasMap.values()).map((a) => a.sede));
    const resumen: ResumenSistema = {
      totalDocentes: docentesMap.size,
      totalEstudiantes: estudiantesMap.size,
      totalHorarios: horariosList.length,
      totalMatriculas: matriculasList.length,
      totalAulas: aulasMap.size,
      reprogramacionesSolicitadas: reprogramacionesList.filter((r) => r.estado === 'SOLICITADO').length,
      reprogramacionesConfirmadas: reprogramacionesList.filter((r) => r.estado === 'CONFIRMADO').length,
      reprogramacionesRechazadas: reprogramacionesList.filter((r) => r.estado === 'RECHAZADO').length,
      cursosUnicos: Array.from(cursosSet).sort((a, b) => a.localeCompare(b, 'es')),
      sedes: Array.from(sedesSet).sort(),
    };
    res.json(resumen);
  });

  app.get('/api/docentes', (_req, res) => {
    const lista: Docente[] = Array.from(docentesMap.values()).map((d) => {
      const hs = horariosPorDocente.get(d.codigo) ?? [];
      const cursos = new Set(hs.map((h) => h.curso));
      const minutos = hs.reduce(
        (acc, h) => acc + Math.max(0, horaAMinutos(h.horaFin) - horaAMinutos(h.horaInicio)),
        0
      );
      return {
        ...d,
        cursosCount: cursos.size,
        horasSemanales: Math.round((minutos / 60) * 10) / 10,
      };
    });
    res.json(lista);
  });

  app.post('/api/docentes', (req, res) => {
    const codigo = String(req.body?.codigo || '').trim().toUpperCase();
    const nombres = String(req.body?.nombres || '').trim();
    const apellidos = String(req.body?.apellidos || '').trim();
    if (!codigo || !nombres || !apellidos) {
      res.status(400).json({ error: 'Código, nombres y apellidos son obligatorios.' });
      return;
    }
    if (docentesMap.has(codigo)) {
      res.status(409).json({ error: `Ya existe un docente con código ${codigo}.` });
      return;
    }
    const nuevo: Docente = { codigo, nombres, apellidos };
    docentesMap.set(codigo, nuevo);
    res.status(201).json(nuevo);
  });

  app.get('/api/estudiantes', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 60));
    let lista = Array.from(estudiantesMap.values());
    if (q) {
      lista = lista.filter(
        (e) =>
          e.codigo.toLowerCase().includes(q) ||
          `${e.nombres} ${e.apellidos}`.toLowerCase().includes(q)
      );
    }
    const total = lista.length;
    const items = lista.slice(0, limit).map((e) => ({
      ...e,
      cursos: Array.from(cursosPorEstudiante.get(e.codigo) ?? []),
    }));
    res.json({ total, items });
  });

  app.post('/api/estudiantes', (req, res) => {
    const codigo = String(req.body?.codigo || '').trim().toUpperCase();
    const nombres = String(req.body?.nombres || '').trim();
    const apellidos = String(req.body?.apellidos || '').trim();
    if (!codigo || !nombres || !apellidos) {
      res.status(400).json({ error: 'Código, nombres y apellidos son obligatorios.' });
      return;
    }
    if (estudiantesMap.has(codigo)) {
      res.status(409).json({ error: `Ya existe un estudiante con código ${codigo}.` });
      return;
    }
    const nuevo: Estudiante = { codigo, nombres, apellidos };
    estudiantesMap.set(codigo, nuevo);
    res.status(201).json({ ...nuevo, cursos: [] });
  });

  app.get('/api/aulas', (req, res) => {
    const minAforo = Number(req.query.minAforo) || 0;
    const pabellon = String(req.query.pabellon || '').trim().toUpperCase();
    let lista = Array.from(aulasMap.values());
    if (minAforo > 0) lista = lista.filter((a) => a.aforo >= minAforo);
    if (pabellon) lista = lista.filter((a) => a.pabellon.toUpperCase() === pabellon);
    lista.sort((a, b) => a.codigo.localeCompare(b.codigo));
    res.json(lista);
  });

  app.get('/api/horarios', (req, res) => {
    const docente = String(req.query.docente || '').trim().toUpperCase();
    const estudiante = String(req.query.estudiante || '').trim().toUpperCase();
    const aula = String(req.query.aula || '').trim().toUpperCase();
    const curso = String(req.query.curso || '').trim().toLowerCase();

    if (estudiante) {
      const cursosEst = cursosPorEstudiante.get(estudiante);
      if (!cursosEst || cursosEst.size === 0) {
        res.json([]);
        return;
      }
      const resultado: Horario[] = [];
      for (const c of cursosEst) {
        for (const h of horariosPorCurso.get(c.toLowerCase()) ?? []) {
          resultado.push(enriquecerHorario(h));
        }
      }
      res.json(resultado);
      return;
    }

    let lista = horariosList;
    if (docente) lista = horariosPorDocente.get(docente) ?? [];
    if (aula) lista = lista.filter((h) => h.aula.toUpperCase() === aula);
    if (curso) lista = lista.filter((h) => h.curso.toLowerCase() === curso);
    res.json(lista.map(enriquecerHorario));
  });

  app.post('/api/horarios', (req, res) => {
    const docenteCodigo = String(req.body?.docenteCodigo || '').trim().toUpperCase();
    const curso = String(req.body?.curso || '').trim();
    const dia = String(req.body?.dia || '').trim().toUpperCase() as DiaSemana;
    const horaInicio = normalizarHora(String(req.body?.horaInicio || ''));
    const horaFin = normalizarHora(String(req.body?.horaFin || ''));
    const aula = String(req.body?.aula || '').trim().toUpperCase();

    if (!docenteCodigo || !curso || !DIAS_JS.includes(dia) || !horaInicio || !horaFin || !aula) {
      res.status(400).json({ error: 'Todos los campos del horario son obligatorios.' });
      return;
    }
    const s = horaAMinutos(horaInicio);
    const e = horaAMinutos(horaFin);
    if (e <= s) {
      res.status(400).json({ error: 'La hora de fin debe ser posterior a la hora de inicio.' });
      return;
    }

    const cruceDoc = (horariosPorDocente.get(docenteCodigo) ?? []).find(
      (h) =>
        h.dia === dia &&
        detectarTipoSolapamiento(horaAMinutos(h.horaInicio), horaAMinutos(h.horaFin), s, e, 15) !== null
    );
    if (cruceDoc) {
      res.status(400).json({
        error: `Conflicto docente con "${cruceDoc.curso}" (${cruceDoc.horaInicio}–${cruceDoc.horaFin}) respetando 15 min de traslado.`,
      });
      return;
    }

    const cruceAula = (horariosPorAula.get(aula) ?? []).find(
      (h) =>
        h.dia === dia &&
        detectarTipoSolapamiento(horaAMinutos(h.horaInicio), horaAMinutos(h.horaFin), s, e, 15) !== null
    );
    if (cruceAula) {
      res.status(400).json({
        error: `El aula ${aula} ya está ocupada por "${cruceAula.curso}" (${cruceAula.horaInicio}–${cruceAula.horaFin}).`,
      });
      return;
    }

    const nuevo: Horario = {
      id: nextHorarioId++,
      docenteCodigo,
      curso,
      dia,
      horaInicio,
      horaFin,
      aula,
    };
    horariosList.push(nuevo);
    reconstruirIndices();
    res.status(201).json(enriquecerHorario(nuevo));
  });

  app.post('/api/matriculas', (req, res) => {
    const estudianteCodigo = String(req.body?.estudianteCodigo || '').trim().toUpperCase();
    const curso = String(req.body?.curso || '').trim();
    if (!estudianteCodigo || !curso) {
      res.status(400).json({ error: 'Código de estudiante y curso son obligatorios.' });
      return;
    }
    if (!estudiantesMap.has(estudianteCodigo)) {
      res.status(404).json({ error: `No existe el estudiante ${estudianteCodigo}.` });
      return;
    }
    const yaExiste = matriculasList.some(
      (m) => m.estudianteCodigo === estudianteCodigo && m.curso.toLowerCase() === curso.toLowerCase()
    );
    if (yaExiste) {
      res.status(409).json({ error: `El estudiante ${estudianteCodigo} ya está matriculado en "${curso}".` });
      return;
    }
    const nueva: Matricula = {
      id: nextMatriculaId++,
      estudianteCodigo,
      curso,
    };
    matriculasList.push(nueva);
    reconstruirIndices();
    res.status(201).json(nueva);
  });

  app.get('/api/reprogramaciones', (_req, res) => {
    const ordenadas = [...reprogramacionesList]
      .sort((a, b) => b.id - a.id)
      .map(enriquecerReprogramacion);
    res.json(ordenadas);
  });

  app.post('/api/reprogramaciones/validar', (req, res) => {
    const resultado = evaluarReprogramacion({
      docenteCodigo: req.body?.docenteCodigo,
      curso: req.body?.curso,
      fecha: req.body?.fecha,
      horaInicio: req.body?.horaInicio,
      horaFin: req.body?.horaFin,
      aula: req.body?.aula,
      bufferMinutos: req.body?.bufferMinutos ?? 15,
    });
    res.json(resultado);
  });

  app.post('/api/reprogramaciones/sugerir-franjas', (req, res) => {
    const docenteCodigo = String(req.body?.docenteCodigo || '').trim().toUpperCase();
    const curso = String(req.body?.curso || '').trim();
    const fechaBase = String(req.body?.fecha || hoyIso()).trim();
    const duracionMin = Number(req.body?.duracionMin) || 120;
    const bufferMinutos = req.body?.bufferMinutos ?? 15;

    if (!docenteCodigo || !curso) {
      res.status(400).json({ error: 'Selecciona un docente y un curso para buscar franjas libres.' });
      return;
    }

    const franjas = sugerirFranjasLibres({
      docenteCodigo,
      curso,
      fechaBase,
      duracionMin,
      bufferMinutos,
    });
    res.json({ franjas });
  });

  app.post('/api/reprogramaciones', (req, res) => {
    const bufferMinutos = req.body?.bufferMinutos ?? 15;
    const validacion = evaluarReprogramacion({
      docenteCodigo: req.body?.docenteCodigo,
      curso: req.body?.curso,
      fecha: req.body?.fecha,
      horaInicio: req.body?.horaInicio,
      horaFin: req.body?.horaFin,
      aula: req.body?.aula,
      bufferMinutos,
    });

    if (!validacion.valido) {
      res.status(400).json({
        error: validacion.resumen,
        validacion,
      });
      return;
    }

    const id = nextReprogramacionId++;
    const nueva: Reprogramacion = {
      id,
      codigoSolicitud: `REP-2026-${String(id).padStart(3, '0')}`,
      docenteCodigo: String(req.body.docenteCodigo).trim().toUpperCase(),
      curso: String(req.body.curso).trim(),
      fecha: String(req.body.fecha).trim(),
      horaInicio: normalizarHora(String(req.body.horaInicio)),
      horaFin: normalizarHora(String(req.body.horaFin)),
      aula: String(req.body.aula).trim().toUpperCase(),
      motivo: String(req.body.motivo || '').trim() || 'Recuperación académica programada',
      estado: 'SOLICITADO',
      fechaRegistro: new Date().toISOString(),
      porcentajeAsistencia: validacion.disponibilidad.porcentajeAsistencia,
      totalEstudiantes: validacion.disponibilidad.totalEstudiantes,
      disponibles: validacion.disponibilidad.disponibles,
    };

    reprogramacionesList.push(nueva);
    res.status(201).json({
      reprogramacion: enriquecerReprogramacion(nueva),
      validacion,
    });
  });

  app.put('/api/reprogramaciones/:id/estado', (req, res) => {
    const id = Number(req.params.id);
    const estado = String(req.body?.estado || '').toUpperCase() as EstadoReprogramacion;
    if (!['SOLICITADO', 'CONFIRMADO', 'RECHAZADO'].includes(estado)) {
      res.status(400).json({ error: 'Estado inválido.' });
      return;
    }
    const target = reprogramacionesList.find((r) => r.id === id);
    if (!target) {
      res.status(404).json({ error: 'Reprogramación no encontrada.' });
      return;
    }
    target.estado = estado;
    res.json(enriquecerReprogramacion(target));
  });

  app.delete('/api/reprogramaciones/:id', (req, res) => {
    const id = Number(req.params.id);
    const idx = reprogramacionesList.findIndex((r) => r.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Reprogramación no encontrada.' });
      return;
    }
    reprogramacionesList.splice(idx, 1);
    res.status(204).end();
  });

  // --- Vite / Static Frontend Serving ---
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Servidor Cruce de Horarios activo en http://localhost:${PORT} (${docentesMap.size} docentes, ${horariosList.length} horarios, ${estudiantesMap.size} estudiantes, ${aulasMap.size} aulas)`
    );
  });
}

startServer();
