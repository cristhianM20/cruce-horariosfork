import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Search,
  Send,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { DIAS_ES, fechaADiaSemana, fechaFuturaIso, formatearFechaCorta, horaAMinutos } from '../lib/time';
import { NotificacionFlotante, type AlertaDetalle } from './NotificacionFlotante';
import type {
  Aula,
  Docente,
  FranjaSugerida,
  Horario,
  Reprogramacion,
  ResultadoValidacion,
} from '../types/academic';

export interface PresetReprogramacion {
  docenteCodigo: string;
  curso: string;
  aula: string;
  horaInicio: string;
  horaFin: string;
}

interface ReprogramacionViewProps {
  docentes: Docente[];
  aulas: Aula[];
  todosHorarios: Horario[];
  preset: PresetReprogramacion | null;
  onReprogramacionCreada: (rep: Reprogramacion) => void;
}

export function ReprogramacionView({
  docentes,
  aulas,
  todosHorarios,
  preset,
  onReprogramacionCreada,
}: ReprogramacionViewProps) {
  const [docenteCodigo, setDocenteCodigo] = useState<string>(preset?.docenteCodigo || 'DOC-101');
  const [curso, setCurso] = useState<string>(preset?.curso || 'Desarrollo Web Integrado');
  const [fecha, setFecha] = useState<string>(fechaFuturaIso(3));
  const [horaInicio, setHoraInicio] = useState<string>(preset?.horaInicio || '10:00');
  const [horaFin, setHoraFin] = useState<string>(preset?.horaFin || '12:00');
  const [aula, setAula] = useState<string>(preset?.aula || 'A0107');
  const [motivo, setMotivo] = useState<string>(
    'Recuperación de sesión académica presencial'
  );
  const [bufferMinutos, setBufferMinutos] = useState<number>(15);

  const [validacion, setValidacion] = useState<ResultadoValidacion | null>(null);
  const [validando, setValidando] = useState<boolean>(false);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [errorEnvio, setErrorEnvio] = useState<string>('');
  const [exitoRep, setExitoRep] = useState<Reprogramacion | null>(null);

  const [sugerencias, setSugerencias] = useState<FranjaSugerida[]>([]);
  const [buscandoSugerencias, setBuscandoSugerencias] = useState<boolean>(false);
  const [mostrarAfectados, setMostrarAfectados] = useState<boolean>(false);

  const [notificacionVisible, setNotificacionVisible] = useState<boolean>(false);
  const [contadorDisparoToast, setContadorDisparoToast] = useState<number>(0);
  const ultimaFirmaAlertaRef = useRef<string>('');

  useEffect(() => {
    if (preset) {
      setDocenteCodigo(preset.docenteCodigo);
      setCurso(preset.curso);
      setAula(preset.aula);
      setHoraInicio(preset.horaInicio);
      setHoraFin(preset.horaFin);
      setExitoRep(null);
      setErrorEnvio('');
    }
  }, [preset]);

  const cursosDelDocente = useMemo(() => {
    const filtrados = todosHorarios.filter((h) => h.docenteCodigo === docenteCodigo);
    const fuente = filtrados.length > 0 ? filtrados : todosHorarios;
    const vistos = new Set<string>();
    const unicos: Horario[] = [];
    for (const h of fuente) {
      if (!vistos.has(h.curso)) {
        vistos.add(h.curso);
        unicos.push(h);
      }
    }
    return unicos;
  }, [todosHorarios, docenteCodigo]);

  // Keep course aligned when teacher changes
  const handleDocenteChange = (nuevoDoc: string) => {
    setDocenteCodigo(nuevoDoc);
    setExitoRep(null);
    setSugerencias([]);
    const cursosDoc = todosHorarios.filter((h) => h.docenteCodigo === nuevoDoc);
    if (cursosDoc.length > 0 && !cursosDoc.some((h) => h.curso === curso)) {
      setCurso(cursosDoc[0].curso);
    }
  };

  // Live debounced validation against backend (all 6 rules)
  useEffect(() => {
    let cancelado = false;
    setValidando(true);
    const timer = setTimeout(() => {
      api
        .validarReprogramacion({
          docenteCodigo,
          curso,
          fecha,
          horaInicio,
          horaFin,
          aula,
          bufferMinutos,
        })
        .then((res) => {
          if (!cancelado) {
            setValidacion(res);
            setValidando(false);
          }
        })
        .catch(() => {
          if (!cancelado) setValidando(false);
        });
    }, 150);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [docenteCodigo, curso, fecha, horaInicio, horaFin, aula, bufferMinutos]);

  const diaFecha = useMemo(() => fechaADiaSemana(fecha), [fecha]);

  // Regular blocks on the selected weekday for teacher + classroom timeline
  const bloquesDocenteDia = useMemo(() => {
    if (!diaFecha) return [];
    return todosHorarios
      .filter((h) => h.docenteCodigo === docenteCodigo && h.dia === diaFecha)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }, [todosHorarios, docenteCodigo, diaFecha]);

  const bloquesAulaDia = useMemo(() => {
    if (!diaFecha || !aula) return [];
    return todosHorarios
      .filter((h) => h.aula === aula && h.dia === diaFecha)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }, [todosHorarios, aula, diaFecha]);

  const handleBuscarSugerencias = async () => {
    setBuscandoSugerencias(true);
    setErrorEnvio('');
    try {
      const duracion = Math.max(60, horaAMinutos(horaFin) - horaAMinutos(horaInicio)) || 120;
      const res = await api.sugerirFranjas({
        docenteCodigo,
        curso,
        fecha,
        duracionMin: duracion,
        bufferMinutos,
      });
      setSugerencias(res.franjas);
    } catch (err) {
      setErrorEnvio(err instanceof Error ? err.message : 'No se pudieron calcular sugerencias.');
    } finally {
      setBuscandoSugerencias(false);
    }
  };

  const aplicarSugerencia = (s: FranjaSugerida) => {
    setFecha(s.fecha);
    setHoraInicio(s.horaInicio);
    setHoraFin(s.horaFin);
    if (s.aulasLibres.length > 0) {
      setAula(s.aulasLibres[0].codigo);
    }
    setErrorEnvio('');
    setExitoRep(null);
  };

  const alertaFlotante = useMemo(() => {
    if (!validacion) {
      return { titulo: '', detalles: [] as AlertaDetalle[], firma: '' };
    }

    const detalles: AlertaDetalle[] = [];
    let tieneCruce = false;
    let tieneAforo = false;

    if (validacion.conflictosDocente.length > 0) {
      tieneCruce = true;
      const primero = validacion.conflictosDocente[0];
      detalles.push({
        id: 'cruce-docente',
        categoria: 'cruce',
        etiqueta:
          primero.severidad === 'INTERVALO_15MIN'
            ? 'Margen insuficiente (docente)'
            : 'Cruce de docente',
        mensaje: primero.mensaje,
      });
    }

    if (validacion.disponibilidad.conCruce > 0) {
      tieneCruce = true;
      const { conCruce, totalEstudiantes, porcentajeAsistencia, conCruceDirecto, conCruceIntervalo } =
        validacion.disponibilidad;
      const partes: string[] = [];
      if (conCruceDirecto > 0) partes.push(`${conCruceDirecto} con solapamiento`);
      if (conCruceIntervalo > 0) partes.push(`${conCruceIntervalo} sin margen de ${bufferMinutos} min`);
      detalles.push({
        id: 'cruce-estudiantes',
        categoria: 'cruce',
        etiqueta: 'Cruce estudiantil',
        mensaje: `${conCruce} de ${totalEstudiantes} alumnos afectados (${partes.join(', ')}; ${porcentajeAsistencia}% disponibles).`,
      });
    }

    const cruceAulaHorario = validacion.conflictosAula.find((c) => c.severidad !== 'AFORO');
    if (cruceAulaHorario) {
      tieneCruce = true;
      detalles.push({
        id: 'cruce-aula',
        categoria: 'cruce',
        etiqueta: 'Aula ocupada',
        mensaje: cruceAulaHorario.mensaje,
      });
    }

    const excesoAforo = validacion.conflictosAula.find((c) => c.severidad === 'AFORO');
    if (excesoAforo) {
      tieneAforo = true;
      detalles.push({
        id: 'exceso-aforo',
        categoria: 'aforo',
        etiqueta: 'Aforo excedido',
        mensaje: excesoAforo.mensaje,
      });
    }

    const titulo =
      tieneCruce && tieneAforo
        ? 'Cruce horario y aforo excedido'
        : tieneAforo
          ? 'Aforo del aula excedido'
          : tieneCruce
            ? 'Cruce horario detectado'
            : '';

    const firma = detalles.map((d) => `${d.id}:${d.mensaje}`).join('|');
    return { titulo, detalles, firma };
  }, [validacion, bufferMinutos]);

  // Disparo automático cada vez que cambia el conflicto horario o exceso de aforo
  useEffect(() => {
    if (validando) return;
    if (alertaFlotante.detalles.length === 0) {
      ultimaFirmaAlertaRef.current = '';
      setNotificacionVisible(false);
      return;
    }
    if (alertaFlotante.firma !== ultimaFirmaAlertaRef.current) {
      ultimaFirmaAlertaRef.current = alertaFlotante.firma;
      setContadorDisparoToast((n) => n + 1);
      setNotificacionVisible(true);
    }
  }, [validando, alertaFlotante]);

  const cerrarNotificacion = useCallback(() => {
    setNotificacionVisible(false);
  }, []);

  const handleRegistrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validacion && !validacion.valido) {
      setErrorEnvio(validacion.resumen);
      if (alertaFlotante.detalles.length > 0) {
        setContadorDisparoToast((n) => n + 1);
        setNotificacionVisible(true);
      }
      return;
    }

    setEnviando(true);
    setErrorEnvio('');
    setExitoRep(null);
    try {
      const res = await api.crearReprogramacion({
        docenteCodigo,
        curso,
        fecha,
        horaInicio,
        horaFin,
        aula,
        motivo,
        bufferMinutos,
      });
      setExitoRep(res.reprogramacion);
      setValidacion(res.validacion);
      setNotificacionVisible(false);
      onReprogramacionCreada(res.reprogramacion);
    } catch (err) {
      setErrorEnvio(
        err instanceof Error ? err.message : 'No se pudo registrar la reprogramación.'
      );
      if (alertaFlotante.detalles.length > 0) {
        setContadorDisparoToast((n) => n + 1);
        setNotificacionVisible(true);
      }
    } finally {
      setEnviando(false);
    }
  };

  // Timeline helper (07:00 to 22:00 => 900 min)
  const calcBarra = (hi: string, hf: string) => {
    const start = Math.max(420, horaAMinutos(hi));
    const end = Math.min(1320, horaAMinutos(hf));
    if (end <= start) return null;
    const leftPct = ((start - 420) / 900) * 100;
    const widthPct = ((end - start) / 900) * 100;
    return { left: `${leftPct}%`, width: `${Math.max(widthPct, 2)}%` };
  };

  const barraPropuesta = calcBarra(horaInicio, horaFin);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Columna izquierda: Formulario de reprogramación + Buscador inteligente */}
      <div className="xl:col-span-5 space-y-6">
        <form
          onSubmit={handleRegistrar}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Solicitud de reprogramación
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Cada cambio se valida en vivo contra docente, estudiantes, aula y margen de traslado.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Docente titular
              </label>
              <select
                value={docenteCodigo}
                onChange={(e) => handleDocenteChange(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5B4AE6]/25 focus:border-[#5B4AE6]"
              >
                {docentes.map((d) => (
                  <option key={d.codigo} value={d.codigo}>
                    {d.codigo} — {d.nombres} {d.apellidos}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Curso a reprogramar
              </label>
              <select
                value={curso}
                onChange={(e) => {
                  setCurso(e.target.value);
                  setSugerencias([]);
                  setExitoRep(null);
                }}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5B4AE6]/25 focus:border-[#5B4AE6]"
              >
                {cursosDelDocente.map((h) => (
                  <option key={h.curso} value={h.curso}>
                    {h.curso} ({h.inscritos ?? 0} inscritos)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Nueva fecha
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => {
                    setFecha(e.target.value);
                    setExitoRep(null);
                  }}
                  required
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5B4AE6]/25 focus:border-[#5B4AE6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Hora inicio
                </label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => {
                    setHoraInicio(e.target.value);
                    setExitoRep(null);
                  }}
                  required
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5B4AE6]/25 focus:border-[#5B4AE6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Hora fin
                </label>
                <input
                  type="time"
                  value={horaFin}
                  onChange={(e) => {
                    setHoraFin(e.target.value);
                    setExitoRep(null);
                  }}
                  required
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5B4AE6]/25 focus:border-[#5B4AE6]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Aula presencial (con validación de ocupación y aforo)
              </label>
              <select
                value={aula}
                onChange={(e) => {
                  setAula(e.target.value);
                  setExitoRep(null);
                }}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5B4AE6]/25 focus:border-[#5B4AE6]"
              >
                {aulas.map((a) => (
                  <option key={a.codigo} value={a.codigo}>
                    {a.codigo} — Pab. {a.pabellon} · Aforo {a.aforo} ({a.sede})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Motivo académico
              </label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. Recuperación por feriado o actividad académica"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5B4AE6]/25 focus:border-[#5B4AE6]"
              />
            </div>

            {/* Control de regla de intervalo mínimo de 15 min */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-800">
                  Margen mínimo de traslado entre clases
                </p>
                <p className="text-[11px] text-slate-500">
                  Evita clases consecutivas sin pausa (ej. 08:00–10:00 y 10:00–12:00).
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => setBufferMinutos(15)}
                  className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    bufferMinutos === 15
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  15 min
                </button>
                <button
                  type="button"
                  onClick={() => setBufferMinutos(0)}
                  className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    bufferMinutos === 0
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  0 min
                </button>
              </div>
            </div>
          </div>

          {errorEnvio && (
            <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#991B1B] flex items-start gap-2">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#C8102E]" />
              <span>{errorEnvio}</span>
            </div>
          )}

          {exitoRep && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
              <div>
                <p className="font-semibold">
                  Solicitud {exitoRep.codigoSolicitud} registrada sin cruces.
                </p>
                <p className="mt-0.5 text-emerald-800">
                  Estado inicial: SOLICITADO · {formatearFechaCorta(exitoRep.fecha)} ({exitoRep.horaInicio}–
                  {exitoRep.horaFin}) en aula {exitoRep.aula}.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={enviando || validando}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
                validacion && !validacion.valido
                  ? 'bg-[#C8102E] hover:bg-[#A50D26]'
                  : 'bg-[#5B4AE6] hover:bg-[#4838CC]'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              {enviando
                ? 'Registrando...'
                : validacion && !validacion.valido
                  ? 'Revisar conflictos'
                  : 'Registrar reprogramación'}
            </button>

            <button
              type="button"
              onClick={handleBuscarSugerencias}
              disabled={buscandoSugerencias}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5" />
              {buscandoSugerencias ? 'Buscando...' : 'Sugerir franjas libres'}
            </button>
          </div>
        </form>

        {/* Resultados del sugeridor automático de franjas libres */}
        {sugerencias.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Franjas recomendadas sin cruce docente
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {sugerencias.length} opciones
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {sugerencias.map((s) => (
                <div
                  key={`${s.fecha}-${s.horaInicio}`}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">
                      {formatearFechaCorta(s.fecha)}{' '}
                      <span className="font-mono tabular-nums text-[#5B4AE6] ml-1">
                        {s.horaInicio}–{s.horaFin}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      <span
                        className={`font-mono tabular-nums font-medium ${
                          s.porcentajeAsistencia === 100
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {s.porcentajeAsistencia}% asistencia ({s.disponibles}/{s.totalEstudiantes})
                      </span>
                      {' · '}
                      Aulas libres: {s.aulasLibres.map((a) => `${a.codigo} (${a.aforo})`).join(', ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => aplicarSugerencia(s)}
                    className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:border-[#5B4AE6] hover:text-[#5B4AE6] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Aplicar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Columna derecha: Diagnóstico en vivo de las 6 reglas + Disponibilidad + Línea de tiempo */}
      <div className="xl:col-span-7 space-y-6">
        {/* Resumen de dictamen */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-start gap-3">
              {validacion?.valido ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" />
              )}
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {validando
                    ? 'Evaluando reglas académicas...'
                    : validacion?.valido
                      ? 'Franja aprobada para reprogramación'
                      : 'Conflicto detectado en la franja propuesta'}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  {validacion?.resumen || 'Completa los campos para ejecutar el diagnóstico.'}
                </p>
              </div>
            </div>
            {diaFecha && (
              <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap shrink-0">
                {DIAS_ES[diaFecha]} · {horaInicio}–{horaFin}
              </span>
            )}
          </div>

          {/* Matriz de 6 reglas de negocio */}
          <div className="divide-y divide-slate-100">
            {(validacion?.reglas ?? []).map((regla) => (
              <div key={regla.id} className="py-3 flex items-start justify-between gap-4">
                <div className="flex items-start gap-2.5 min-w-0">
                  {regla.estado === 'ok' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : regla.estado === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[#C8102E] shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{regla.titulo}</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{regla.detalle}</p>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                    regla.estado === 'ok'
                      ? 'text-emerald-700'
                      : regla.estado === 'warning'
                        ? 'text-amber-700'
                        : 'text-[#C8102E]'
                  }`}
                >
                  {regla.estado === 'ok'
                    ? 'Cumple'
                    : regla.estado === 'warning'
                      ? 'Aviso'
                      : 'Conflicto'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Disponibilidad presencial estudiantil */}
        {validacion && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Disponibilidad presencial de estudiantes matriculados
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verificación instantánea indexada sobre los alumnos inscritos en {curso}.
                </p>
              </div>
              <p className="text-2xl font-mono tabular-nums font-semibold text-slate-900">
                {validacion.disponibilidad.porcentajeAsistencia}%
              </p>
            </div>

            {/* Barra proporcional */}
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  validacion.disponibilidad.porcentajeAsistencia === 100
                    ? 'bg-emerald-600'
                    : validacion.disponibilidad.porcentajeAsistencia >= 80
                      ? 'bg-amber-500'
                      : 'bg-[#C8102E]'
                }`}
                style={{ width: `${validacion.disponibilidad.porcentajeAsistencia}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1 text-xs">
              <div>
                <p className="text-slate-500">Matriculados</p>
                <p className="font-mono tabular-nums text-base font-semibold text-slate-900 mt-0.5">
                  {validacion.disponibilidad.totalEstudiantes}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Disponibles</p>
                <p className="font-mono tabular-nums text-base font-semibold text-emerald-700 mt-0.5">
                  {validacion.disponibilidad.disponibles}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Solapamiento directo</p>
                <p className="font-mono tabular-nums text-base font-semibold text-[#C8102E] mt-0.5">
                  {validacion.disponibilidad.conCruceDirecto}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Falta margen ({bufferMinutos}m)</p>
                <p className="font-mono tabular-nums text-base font-semibold text-amber-700 mt-0.5">
                  {validacion.disponibilidad.conCruceIntervalo}
                </p>
              </div>
            </div>

            {validacion.disponibilidad.estudiantesAfectados.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMostrarAfectados((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5B4AE6] hover:underline cursor-pointer"
                >
                  {mostrarAfectados ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  {mostrarAfectados
                    ? 'Ocultar detalle de estudiantes afectados'
                    : `Ver ${validacion.disponibilidad.estudiantesAfectados.length} estudiante(s) con conflicto`}
                </button>

                {mostrarAfectados && (
                  <div className="mt-3 overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="py-2 px-3 font-semibold">Código</th>
                          <th className="py-2 px-3 font-semibold">Estudiante</th>
                          <th className="py-2 px-3 font-semibold">Curso en conflicto</th>
                          <th className="py-2 px-3 font-semibold">Horario</th>
                          <th className="py-2 px-3 font-semibold">Motivo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {validacion.disponibilidad.estudiantesAfectados.map((est) => (
                          <tr key={`${est.entidadCodigo}-${est.cursoConflicto}`}>
                            <td className="py-2 px-3 font-mono tabular-nums text-slate-900">
                              {est.entidadCodigo}
                            </td>
                            <td className="py-2 px-3 text-slate-700">{est.entidadNombre}</td>
                            <td className="py-2 px-3 font-medium text-slate-900">
                              {est.cursoConflicto}
                            </td>
                            <td className="py-2 px-3 font-mono tabular-nums text-slate-600">
                              {est.horaInicio}–{est.horaFin}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={
                                  est.severidad === 'SOLAPAMIENTO'
                                    ? 'text-[#C8102E] font-medium'
                                    : 'text-amber-700 font-medium'
                                }
                              >
                                {est.severidad === 'SOLAPAMIENTO'
                                  ? 'Solapamiento'
                                  : `Margen ${est.minutosSeparacion ?? 0} min`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Línea de tiempo visual del día seleccionado */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">
                Línea de tiempo del {diaFecha ? DIAS_ES[diaFecha] : 'día seleccionado'} (07:00 – 22:00)
              </h3>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-slate-500">
              Propuesta: {horaInicio}–{horaFin}
            </span>
          </div>

          <div className="space-y-3">
            {/* Escala horaria */}
            <div className="flex justify-between text-[10px] font-mono tabular-nums text-slate-400 px-0.5">
              <span>07:00</span>
              <span>10:00</span>
              <span>13:00</span>
              <span>16:00</span>
              <span>19:00</span>
              <span>22:00</span>
            </div>

            {/* Pista 1: Docente */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">Docente ({docenteCodigo})</span>
                <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {bloquesDocenteDia.length} clase(s) regulares
                </span>
              </div>
              <div className="relative h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden">
                {bloquesDocenteDia.map((h) => {
                  const style = calcBarra(h.horaInicio, h.horaFin);
                  if (!style) return null;
                  return (
                    <div
                      key={h.id}
                      style={style}
                      title={`${h.curso} (${h.horaInicio}–${h.horaFin})`}
                      className="absolute top-1 bottom-1 rounded-xs bg-[#B85A26] text-white text-[10px] px-1.5 flex items-center truncate"
                    >
                      {h.curso}
                    </div>
                  );
                })}
                {barraPropuesta && (
                  <div
                    style={barraPropuesta}
                    title={`Propuesta: ${horaInicio}–${horaFin}`}
                    className={`absolute top-0 bottom-0 border-2 border-dashed ${
                      validacion && validacion.conflictosDocente.length > 0
                        ? 'bg-[#C8102E]/25 border-[#C8102E]'
                        : 'bg-emerald-500/20 border-emerald-600'
                    }`}
                  />
                )}
              </div>
            </div>

            {/* Pista 2: Aula */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">Aula ({aula || 'Sin asignar'})</span>
                <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {bloquesAulaDia.length} ocupación(es) regulares
                </span>
              </div>
              <div className="relative h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden">
                {bloquesAulaDia.map((h) => {
                  const style = calcBarra(h.horaInicio, h.horaFin);
                  if (!style) return null;
                  return (
                    <div
                      key={h.id}
                      style={style}
                      title={`${h.curso} (${h.horaInicio}–${h.horaFin})`}
                      className="absolute top-1 bottom-1 rounded-xs bg-slate-600 text-white text-[10px] px-1.5 flex items-center truncate"
                    >
                      {h.curso}
                    </div>
                  );
                })}
                {barraPropuesta && (
                  <div
                    style={barraPropuesta}
                    title={`Propuesta en aula ${aula}: ${horaInicio}–${horaFin}`}
                    className={`absolute top-0 bottom-0 border-2 border-dashed ${
                      validacion && validacion.conflictosAula.length > 0
                        ? 'bg-[#C8102E]/25 border-[#C8102E]'
                        : 'bg-emerald-500/20 border-emerald-600'
                    }`}
                  />
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-1 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-2.5 rounded-xs bg-[#B85A26]" />
                Clase regular existente
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-2.5 rounded-xs border border-dashed border-emerald-600 bg-emerald-500/20" />
                Propuesta sin cruce
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-2.5 rounded-xs border border-dashed border-[#C8102E] bg-[#C8102E]/25" />
                Propuesta con conflicto
              </span>
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3" />
                Margen activo: {bufferMinutos} min
              </span>
            </div>
          </div>
        </div>
      </div>

      <NotificacionFlotante
        visible={notificacionVisible}
        titulo={alertaFlotante.titulo}
        resumenMeta={`${diaFecha ? DIAS_ES[diaFecha] : fecha} ${horaInicio}–${horaFin} · Aula ${aula || '—'}`}
        detalles={alertaFlotante.detalles}
        claveEvento={`${contadorDisparoToast}-${alertaFlotante.firma}`}
        onCerrar={cerrarNotificacion}
        onSugerirFranjas={() => {
          handleBuscarSugerencias();
          cerrarNotificacion();
        }}
        buscandoSugerencias={buscandoSugerencias}
      />
    </div>
  );
}
