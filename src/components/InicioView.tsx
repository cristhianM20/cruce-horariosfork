import {
  Building2,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  ClipboardCheck,
  Clock,
  GraduationCap,
  MapPin,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { DIAS_ES, fechaADiaSemana, formatearFechaCorta } from '../lib/time';
import type { Horario, Reprogramacion, ResumenSistema } from '../types/academic';
import type { ModoCalendario } from './CalendarioSemanalView';

interface InicioViewProps {
  resumen: ResumenSistema | null;
  todosHorarios: Horario[];
  reprogramaciones: Reprogramacion[];
  onAbrirCalendario: (modo: ModoCalendario, codigo?: string) => void;
  onIrAReprogramar: () => void;
  onIrASolicitudes: () => void;
  onIrACatalogo: () => void;
}

export function InicioView({
  resumen,
  todosHorarios,
  reprogramaciones,
  onAbrirCalendario,
  onIrAReprogramar,
  onIrASolicitudes,
  onIrACatalogo,
}: InicioViewProps) {
  const hoy = new Date();
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(
    hoy.getDate()
  ).padStart(2, '0')}`;
  const diaHoy = fechaADiaSemana(hoyIso);

  const mesesLargos = [
    'ene.',
    'feb.',
    'mar.',
    'abr.',
    'may.',
    'jun.',
    'jul.',
    'ago.',
    'sep.',
    'oct.',
    'nov.',
    'dic.',
  ];
  const fechaLegible = `${hoy.getDate()} ${mesesLargos[hoy.getMonth()]} ${hoy.getFullYear()}`;

  const clasesHoy = todosHorarios
    .filter((h) => h.dia === diaHoy)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

  const pendientes = reprogramaciones.filter((r) => r.estado === 'SOLICITADO');

  return (
    <div className="max-w-[1160px] mx-auto space-y-6">
      {/* Banner institucional estilo UTP+portal */}
      <section className="rounded-xl overflow-hidden bg-white border border-[#DCE6F2] shadow-xs">
        <div className="relative px-6 sm:px-10 py-7 sm:py-8 bg-gradient-to-r from-[#F8FBFF] via-[#F2F7FD] to-[#E6F2F4]">
          {/* Acento geométrico derecho característico de UTP+portal */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-0 right-0 w-36 h-28 bg-[#1B9E99]/18 rounded-bl-[64px] pointer-events-none"
          />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-0.5 select-none">
                  <span className="w-5 h-5 bg-[#C8102E] text-white font-bold text-[11px] flex items-center justify-center rounded-[2px]">
                    U
                  </span>
                  <span className="w-5 h-5 bg-[#C8102E] text-white font-bold text-[11px] flex items-center justify-center rounded-[2px]">
                    T
                  </span>
                  <span className="w-5 h-5 bg-[#C8102E] text-white font-bold text-[11px] flex items-center justify-center rounded-[2px]">
                    P
                  </span>
                </span>
                <span className="text-xs font-medium text-slate-600">
                  Gestión Académica · Verificación de Cruce de Horarios
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-[#1B224B] tracking-tight leading-tight">
                Planificación sin cruces horarios ni exceso de aforo
              </h2>
              <p className="text-sm text-[#36415E] leading-relaxed">
                Consulta horarios semanales por docente, estudiante o aula y valida reprogramaciones
                presenciales con margen obligatorio de 15 minutos y disponibilidad estudiantil en tiempo
                real.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onIrAReprogramar}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#25206E] text-white text-xs font-semibold hover:bg-[#191552] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Reprogramar una clase
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onAbrirCalendario('docente', 'DOC-101')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#97D5D2]/45 text-[#143B40] text-xs font-semibold hover:bg-[#97D5D2]/70 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  Abrir calendario semanal
                </button>
              </div>
            </div>

            {/* Indicadores compactos en formato limpio */}
            {resumen && (
              <div className="grid grid-cols-2 gap-3 lg:w-72 shrink-0 bg-white/90 border border-[#D8E3F0] rounded-xl p-4">
                <div>
                  <p className="text-[11px] text-slate-500">Docentes</p>
                  <p className="text-xl font-mono tabular-nums font-bold text-[#1B224B]">
                    {resumen.totalDocentes}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Estudiantes</p>
                  <p className="text-xl font-mono tabular-nums font-bold text-[#1B224B]">
                    {resumen.totalEstudiantes.toLocaleString('es-PE')}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[11px] text-slate-500">Sesiones</p>
                  <p className="text-xl font-mono tabular-nums font-bold text-[#B85A26]">
                    {resumen.totalHorarios}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[11px] text-slate-500">Aulas</p>
                  <p className="text-xl font-mono tabular-nums font-bold text-[#5B4AE6]">
                    {resumen.totalAulas}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Franja violeta/índigo característica de UTP+portal */}
        <div className="bg-[#5B4AE6] text-white px-6 sm:px-10 py-3 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2">
          <p>
            Reglas activas en el sistema:{' '}
            <strong className="font-semibold">
              Modalidad Presencial · Intervalo mínimo 15 min · Control de aforo y cruce estudiantil
            </strong>
          </p>
          <span className="inline-flex items-center gap-1.5 text-white/90 text-xs font-mono tabular-nums">
            <ShieldCheck className="w-4 h-4" />
            6 validaciones en línea
          </span>
        </div>
      </section>

      {/* Fila de 2 columnas estilo UTP+portal: "Hoy, ..." y "Realiza tus trámites..." */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna Hoy */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-[#161C2D]">
              Hoy, <span className="font-normal text-slate-700">{fechaLegible}</span>
            </h3>
            <button
              type="button"
              onClick={() => onAbrirCalendario('docente', 'DOC-101')}
              className="px-4 py-1.5 rounded-md bg-[#5B4AE6] text-white text-xs font-semibold hover:bg-[#4838CC] transition-colors cursor-pointer whitespace-nowrap"
            >
              Ver mi horario
            </button>
          </div>

          <div className="bg-white border border-[#DCE6F2] rounded-xl p-5 min-h-[112px] flex flex-col justify-center">
            {clasesHoy.length === 0 ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#EDF3FA] text-[#5B4AE6] flex items-center justify-center shrink-0">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    No hay sesiones regulares programadas para hoy ({diaHoy ? DIAS_ES[diaHoy] : ''})
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Explora la semana completa en el Calendario para ver todos los cursos.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-slate-500">
                  {clasesHoy.length} sesiones presenciales activas hoy ({diaHoy ? DIAS_ES[diaHoy] : ''})
                </p>
                <div className="divide-y divide-slate-100">
                  {clasesHoy.slice(0, 3).map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => onAbrirCalendario('docente', h.docenteCodigo)}
                      className="w-full py-2 flex items-center justify-between gap-3 text-left hover:bg-[#F8FAFC] rounded-md px-1 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{h.curso}</p>
                        <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#B85A26]" />
                            {h.horaInicio} - {h.horaFin}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#B85A26]" />
                            {h.aula}
                          </span>
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#5B4AE6] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Columna Trámites / Solicitudes */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-[#161C2D]">
              Gestiona tus reprogramaciones:
            </h3>
            <button
              type="button"
              onClick={onIrASolicitudes}
              className="px-4 py-1.5 rounded-md bg-[#5B4AE6] text-white text-xs font-semibold hover:bg-[#4838CC] transition-colors cursor-pointer whitespace-nowrap"
            >
              Ir a trámites
            </button>
          </div>

          <button
            type="button"
            onClick={onIrASolicitudes}
            className="w-full bg-white border border-[#DCE6F2] hover:border-[#5B4AE6]/50 rounded-xl p-5 min-h-[112px] flex items-center justify-between gap-4 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-[#EDF3FA] text-[#5B4AE6] flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {pendientes.length > 0
                    ? `${pendientes.length} solicitud(es) de reprogramación pendiente(s)`
                    : 'Todas las reprogramaciones revisadas'}
                </p>
                <p className="text-xs text-slate-500 mt-1 truncate">
                  {pendientes[0]
                    ? `${pendientes[0].codigoSolicitud} · ${pendientes[0].curso} (${formatearFechaCorta(pendientes[0].fecha)})`
                    : `${reprogramaciones.length} acta(s) registrada(s) en el periodo actual`}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#5B4AE6] shrink-0" />
          </button>
        </div>
      </section>

      {/* Sección "Otros enlaces" estilo UTP+portal */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-[#161C2D]">Accesos directos</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => onAbrirCalendario('docente', 'DOC-101')}
            className="bg-white border border-[#DCE6F2] hover:border-[#5B4AE6] rounded-xl p-5 flex flex-col items-center text-center gap-2.5 transition-colors cursor-pointer"
          >
            <UserCheck className="w-5 h-5 text-[#25206E]" />
            <span className="text-xs font-semibold text-[#1B224B]">Horario por docente</span>
          </button>

          <button
            type="button"
            onClick={() => onAbrirCalendario('estudiante', 'U23231304')}
            className="bg-white border border-[#DCE6F2] hover:border-[#5B4AE6] rounded-xl p-5 flex flex-col items-center text-center gap-2.5 transition-colors cursor-pointer"
          >
            <GraduationCap className="w-5 h-5 text-[#25206E]" />
            <span className="text-xs font-semibold text-[#1B224B]">Horario por estudiante</span>
          </button>

          <button
            type="button"
            onClick={() => onAbrirCalendario('aula', 'A101')}
            className="bg-white border border-[#DCE6F2] hover:border-[#5B4AE6] rounded-xl p-5 flex flex-col items-center text-center gap-2.5 transition-colors cursor-pointer"
          >
            <Building2 className="w-5 h-5 text-[#25206E]" />
            <span className="text-xs font-semibold text-[#1B224B]">Disponibilidad de aulas</span>
          </button>

          <button
            type="button"
            onClick={onIrACatalogo}
            className="bg-white border border-[#DCE6F2] hover:border-[#5B4AE6] rounded-xl p-5 flex flex-col items-center text-center gap-2.5 transition-colors cursor-pointer"
          >
            <CalendarPlus className="w-5 h-5 text-[#25206E]" />
            <span className="text-xs font-semibold text-[#1B224B]">Catálogo y matrículas</span>
          </button>
        </div>
      </section>
    </div>
  );
}
