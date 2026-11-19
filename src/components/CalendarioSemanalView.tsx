import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  MapPin,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  DIAS_CORTO,
  DIAS_ES,
  fechaADiaSemana,
  formatearFechaCorta,
  horaAMinutos,
} from '../lib/time';
import type {
  Aula,
  DiaSemana,
  Docente,
  Estudiante,
  Horario,
  Reprogramacion,
} from '../types/academic';

export type ModoCalendario = 'docente' | 'estudiante' | 'aula';

interface CalendarioSemanalViewProps {
  docentes: Docente[];
  aulas: Aula[];
  reprogramaciones: Reprogramacion[];
  modoInicial?: ModoCalendario;
  entidadInicial?: string;
  onIrAReprogramar: (preset: {
    docenteCodigo: string;
    curso: string;
    aula: string;
    horaInicio: string;
    horaFin: string;
  }) => void;
}

const DIAS_SEMANA_COMPLETA: DiaSemana[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const MESES_CORTO = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const HORA_INICIO_GRID = 7; // 07:00
const HORA_FIN_GRID = 22; // 22:00
const PIXELES_POR_HORA = 62;
const HORAS_MARCA = Array.from(
  { length: HORA_FIN_GRID - HORA_INICIO_GRID + 1 },
  (_, i) => HORA_INICIO_GRID + i
);

interface BloqueVisual {
  key: string;
  tipo: 'REGULAR' | 'REPROGRAMACION';
  dia: DiaSemana;
  curso: string;
  docenteCodigo: string;
  docenteNombre: string;
  horaInicio: string;
  horaFin: string;
  aula: string;
  inscritos?: number;
  fecha?: string;
  estado?: string;
  codigoSolicitud?: string;
}

function inicioSemanaLunes(base: Date): Date {
  const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const day = dt.getDay(); // 0=Dom, 1=Lun...
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return dt;
}

function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function CalendarioSemanalView({
  docentes,
  aulas,
  reprogramaciones,
  modoInicial = 'docente',
  entidadInicial,
  onIrAReprogramar,
}: CalendarioSemanalViewProps) {
  const [modo, setModo] = useState<ModoCalendario>(modoInicial);
  const [docenteSel, setDocenteSel] = useState<string>(
    modoInicial === 'docente' && entidadInicial ? entidadInicial : 'DOC-101'
  );
  const [aulaSel, setAulaSel] = useState<string>(
    modoInicial === 'aula' && entidadInicial ? entidadInicial : 'A101'
  );
  const [estudianteQuery, setEstudianteQuery] = useState<string>('');
  const [estudiantesResultados, setEstudiantesResultados] = useState<Estudiante[]>([]);
  const [estudianteSel, setEstudianteSel] = useState<string>(
    modoInicial === 'estudiante' && entidadInicial ? entidadInicial : 'U23231304'
  );

  const [semanaOffset, setSemanaOffset] = useState<number>(0);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [mostrarReprogs, setMostrarReprogs] = useState<boolean>(true);
  const [bloqueActivo, setBloqueActivo] = useState<BloqueVisual | null>(null);

  useEffect(() => {
    if (entidadInicial) {
      setModo(modoInicial);
      if (modoInicial === 'docente') setDocenteSel(entidadInicial);
      if (modoInicial === 'estudiante') setEstudianteSel(entidadInicial);
      if (modoInicial === 'aula') setAulaSel(entidadInicial);
    }
  }, [modoInicial, entidadInicial]);

  // Calcular los 7 días de la semana visible (estilo UTP+portal: Lun 16 .. Dom 22)
  const semanaInfo = useMemo(() => {
    const hoy = new Date();
    const hoyIso = dateToIso(hoy);
    const lunes = inicioSemanaLunes(hoy);
    lunes.setDate(lunes.getDate() + semanaOffset * 7);

    const dias = DIAS_SEMANA_COMPLETA.map((diaKey, idx) => {
      const d = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + idx);
      const iso = dateToIso(d);
      return {
        diaKey,
        etiqueta: DIAS_CORTO[diaKey],
        numero: d.getDate(),
        iso,
        esHoy: iso === hoyIso,
      };
    });

    const inicio = new Date(lunes);
    const fin = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
    const numSemanaCiclo = Math.max(1, 15 + semanaOffset);
    const rangoTexto = `Sem ${numSemanaCiclo}: ${inicio.getDate()} ${MESES_CORTO[inicio.getMonth()]} - ${fin.getDate()} ${MESES_CORTO[fin.getMonth()]}`;

    return {
      dias,
      rangoTexto,
      isoSet: new Set(dias.map((d) => d.iso)),
    };
  }, [semanaOffset]);

  // Buscar entre los 1,000 estudiantes reales
  useEffect(() => {
    if (modo !== 'estudiante') return;
    let cancelado = false;
    const timer = setTimeout(() => {
      api
        .getEstudiantes(estudianteQuery, 30)
        .then((res) => {
          if (!cancelado) setEstudiantesResultados(res.items);
        })
        .catch(() => {
          if (!cancelado) setEstudiantesResultados([]);
        });
    }, 120);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [modo, estudianteQuery]);

  // Cargar horarios de la entidad activa
  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError('');
    setBloqueActivo(null);

    const query =
      modo === 'docente'
        ? { docente: docenteSel }
        : modo === 'estudiante'
          ? { estudiante: estudianteSel }
          : { aula: aulaSel };

    api
      .getHorarios(query)
      .then((data) => {
        if (!cancelado) {
          setHorarios(data);
          setCargando(false);
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setError(err.message || 'No se pudo cargar el horario.');
          setCargando(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [modo, docenteSel, estudianteSel, aulaSel]);

  const estudianteActual = useMemo(
    () => estudiantesResultados.find((e) => e.codigo === estudianteSel) ?? null,
    [estudiantesResultados, estudianteSel]
  );

  const docenteActual = useMemo(
    () => docentes.find((d) => d.codigo === docenteSel) ?? null,
    [docentes, docenteSel]
  );

  const aulaActual = useMemo(
    () => aulas.find((a) => a.codigo === aulaSel) ?? null,
    [aulas, aulaSel]
  );

  const { bloquesPorDia, reprogsVisibles } = useMemo(() => {
    const mapa: Record<DiaSemana, BloqueVisual[]> = {
      MONDAY: [],
      TUESDAY: [],
      WEDNESDAY: [],
      THURSDAY: [],
      FRIDAY: [],
      SATURDAY: [],
      SUNDAY: [],
    };

    const cursosVisibles = new Set<string>();
    for (const h of horarios) {
      cursosVisibles.add(h.curso.toLowerCase());
      if (mapa[h.dia]) {
        mapa[h.dia].push({
          key: `reg-${h.id}`,
          tipo: 'REGULAR',
          dia: h.dia,
          curso: h.curso,
          docenteCodigo: h.docenteCodigo,
          docenteNombre: h.docenteNombre || h.docenteCodigo,
          horaInicio: h.horaInicio,
          horaFin: h.horaFin,
          aula: h.aula,
          inscritos: h.inscritos,
        });
      }
    }

    const reprogsFiltradas: BloqueVisual[] = [];
    if (mostrarReprogs) {
      for (const r of reprogramaciones) {
        if (r.estado === 'RECHAZADO') continue;
        const aplica =
          (modo === 'docente' && r.docenteCodigo === docenteSel) ||
          (modo === 'aula' && r.aula === aulaSel) ||
          (modo === 'estudiante' && cursosVisibles.has(r.curso.toLowerCase()));
        if (!aplica) continue;

        const dia = fechaADiaSemana(r.fecha);
        if (dia && mapa[dia]) {
          const bloque: BloqueVisual = {
            key: `rep-${r.id}`,
            tipo: 'REPROGRAMACION',
            dia,
            curso: r.curso,
            docenteCodigo: r.docenteCodigo,
            docenteNombre: r.docenteNombre || r.docenteCodigo,
            horaInicio: r.horaInicio,
            horaFin: r.horaFin,
            aula: r.aula,
            inscritos: r.totalEstudiantes,
            fecha: r.fecha,
            estado: r.estado,
            codigoSolicitud: r.codigoSolicitud,
          };
          reprogsFiltradas.push(bloque);
          // Mostrar en grilla si coincide con la semana actual o en vista general
          if (semanaInfo.isoSet.has(r.fecha) || semanaOffset === 0) {
            mapa[dia].push(bloque);
          }
        }
      }
    }

    return { bloquesPorDia: mapa, reprogsVisibles: reprogsFiltradas };
  }, [
    horarios,
    reprogramaciones,
    mostrarReprogs,
    modo,
    docenteSel,
    aulaSel,
    semanaInfo.isoSet,
    semanaOffset,
  ]);

  const totalBloques = useMemo(
    () => DIAS_SEMANA_COMPLETA.reduce((sum, d) => sum + bloquesPorDia[d].length, 0),
    [bloquesPorDia]
  );

  const horasTotales = useMemo(() => {
    const mins = horarios.reduce(
      (sum, h) => sum + Math.max(0, horaAMinutos(h.horaFin) - horaAMinutos(h.horaInicio)),
      0
    );
    return Math.round((mins / 60) * 10) / 10;
  }, [horarios]);

  const posicionBloque = (hi: string, hf: string) => {
    const startMin = Math.max(HORA_INICIO_GRID * 60, horaAMinutos(hi));
    const endMin = Math.min(HORA_FIN_GRID * 60, horaAMinutos(hf));
    const top = ((startMin - HORA_INICIO_GRID * 60) / 60) * PIXELES_POR_HORA;
    const height = Math.max(54, ((endMin - startMin) / 60) * PIXELES_POR_HORA);
    return { top, height };
  };

  return (
    <div className="space-y-4">
      {/* Barra superior estilo UTP+portal: selector de semana, filtro de entidad y botones Hoy < > */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Indicador de semana estilo UTP+portal */}
          <div className="inline-flex items-center gap-2 h-10 px-3.5 rounded-md border border-[#9AA8BE] bg-white/85 text-xs font-medium text-[#161C2D] whitespace-nowrap shrink-0">
            <CalendarDays className="w-4 h-4 text-[#25206E]" />
            <span className="font-mono tabular-nums">{semanaInfo.rangoTexto}</span>
          </div>

          {/* Selector de modo: Docente / Estudiante / Aula */}
          <div className="flex items-center gap-0.5 p-1 bg-white border border-[#DCE6F2] rounded-md">
            <button
              type="button"
              onClick={() => setModo('docente')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                modo === 'docente'
                  ? 'bg-[#5B4AE6] text-white'
                  : 'text-slate-600 hover:text-[#161C2D]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Docente
            </button>
            <button
              type="button"
              onClick={() => setModo('estudiante')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                modo === 'estudiante'
                  ? 'bg-[#5B4AE6] text-white'
                  : 'text-slate-600 hover:text-[#161C2D]'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Estudiante
            </button>
            <button
              type="button"
              onClick={() => setModo('aula')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                modo === 'aula'
                  ? 'bg-[#5B4AE6] text-white'
                  : 'text-slate-600 hover:text-[#161C2D]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Aula
            </button>
          </div>

          {/* Selector de docente / estudiante / aula */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {modo === 'docente' && (
              <select
                aria-label="Seleccionar docente"
                value={docenteSel}
                onChange={(e) => setDocenteSel(e.target.value)}
                className="h-10 px-3 rounded-md border border-[#CBD7E6] bg-white text-xs sm:text-sm text-[#161C2D] focus:outline-none focus:ring-2 focus:ring-[#5B4AE6]/25 focus:border-[#5B4AE6] max-w-xs"
              >
                {docentes.map((d) => (
                  <option key={d.codigo} value={d.codigo}>
                    {d.codigo} — {d.nombres} {d.apellidos}
                  </option>
                ))}
              </select>
            )}

            {modo === 'estudiante' && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={estudianteQuery}
                    onChange={(e) => setEstudianteQuery(e.target.value)}
                    placeholder="Buscar código o alumno..."
                    className="h-10 w-48 pl-8 pr-2.5 rounded-md border border-[#CBD7E6] bg-white text-xs text-[#161C2D] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B4AE6]/25 focus:border-[#5B4AE6]"
                  />
                </div>
                <select
                  aria-label="Seleccionar estudiante"
                  value={estudianteSel}
                  onChange={(e) => setEstudianteSel(e.target.value)}
                  className="h-10 max-w-[230px] px-2.5 rounded-md border border-[#CBD7E6] bg-white text-xs text-[#161C2D] focus:outline-none focus:ring-2 focus:ring-[#5B4AE6]/25 focus:border-[#5B4AE6]"
                >
                  {estudiantesResultados.length === 0 && (
                    <option value={estudianteSel}>{estudianteSel}</option>
                  )}
                  {estudiantesResultados.map((e) => (
                    <option key={e.codigo} value={e.codigo}>
                      {e.codigo} — {e.nombres} {e.apellidos}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {modo === 'aula' && (
              <select
                aria-label="Seleccionar aula"
                value={aulaSel}
                onChange={(e) => setAulaSel(e.target.value)}
                className="h-10 px-3 rounded-md border border-[#CBD7E6] bg-white text-xs sm:text-sm text-[#161C2D] focus:outline-none focus:ring-2 focus:ring-[#5B4AE6]/25 focus:border-[#5B4AE6]"
              >
                {aulas.map((a) => (
                  <option key={a.codigo} value={a.codigo}>
                    {a.codigo} — Pab. {a.pabellon} (Aforo {a.aforo})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Controles de navegación semanal estilo UTP+portal: Hoy  <  > */}
        <div className="flex items-center justify-between xl:justify-end gap-3 shrink-0">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#36415E] cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={mostrarReprogs}
              onChange={(e) => setMostrarReprogs(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-[#A62B6A]"
            />
            Ver reprogramaciones
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSemanaOffset(0)}
              className="h-9 px-4 rounded-md border border-[#25206E] bg-white text-[#25206E] text-xs font-semibold hover:bg-[#EEF3FA] transition-colors cursor-pointer whitespace-nowrap"
            >
              Hoy
            </button>
            <button
              type="button"
              aria-label="Semana anterior"
              onClick={() => setSemanaOffset((s) => s - 1)}
              className="h-9 w-9 rounded-md bg-[#25206E] text-white flex items-center justify-center hover:bg-[#191552] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Semana siguiente"
              onClick={() => setSemanaOffset((s) => s + 1)}
              className="h-9 w-9 rounded-md bg-[#25206E] text-white flex items-center justify-center hover:bg-[#191552] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Línea discreta de contexto y leyenda */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#4B5563]">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {modo === 'docente' && docenteActual && (
            <>
              <span className="font-mono font-semibold text-[#161C2D]">{docenteActual.codigo}</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[#161C2D]">
                {docenteActual.nombres} {docenteActual.apellidos}
              </span>
            </>
          )}
          {modo === 'estudiante' && (
            <>
              <span className="font-mono font-semibold text-[#161C2D]">{estudianteSel}</span>
              {estudianteActual && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#161C2D]">
                    {estudianteActual.nombres} {estudianteActual.apellidos}
                  </span>
                </>
              )}
            </>
          )}
          {modo === 'aula' && aulaActual && (
            <>
              <span className="font-mono font-semibold text-[#161C2D]">
                Aula {aulaActual.codigo}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Pabellón {aulaActual.pabellon} ({aulaActual.sede})
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Aforo {aulaActual.aforo}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{horarios.length} sesiones regulares</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{horasTotales} h/sem</span>
        </div>

        <div className="flex items-center gap-5">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#B85A26]" />
            Presencial (Regular)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#A62B6A]" />
            Reprogramación
          </span>
        </div>
      </div>

      {/* Grilla semanal estilo UTP+portal + panel lateral de detalle */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-9 rounded-lg border border-[#D4DFEE] bg-[#EDF3FA] overflow-hidden">
          {error ? (
            <div className="p-8 text-center text-sm text-[#D93B4E] bg-white">{error}</div>
          ) : cargando ? (
            <div className="p-6 space-y-3 bg-white">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-[#EDF3FA] rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[820px]">
                {/* Cabecera de días: Lun 16 .. Dom 22 */}
                <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-[#D4DFEE] bg-[#F4F8FD]">
                  <div className="py-3" />
                  {semanaInfo.dias.map((d) => (
                    <div
                      key={d.diaKey}
                      className={`py-3 px-2 border-l border-[#D4DFEE] flex items-center justify-center gap-1.5 text-xs ${
                        d.esHoy ? 'bg-white font-semibold text-[#5B4AE6]' : 'text-[#36415E]'
                      }`}
                    >
                      <span>{d.etiqueta}</span>
                      <span
                        className={`font-mono tabular-nums inline-flex items-center justify-center ${
                          d.esHoy
                            ? 'w-6 h-6 rounded-full bg-[#5B4AE6] text-white text-[11px] font-bold'
                            : 'text-[#36415E]'
                        }`}
                      >
                        {d.numero}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Banda magenta estilo UTP+portal (Virtual 24/7 -> Reprogramaciones activas) */}
                {mostrarReprogs && reprogsVisibles.length > 0 && (
                  <div className="grid grid-cols-[64px_1fr] border-b border-[#5B4AE6]/40 bg-[#EDF3FA]">
                    <div />
                    <div className="p-1.5 border-l border-[#D4DFEE] space-y-1">
                      {reprogsVisibles.slice(0, 2).map((rep) => (
                        <button
                          key={`ribbon-${rep.key}`}
                          type="button"
                          onClick={() => setBloqueActivo(rep)}
                          className="w-full rounded-md bg-[#A62B6A] hover:bg-[#8E2259] text-white px-3 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-left transition-colors cursor-pointer"
                        >
                          <span className="px-2.5 py-0.5 rounded-full bg-white text-[#A62B6A] text-[10px] font-bold whitespace-nowrap">
                            Reprogramación · {rep.estado}
                          </span>
                          <span className="font-semibold">{rep.curso}</span>
                          <span className="text-white/85 font-mono tabular-nums text-[11px]">
                            {rep.fecha ? formatearFechaCorta(rep.fecha) : DIAS_ES[rep.dia]} ·{' '}
                            {rep.horaInicio} - {rep.horaFin} · Aula {rep.aula}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cuerpo horario 07:00 - 22:00 */}
                <div
                  className="grid grid-cols-[64px_repeat(7,1fr)] relative bg-[#EDF3FA]"
                  style={{ height: `${(HORA_FIN_GRID - HORA_INICIO_GRID) * PIXELES_POR_HORA}px` }}
                >
                  {/* Columna de horas */}
                  <div className="relative bg-[#EDF3FA]">
                    {HORAS_MARCA.slice(0, -1).map((h) => (
                      <div
                        key={h}
                        style={{ height: `${PIXELES_POR_HORA}px` }}
                        className="pr-2.5 pt-1 text-right text-[11px] font-mono tabular-nums text-[#55637A] border-b border-[#DDE7F3]"
                      >
                        {String(h).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>

                  {/* Columnas de Lunes a Domingo */}
                  {semanaInfo.dias.map((d) => (
                    <div
                      key={d.diaKey}
                      className={`relative border-l border-[#DDE7F3] ${
                        d.esHoy ? 'bg-[#F8FBFF]/80' : 'bg-[#EDF3FA]'
                      }`}
                    >
                      {HORAS_MARCA.slice(0, -1).map((h) => (
                        <div
                          key={h}
                          style={{ height: `${PIXELES_POR_HORA}px` }}
                          className="border-b border-[#DDE7F3]"
                        />
                      ))}

                      {/* Tarjetas de clase estilo UTP+portal */}
                      {bloquesPorDia[d.diaKey].map((b) => {
                        const { top, height } = posicionBloque(b.horaInicio, b.horaFin);
                        const seleccionado = bloqueActivo?.key === b.key;
                        const esReprog = b.tipo === 'REPROGRAMACION';

                        return (
                          <button
                            key={b.key}
                            type="button"
                            onClick={() => setBloqueActivo(b)}
                            style={{ top: `${top + 2}px`, height: `${height - 4}px` }}
                            className={`absolute left-1 right-1 rounded-md p-2 text-left text-white transition-all cursor-pointer overflow-hidden flex flex-col justify-between focus:outline-none ${
                              esReprog
                                ? seleccionado
                                  ? 'bg-[#831E52] ring-2 ring-[#25206E] z-20'
                                  : 'bg-[#A62B6A] hover:bg-[#8E2259] z-10'
                                : seleccionado
                                  ? 'bg-[#94441A] ring-2 ring-[#25206E] z-20'
                                  : 'bg-[#B85A26] hover:bg-[#A04B1E] z-10'
                            }`}
                          >
                            <div className="space-y-1 min-w-0">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full bg-white text-[10px] font-bold leading-none ${
                                  esReprog ? 'text-[#8E2259]' : 'text-[#9A4317]'
                                }`}
                              >
                                {esReprog ? 'Reprogramado' : 'Presencial'}
                              </span>
                              <p className="text-[11px] font-semibold leading-snug line-clamp-2">
                                Curso: {b.curso}
                              </p>
                              <p className="text-[10px] font-mono tabular-nums text-white/90 leading-none">
                                {b.horaInicio} - {b.horaFin}
                              </p>
                            </div>

                            {height >= 76 && (
                              <div className="flex items-center gap-1 text-[10px] font-mono tabular-nums text-white/95 pt-1 truncate">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span className="truncate">{b.aula}</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!cargando && totalBloques === 0 && (
            <div className="border-t border-[#D4DFEE] bg-white px-6 py-8 text-center">
              <p className="text-sm font-semibold text-[#161C2D]">
                No existen sesiones programadas para esta selección.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Cambia de docente, estudiante o aula en la barra superior para consultar otro horario.
              </p>
            </div>
          )}
        </div>

        {/* Panel derecho de detalle de sesión */}
        <aside className="xl:col-span-3 bg-white border border-[#DCE6F2] rounded-xl p-5 space-y-5">
          <div>
            <h2 className="text-sm font-bold text-[#161C2D]">Detalle de la sesión</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Selecciona cualquier bloque del calendario para revisar aula, docente e inscritos.
            </p>
          </div>

          {bloqueActivo ? (
            <div className="space-y-4 pt-3 border-t border-slate-100">
              <div>
                <p
                  className={`text-xs font-semibold ${
                    bloqueActivo.tipo === 'REPROGRAMACION' ? 'text-[#A62B6A]' : 'text-[#B85A26]'
                  }`}
                >
                  {bloqueActivo.tipo === 'REPROGRAMACION'
                    ? `Reprogramación · ${bloqueActivo.estado}`
                    : 'Modalidad Presencial'}
                </p>
                <h3 className="text-base font-bold text-[#161C2D] mt-1 leading-snug">
                  {bloqueActivo.curso}
                </h3>
              </div>

              <dl className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500 inline-flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Día
                  </dt>
                  <dd className="font-medium text-[#161C2D]">
                    {bloqueActivo.fecha
                      ? formatearFechaCorta(bloqueActivo.fecha)
                      : DIAS_ES[bloqueActivo.dia]}
                  </dd>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500 inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Franja
                  </dt>
                  <dd className="font-mono tabular-nums font-medium text-[#161C2D]">
                    {bloqueActivo.horaInicio} – {bloqueActivo.horaFin}
                  </dd>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500 inline-flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    Docente
                  </dt>
                  <dd className="font-medium text-[#161C2D] text-right">
                    {bloqueActivo.docenteNombre}
                    <span className="block font-mono text-[11px] text-slate-500">
                      {bloqueActivo.docenteCodigo}
                    </span>
                  </dd>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500 inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Aula
                  </dt>
                  <dd className="font-mono tabular-nums font-semibold text-[#161C2D]">
                    {bloqueActivo.aula}
                  </dd>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <dt className="text-slate-500 inline-flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Estudiantes matriculados
                  </dt>
                  <dd className="font-mono tabular-nums font-semibold text-[#161C2D]">
                    {bloqueActivo.inscritos ?? 0}
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() =>
                  onIrAReprogramar({
                    docenteCodigo: bloqueActivo.docenteCodigo,
                    curso: bloqueActivo.curso,
                    aula: bloqueActivo.aula,
                    horaInicio: bloqueActivo.horaInicio,
                    horaFin: bloqueActivo.horaFin,
                  })
                }
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[#5B4AE6] text-white text-xs font-semibold hover:bg-[#4838CC] transition-colors cursor-pointer"
              >
                Reprogramar este curso
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-100 space-y-3 text-xs text-slate-500">
              <p>
                Ningún bloque seleccionado. Haz clic en una tarjeta naranja (Presencial) o magenta
                (Reprogramada) para ver detalles.
              </p>
              {horarios.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  <p className="font-semibold text-[#161C2D]">Accesos rápidos de esta agenda</p>
                  {horarios.slice(0, 4).map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() =>
                        setBloqueActivo({
                          key: `reg-${h.id}`,
                          tipo: 'REGULAR',
                          dia: h.dia,
                          curso: h.curso,
                          docenteCodigo: h.docenteCodigo,
                          docenteNombre: h.docenteNombre || h.docenteCodigo,
                          horaInicio: h.horaInicio,
                          horaFin: h.horaFin,
                          aula: h.aula,
                          inscritos: h.inscritos,
                        })
                      }
                      className="w-full text-left px-3 py-2 rounded-lg border border-[#DCE6F2] hover:border-[#5B4AE6] transition-colors cursor-pointer"
                    >
                      <p className="font-semibold text-[#161C2D] truncate">{h.curso}</p>
                      <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                        {DIAS_ES[h.dia]} · {h.horaInicio}–{h.horaFin} · {h.aula}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
