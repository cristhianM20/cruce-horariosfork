import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Plus,
  Search,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { DIAS_ES, DIAS_ORDEN } from '../lib/time';
import type { Aula, DiaSemana, Docente, Estudiante } from '../types/academic';
import type { ModoCalendario } from './CalendarioSemanalView';

interface CatalogoViewProps {
  docentes: Docente[];
  aulas: Aula[];
  cursosUnicos: string[];
  onAbrirCalendario: (modo: ModoCalendario, codigo: string) => void;
  onDatosActualizados: () => void;
}

type SubTab = 'docentes' | 'estudiantes' | 'aulas';

export function CatalogoView({
  docentes,
  aulas,
  cursosUnicos,
  onAbrirCalendario,
  onDatosActualizados,
}: CatalogoViewProps) {
  const [tab, setTab] = useState<SubTab>('docentes');
  const [busqueda, setBusqueda] = useState<string>('');
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [totalEstudiantes, setTotalEstudiantes] = useState<number>(0);

  // Form states
  const [docForm, setDocForm] = useState({ codigo: '', nombres: '', apellidos: '' });
  const [estForm, setEstForm] = useState({ codigo: '', nombres: '', apellidos: '' });
  const [matForm, setMatForm] = useState({
    estudianteCodigo: 'U23231304',
    curso: cursosUnicos[0] || 'Desarrollo Web Integrado',
  });
  const [horForm, setHorForm] = useState({
    docenteCodigo: docentes[0]?.codigo || 'DOC-101',
    curso: cursosUnicos[0] || 'Desarrollo Web Integrado',
    dia: 'SATURDAY' as DiaSemana,
    horaInicio: '08:00',
    horaFin: '10:00',
    aula: aulas[0]?.codigo || 'A0101',
  });

  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    if (tab !== 'estudiantes') return;
    let cancelado = false;
    const timer = setTimeout(() => {
      api
        .getEstudiantes(busqueda, 80)
        .then((res) => {
          if (!cancelado) {
            setEstudiantes(res.items);
            setTotalEstudiantes(res.total);
          }
        })
        .catch(() => {});
    }, 120);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [tab, busqueda]);

  const docentesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return docentes;
    return docentes.filter(
      (d) =>
        d.codigo.toLowerCase().includes(q) ||
        `${d.nombres} ${d.apellidos}`.toLowerCase().includes(q)
    );
  }, [docentes, busqueda]);

  const aulasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return aulas;
    return aulas.filter(
      (a) =>
        a.codigo.toLowerCase().includes(q) ||
        a.pabellon.toLowerCase().includes(q) ||
        a.sede.toLowerCase().includes(q)
    );
  }, [aulas, busqueda]);

  const handleCrearDocente = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const creado = await api.crearDocente(docForm);
      setDocForm({ codigo: '', nombres: '', apellidos: '' });
      setFeedback({ tipo: 'ok', texto: `Docente ${creado.codigo} registrado correctamente.` });
      onDatosActualizados();
    } catch (err) {
      setFeedback({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'Error al registrar docente.',
      });
    }
  };

  const handleCrearEstudiante = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const creado = await api.crearEstudiante(estForm);
      setEstForm({ codigo: '', nombres: '', apellidos: '' });
      setFeedback({ tipo: 'ok', texto: `Estudiante ${creado.codigo} registrado correctamente.` });
      onDatosActualizados();
      const res = await api.getEstudiantes(busqueda, 80);
      setEstudiantes(res.items);
      setTotalEstudiantes(res.total);
    } catch (err) {
      setFeedback({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'Error al registrar estudiante.',
      });
    }
  };

  const handleMatricular = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await api.crearMatricula(matForm);
      setFeedback({
        tipo: 'ok',
        texto: `Matrícula registrada para ${matForm.estudianteCodigo.toUpperCase()} en "${matForm.curso}".`,
      });
      onDatosActualizados();
      const res = await api.getEstudiantes(busqueda, 80);
      setEstudiantes(res.items);
      setTotalEstudiantes(res.total);
    } catch (err) {
      setFeedback({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'Error al registrar matrícula.',
      });
    }
  };

  const handleCrearHorario = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const creado = await api.crearHorario(horForm);
      setFeedback({
        tipo: 'ok',
        texto: `Bloque regular creado: ${creado.curso} (${DIAS_ES[creado.dia]} ${creado.horaInicio}–${creado.horaFin}, aula ${creado.aula}).`,
      });
      onDatosActualizados();
    } catch (err) {
      setFeedback({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'Conflicto al registrar horario regular.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => {
              setTab('docentes');
              setBusqueda('');
              setFeedback(null);
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'docentes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Docentes ({docentes.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('estudiantes');
              setBusqueda('');
              setFeedback(null);
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'estudiantes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Estudiantes ({totalEstudiantes || 1000})
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('aulas');
              setBusqueda('');
              setFeedback(null);
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'aulas'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Aulas y Horarios ({aulas.length})
          </button>
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={
              tab === 'docentes'
                ? 'Buscar docente por código o nombre...'
                : tab === 'estudiantes'
                  ? 'Buscar entre 1,000 estudiantes...'
                  : 'Buscar aula, pabellón o sede...'
            }
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B4AE6]/25 focus:border-[#5B4AE6]"
          />
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-xs flex items-center gap-2 ${
            feedback.tipo === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]'
          }`}
        >
          {feedback.tipo === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-[#C8102E] shrink-0" />
          )}
          <span>{feedback.texto}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Tabla principal */}
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {tab === 'docentes' && (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Código</th>
                    <th className="py-3 px-4 font-semibold">Nombre completo</th>
                    <th className="py-3 px-4 font-semibold text-right">Cursos</th>
                    <th className="py-3 px-4 font-semibold text-right">Horas/sem</th>
                    <th className="py-3 px-4 font-semibold text-right">Calendario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {docentesFiltrados.map((d) => (
                    <tr key={d.codigo} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono tabular-nums font-semibold text-slate-900">
                        {d.codigo}
                      </td>
                      <td className="py-2.5 px-4 text-slate-800">
                        {d.nombres} {d.apellidos}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-right text-slate-700">
                        {d.cursosCount ?? 0}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-right text-slate-700">
                        {d.horasSemanales ?? 0} h
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onAbrirCalendario('docente', d.codigo)}
                          className="inline-flex items-center gap-1 text-[#5B4AE6] font-semibold hover:underline cursor-pointer"
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          Ver horario
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'estudiantes' && (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Código</th>
                    <th className="py-3 px-4 font-semibold">Estudiante</th>
                    <th className="py-3 px-4 font-semibold">Cursos matriculados</th>
                    <th className="py-3 px-4 font-semibold text-right">Calendario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {estudiantes.map((e) => (
                    <tr key={e.codigo} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {e.codigo}
                      </td>
                      <td className="py-2.5 px-4 text-slate-800 whitespace-nowrap">
                        {e.nombres} {e.apellidos}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {e.cursos && e.cursos.length > 0 ? e.cursos.join(' · ') : 'Sin matrículas'}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onAbrirCalendario('estudiante', e.codigo)}
                          className="inline-flex items-center gap-1 text-[#5B4AE6] font-semibold hover:underline cursor-pointer"
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          Ver horario
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalEstudiantes > estudiantes.length && (
                <div className="px-4 py-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                  Mostrando {estudiantes.length} de {totalEstudiantes} resultados. Usa el buscador para
                  filtrar alumnos específicos.
                </div>
              )}
            </div>
          )}

          {tab === 'aulas' && (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Aula</th>
                    <th className="py-3 px-4 font-semibold">Pabellón</th>
                    <th className="py-3 px-4 font-semibold">Sede</th>
                    <th className="py-3 px-4 font-semibold text-right">Aforo</th>
                    <th className="py-3 px-4 font-semibold text-right">Ocupación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {aulasFiltradas.map((a) => (
                    <tr key={a.codigo} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono tabular-nums font-semibold text-slate-900">
                        {a.codigo}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">Pabellón {a.pabellon}</td>
                      <td className="py-2.5 px-4 text-slate-600">{a.sede}</td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-right font-semibold text-slate-900">
                        {a.aforo}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onAbrirCalendario('aula', a.codigo)}
                          className="inline-flex items-center gap-1 text-[#5B4AE6] font-semibold hover:underline cursor-pointer"
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          Ver agenda
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Panel derecho de altas / registro */}
        <aside className="xl:col-span-4 space-y-6">
          {tab === 'docentes' && (
            <form
              onSubmit={handleCrearDocente}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Registrar nuevo docente</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Agrega un docente al catálogo para asignarle bloques horarios.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Código</label>
                  <input
                    type="text"
                    required
                    value={docForm.codigo}
                    onChange={(e) => setDocForm({ ...docForm, codigo: e.target.value })}
                    placeholder="Ej. DOC-151"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nombres</label>
                  <input
                    type="text"
                    required
                    value={docForm.nombres}
                    onChange={(e) => setDocForm({ ...docForm, nombres: e.target.value })}
                    placeholder="Nombres"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Apellidos</label>
                  <input
                    type="text"
                    required
                    value={docForm.apellidos}
                    onChange={(e) => setDocForm({ ...docForm, apellidos: e.target.value })}
                    placeholder="Apellidos"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#5B4AE6] text-white text-xs font-semibold hover:bg-[#4838CC] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar docente
              </button>
            </form>
          )}

          {tab === 'estudiantes' && (
            <>
              <form
                onSubmit={handleCrearEstudiante}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
              >
                <h3 className="text-sm font-semibold text-slate-900">Registrar estudiante</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    required
                    value={estForm.codigo}
                    onChange={(e) => setEstForm({ ...estForm, codigo: e.target.value })}
                    placeholder="Código (ej. U25000100)"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono text-slate-900"
                  />
                  <input
                    type="text"
                    required
                    value={estForm.nombres}
                    onChange={(e) => setEstForm({ ...estForm, nombres: e.target.value })}
                    placeholder="Nombres"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900"
                  />
                  <input
                    type="text"
                    required
                    value={estForm.apellidos}
                    onChange={(e) => setEstForm({ ...estForm, apellidos: e.target.value })}
                    placeholder="Apellidos"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#5B4AE6] text-white text-xs font-semibold hover:bg-[#4838CC] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar estudiante
                </button>
              </form>

              <form
                onSubmit={handleMatricular}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
              >
                <h3 className="text-sm font-semibold text-slate-900">Matricular en curso</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    required
                    value={matForm.estudianteCodigo}
                    onChange={(e) => setMatForm({ ...matForm, estudianteCodigo: e.target.value })}
                    placeholder="Código de estudiante"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono text-slate-900"
                  />
                  <select
                    value={matForm.curso}
                    onChange={(e) => setMatForm({ ...matForm, curso: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                  >
                    {cursosUnicos.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Registrar matrícula
                </button>
              </form>
            </>
          )}

          {tab === 'aulas' && (
            <form
              onSubmit={handleCrearHorario}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Asignar bloque de horario regular
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Valida automáticamente cruce docente y de aula respetando 15 min de traslado.
                </p>
              </div>

              <div className="space-y-3">
                <select
                  value={horForm.docenteCodigo}
                  onChange={(e) => setHorForm({ ...horForm, docenteCodigo: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                >
                  {docentes.map((d) => (
                    <option key={d.codigo} value={d.codigo}>
                      {d.codigo} — {d.nombres} {d.apellidos}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  required
                  value={horForm.curso}
                  onChange={(e) => setHorForm({ ...horForm, curso: e.target.value })}
                  placeholder="Nombre del curso"
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900"
                />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={horForm.dia}
                    onChange={(e) => setHorForm({ ...horForm, dia: e.target.value as DiaSemana })}
                    className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                  >
                    {DIAS_ORDEN.map((d) => (
                      <option key={d} value={d}>
                        {DIAS_ES[d]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={horForm.aula}
                    onChange={(e) => setHorForm({ ...horForm, aula: e.target.value })}
                    className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900"
                  >
                    {aulas.map((a) => (
                      <option key={a.codigo} value={a.codigo}>
                        {a.codigo} (Af. {a.aforo})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    required
                    value={horForm.horaInicio}
                    onChange={(e) => setHorForm({ ...horForm, horaInicio: e.target.value })}
                    className="h-9 px-2.5 rounded-lg border border-slate-300 text-sm font-mono text-slate-900"
                  />
                  <input
                    type="time"
                    required
                    value={horForm.horaFin}
                    onChange={(e) => setHorForm({ ...horForm, horaFin: e.target.value })}
                    className="h-9 px-2.5 rounded-lg border border-slate-300 text-sm font-mono text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#5B4AE6] text-white text-xs font-semibold hover:bg-[#4838CC] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar bloque regular
              </button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
