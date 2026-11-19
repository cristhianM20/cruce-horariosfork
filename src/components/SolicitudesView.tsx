import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileCheck2,
  Printer,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatearFechaCorta } from '../lib/time';
import type { EstadoReprogramacion, Reprogramacion } from '../types/academic';

interface SolicitudesViewProps {
  reprogramaciones: Reprogramacion[];
  seleccionadaId: number | null;
  onRefrescar: () => void;
  onIrANueva: () => void;
}

type FiltroEstado = 'TODAS' | EstadoReprogramacion;

export function SolicitudesView({
  reprogramaciones,
  seleccionadaId,
  onRefrescar,
  onIrANueva,
}: SolicitudesViewProps) {
  const [filtro, setFiltro] = useState<FiltroEstado>('TODAS');
  const [busqueda, setBusqueda] = useState<string>('');
  const [detalleId, setDetalleId] = useState<number | null>(
    seleccionadaId ?? reprogramaciones[0]?.id ?? null
  );
  const [ocupadoId, setOcupadoId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return reprogramaciones.filter((r) => {
      if (filtro !== 'TODAS' && r.estado !== filtro) return false;
      if (!q) return true;
      return (
        r.codigoSolicitud.toLowerCase().includes(q) ||
        r.curso.toLowerCase().includes(q) ||
        r.docenteCodigo.toLowerCase().includes(q) ||
        (r.docenteNombre || '').toLowerCase().includes(q) ||
        r.aula.toLowerCase().includes(q)
      );
    });
  }, [reprogramaciones, filtro, busqueda]);

  const detalleActual = useMemo(
    () =>
      reprogramaciones.find((r) => r.id === detalleId) ??
      filtradas[0] ??
      null,
    [reprogramaciones, filtradas, detalleId]
  );

  const conteos = useMemo(
    () => ({
      TODAS: reprogramaciones.length,
      SOLICITADO: reprogramaciones.filter((r) => r.estado === 'SOLICITADO').length,
      CONFIRMADO: reprogramaciones.filter((r) => r.estado === 'CONFIRMADO').length,
      RECHAZADO: reprogramaciones.filter((r) => r.estado === 'RECHAZADO').length,
    }),
    [reprogramaciones]
  );

  const cambiarEstado = async (id: number, estado: EstadoReprogramacion) => {
    setOcupadoId(id);
    setError('');
    try {
      await api.actualizarEstadoReprogramacion(id, estado);
      onRefrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado.');
    } finally {
      setOcupadoId(null);
    }
  };

  const eliminar = async (id: number) => {
    setOcupadoId(id);
    setError('');
    try {
      await api.eliminarReprogramacion(id);
      if (detalleId === id) setDetalleId(null);
      onRefrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la solicitud.');
    } finally {
      setOcupadoId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start overflow-x-auto max-w-full">
          {(
            [
              ['TODAS', 'Todas'],
              ['SOLICITADO', 'Solicitadas'],
              ['CONFIRMADO', 'Confirmadas'],
              ['RECHAZADO', 'Rechazadas'],
            ] as [FiltroEstado, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFiltro(key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filtro === key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}{' '}
              <span className="font-mono tabular-nums text-slate-400 ml-1">{conteos[key]}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Filtrar por código, curso, docente o aula..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B4AE6]/25 focus:border-[#5B4AE6]"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs text-[#991B1B]">
          {error}
        </div>
      )}

      {/* Tabla + Constancia */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filtradas.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                No hay solicitudes que coincidan con este filtro.
              </p>
              <p className="text-xs text-slate-500">
                Registra una nueva reprogramación validada para que aparezca en la bandeja.
              </p>
              <button
                type="button"
                onClick={onIrANueva}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#5B4AE6] text-white text-xs font-semibold hover:bg-[#4838CC] transition-colors cursor-pointer"
              >
                Nueva reprogramación
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Solicitud</th>
                    <th className="py-3 px-4 font-semibold">Curso y Docente</th>
                    <th className="py-3 px-4 font-semibold">Fecha y Franja</th>
                    <th className="py-3 px-4 font-semibold">Aula</th>
                    <th className="py-3 px-4 font-semibold text-right">Asistencia</th>
                    <th className="py-3 px-4 font-semibold">Estado</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtradas.map((r) => {
                    const activo = detalleActual?.id === r.id;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setDetalleId(r.id)}
                        className={`transition-colors cursor-pointer ${
                          activo ? 'bg-[#EFF6FF]/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {r.codigoSolicitud}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{r.curso}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {r.docenteNombre} · <span className="font-mono">{r.docenteCodigo}</span>
                          </p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <p className="text-slate-800">{formatearFechaCorta(r.fecha)}</p>
                          <p className="font-mono tabular-nums text-[11px] text-slate-500">
                            {r.horaInicio}–{r.horaFin}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-800 whitespace-nowrap">
                          {r.aula}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-900 whitespace-nowrap">
                          {r.porcentajeAsistencia != null ? `${r.porcentajeAsistencia}%` : '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              r.estado === 'CONFIRMADO'
                                ? 'text-emerald-700'
                                : r.estado === 'RECHAZADO'
                                  ? 'text-[#C8102E]'
                                  : 'text-[#5B4AE6]'
                            }`}
                          >
                            {r.estado === 'CONFIRMADO' ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : r.estado === 'RECHAZADO' ? (
                              <XCircle className="w-3.5 h-3.5" />
                            ) : (
                              <Clock className="w-3.5 h-3.5" />
                            )}
                            {r.estado === 'CONFIRMADO'
                              ? 'Confirmado'
                              : r.estado === 'RECHAZADO'
                                ? 'Rechazado'
                                : 'Solicitado'}
                          </span>
                        </td>
                        <td
                          className="py-3 px-4 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            {r.estado !== 'CONFIRMADO' && (
                              <button
                                type="button"
                                disabled={ocupadoId === r.id}
                                onClick={() => cambiarEstado(r.id, 'CONFIRMADO')}
                                className="px-2.5 py-1 rounded-md bg-[#5B4AE6] text-white text-[11px] font-semibold hover:bg-[#4838CC] disabled:opacity-50 transition-colors cursor-pointer"
                              >
                                Confirmar
                              </button>
                            )}
                            {r.estado === 'SOLICITADO' && (
                              <button
                                type="button"
                                disabled={ocupadoId === r.id}
                                onClick={() => cambiarEstado(r.id, 'RECHAZADO')}
                                className="px-2.5 py-1 rounded-md border border-slate-300 text-slate-700 text-[11px] font-medium hover:border-[#C8102E] hover:text-[#C8102E] disabled:opacity-50 transition-colors cursor-pointer"
                              >
                                Rechazar
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label={`Eliminar ${r.codigoSolicitud}`}
                              disabled={ocupadoId === r.id}
                              onClick={() => eliminar(r.id)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-[#C8102E] hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Constancia detallada */}
        <aside className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          {detalleActual ? (
            <>
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-xs font-mono font-semibold text-[#5B4AE6]">
                    {detalleActual.codigoSolicitud}
                  </p>
                  <h2 className="text-base font-semibold text-slate-900 mt-1">
                    Constancia de reprogramación
                  </h2>
                </div>
                <FileCheck2 className="w-5 h-5 text-slate-400 shrink-0" />
              </div>

              <dl className="space-y-3 text-xs">
                <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Estado actual</dt>
                  <dd
                    className={`font-semibold ${
                      detalleActual.estado === 'CONFIRMADO'
                        ? 'text-emerald-700'
                        : detalleActual.estado === 'RECHAZADO'
                          ? 'text-[#C8102E]'
                          : 'text-[#5B4AE6]'
                    }`}
                  >
                    {detalleActual.estado}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Curso</dt>
                  <dd className="font-semibold text-slate-900 text-right">{detalleActual.curso}</dd>
                </div>
                <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Docente</dt>
                  <dd className="text-slate-900 text-right">
                    {detalleActual.docenteNombre} ({detalleActual.docenteCodigo})
                  </dd>
                </div>
                <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Fecha y franja</dt>
                  <dd className="font-mono tabular-nums text-slate-900 text-right">
                    {formatearFechaCorta(detalleActual.fecha)} · {detalleActual.horaInicio}–
                    {detalleActual.horaFin}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Aula reservada</dt>
                  <dd className="font-mono tabular-nums font-semibold text-slate-900">
                    {detalleActual.aula}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Disponibilidad estudiantil</dt>
                  <dd className="font-mono tabular-nums font-semibold text-emerald-700">
                    {detalleActual.porcentajeAsistencia ?? 100}% ({detalleActual.disponibles ?? 0}/
                    {detalleActual.totalEstudiantes ?? 0})
                  </dd>
                </div>
                <div className="pt-1">
                  <dt className="text-slate-500 mb-1">Motivo registrado</dt>
                  <dd className="text-slate-700 leading-relaxed">
                    {detalleActual.motivo || 'Recuperación académica programada'}
                  </dd>
                </div>
              </dl>

              <div className="flex items-center gap-2 pt-2">
                {detalleActual.estado === 'SOLICITADO' && (
                  <button
                    type="button"
                    disabled={ocupadoId === detalleActual.id}
                    onClick={() => cambiarEstado(detalleActual.id, 'CONFIRMADO')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#5B4AE6] text-white text-xs font-semibold hover:bg-[#4838CC] transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Confirmar solicitud
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              Selecciona una solicitud en la tabla para consultar o imprimir su constancia.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
