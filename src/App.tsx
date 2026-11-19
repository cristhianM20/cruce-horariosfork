import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  CalendarPlus,
  FileText,
  Home,
  Menu,
  Plus,
  X,
} from 'lucide-react';
import { api } from './lib/api';
import { InicioView } from './components/InicioView';
import {
  CalendarioSemanalView,
  type ModoCalendario,
} from './components/CalendarioSemanalView';
import {
  ReprogramacionView,
  type PresetReprogramacion,
} from './components/ReprogramacionView';
import { SolicitudesView } from './components/SolicitudesView';
import { CatalogoView } from './components/CatalogoView';
import type {
  Aula,
  Docente,
  Horario,
  Reprogramacion,
  ResumenSistema,
} from './types/academic';

type VistaActiva = 'inicio' | 'calendario' | 'reprogramacion' | 'solicitudes' | 'catalogo';

const SUBTITULOS_VISTA: Record<VistaActiva, { titulo: string; descripcion: string }> = {
  inicio: {
    titulo: 'Inicio',
    descripcion: 'Resumen del periodo académico, sesiones de hoy y solicitudes de reprogramación.',
  },
  calendario: {
    titulo: 'Calendario',
    descripcion:
      'Organiza tus actividades y mantente al tanto de tus clases, aulas y reprogramaciones sin cruces.',
  },
  reprogramacion: {
    titulo: 'Reprogramar Clase',
    descripcion:
      'Valida en tiempo real cruces del docente, disponibilidad estudiantil, intervalo de 15 minutos y aforo de aula.',
  },
  solicitudes: {
    titulo: 'Trámites y Solicitudes',
    descripcion: 'Revisa, confirma o imprime las constancias de reprogramaciones académicas.',
  },
  catalogo: {
    titulo: 'Catálogo Académico',
    descripcion: 'Administra docentes, población estudiantil, matrículas, aulas y horarios regulares.',
  },
};

export default function App() {
  const [vista, setVista] = useState<VistaActiva>('calendario');
  const [menuExpandido, setMenuExpandido] = useState<boolean>(false);

  const [resumen, setResumen] = useState<ResumenSistema | null>(null);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [todosHorarios, setTodosHorarios] = useState<Horario[]>([]);
  const [reprogramaciones, setReprogramaciones] = useState<Reprogramacion[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorCarga, setErrorCarga] = useState<string>('');

  const [calendarioTarget, setCalendarioTarget] = useState<{
    modo: ModoCalendario;
    entidad?: string;
  }>({ modo: 'docente', entidad: 'DOC-101' });

  const [presetReprog, setPresetReprog] = useState<PresetReprogramacion | null>(null);
  const [solicitudSeleccionadaId, setSolicitudSeleccionadaId] = useState<number | null>(null);

  const cargarTodo = useCallback(async () => {
    try {
      const [res, docs, aul, hors, reps] = await Promise.all([
        api.getResumen(),
        api.getDocentes(),
        api.getAulas(),
        api.getHorarios(),
        api.getReprogramaciones(),
      ]);
      setResumen(res);
      setDocentes(docs);
      setAulas(aul);
      setTodosHorarios(hors);
      setReprogramaciones(reps);
      setErrorCarga('');
    } catch (err) {
      setErrorCarga(
        err instanceof Error ? err.message : 'No se pudieron cargar los datos académicos.'
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  const abrirCalendarioEntidad = (modo: ModoCalendario, codigo?: string) => {
    setCalendarioTarget({ modo, entidad: codigo });
    setVista('calendario');
    setMenuExpandido(false);
  };

  const irAReprogramarConPreset = (preset: PresetReprogramacion) => {
    setPresetReprog(preset);
    setVista('reprogramacion');
    setMenuExpandido(false);
  };

  const handleReprogramacionCreada = (rep: Reprogramacion) => {
    setSolicitudSeleccionadaId(rep.id);
    cargarTodo();
  };

  const navItems: {
    id: VistaActiva;
    label: string;
    labelCorto: string;
    icon: typeof CalendarDays;
    count?: number;
  }[] = [
    { id: 'inicio', label: 'Inicio', labelCorto: 'Inicio', icon: Home },
    { id: 'calendario', label: 'Calendario', labelCorto: 'Calendario', icon: CalendarDays },
    {
      id: 'reprogramacion',
      label: 'Reprogramar Clase',
      labelCorto: 'Reprogramar',
      icon: CalendarPlus,
    },
    {
      id: 'solicitudes',
      label: 'Trámites y Actas',
      labelCorto: 'Trámites',
      icon: FileText,
      count: resumen?.reprogramacionesSolicitadas,
    },
    { id: 'catalogo', label: 'Catálogo Académico', labelCorto: 'Catálogo', icon: BookOpen },
  ];

  const metaVista = SUBTITULOS_VISTA[vista];

  return (
    <div className="min-h-screen bg-[#EDF3FA] text-[#161C2D] flex">
      {/* Rail lateral fijo estilo UTP+portal (desktop) */}
      <aside className="hidden md:flex md:flex-col md:w-[76px] md:fixed md:inset-y-0 bg-white border-r border-[#DCE6F2] z-30 select-none">
        {/* Bloque coral superior con botón de menú */}
        <button
          type="button"
          aria-label="Expandir menú de navegación"
          onClick={() => setMenuExpandido(true)}
          className="h-16 w-full bg-[#F05A66] hover:bg-[#E04856] text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Íconos verticales con etiqueta centrada */}
        <nav aria-label="Navegación principal" className="flex-1 py-2 flex flex-col">
          {navItems.map((item) => {
            const Icon = item.icon;
            const activa = vista === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setVista(item.id)}
                className={`relative w-full py-3.5 px-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activa
                    ? 'bg-[#EEF3FA] text-[#161C2D] font-semibold'
                    : 'text-[#4B5563] hover:bg-[#F7FAFE] hover:text-[#161C2D]'
                }`}
              >
                {activa && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#F05A66]"
                  />
                )}
                <div className="relative">
                  <Icon className="w-5 h-5 stroke-[1.75]" />
                  {item.count != null && item.count > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#F05A66] text-white text-[10px] font-mono tabular-nums font-semibold flex items-center justify-center">
                      {item.count}
                    </span>
                  )}
                </div>
                <span className="text-[11px] leading-tight text-center whitespace-nowrap">
                  {item.labelCorto}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Drawer expandible (móvil y al pulsar el botón coral del rail) */}
      {menuExpandido && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-[#161C2D]/35"
            onClick={() => setMenuExpandido(false)}
          />
          <aside className="relative w-64 max-w-[82vw] bg-white h-full flex flex-col border-r border-[#DCE6F2] z-10 shadow-xl">
            <div className="h-16 px-4 bg-[#F05A66] text-white flex items-center justify-between">
              <span className="font-semibold text-sm tracking-tight">UTP+portal · Horarios</span>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setMenuExpandido(false)}
                className="p-1.5 rounded-md hover:bg-white/15 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-3 px-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const activa = vista === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setVista(item.id);
                      setMenuExpandido(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                      activa
                        ? 'bg-[#EEF3FA] text-[#25206E] font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="inline-flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </span>
                    {item.count != null && item.count > 0 && (
                      <span className="text-xs font-mono tabular-nums font-semibold text-[#F05A66]">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            {resumen && (
              <div className="px-5 py-4 border-t border-[#DCE6F2] text-xs space-y-1.5 text-slate-600">
                <p className="font-semibold text-[#161C2D]">Catálogo cargado</p>
                <p className="font-mono tabular-nums">
                  {resumen.totalDocentes} docentes · {resumen.totalEstudiantes} alumnos
                </p>
                <p className="font-mono tabular-nums">
                  {resumen.totalHorarios} sesiones · {resumen.totalAulas} aulas
                </p>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Contenido principal con margen del rail */}
      <div className="flex-1 md:pl-[76px] flex flex-col min-w-0">
        {/* Top bar estilo UTP+portal */}
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-[#DCE6F2] px-4 sm:px-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Abrir menú"
              onClick={() => setMenuExpandido(true)}
              className="md:hidden w-10 h-10 -ml-2 rounded-lg bg-[#F05A66] text-white flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Lockup UTP +portal */}
            <button
              type="button"
              onClick={() => setVista('inicio')}
              className="inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 focus:outline-none"
            >
              <span className="inline-flex items-center gap-[3px]">
                <span className="w-6 h-6 bg-[#161C2D] text-white font-bold text-sm flex items-center justify-center leading-none">
                  U
                </span>
                <span className="w-6 h-6 bg-[#161C2D] text-white font-bold text-sm flex items-center justify-center leading-none">
                  T
                </span>
                <span className="w-6 h-6 bg-[#161C2D] text-white font-bold text-sm flex items-center justify-center leading-none">
                  P
                </span>
              </span>
              <span className="text-xl font-bold tracking-tight leading-none">
                <span className="text-[#F05A66]">+</span>
                <span className="text-[#161C2D]">portal</span>
              </span>
            </button>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {vista !== 'reprogramacion' ? (
              <button
                type="button"
                onClick={() => {
                  setPresetReprog(null);
                  setVista('reprogramacion');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#5B4AE6] text-white text-xs font-semibold hover:bg-[#4838CC] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Reprogramar clase
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setVista('solicitudes')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-[#25206E] bg-white text-[#25206E] text-xs font-semibold hover:bg-[#EEF3FA] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                Ver trámites
              </button>
            )}
          </div>
        </header>

        {/* Workspace sobre lienzo celeste suave #EDF3FA */}
        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1440px] w-full mx-auto space-y-5">
          {vista !== 'inicio' && (
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold text-[#161C2D] tracking-tight">
                {metaVista.titulo}
              </h1>
              <p className="text-xs sm:text-sm text-[#4B5563]">{metaVista.descripcion}</p>
            </div>
          )}

          {errorCarga && (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
              {errorCarga}
            </div>
          )}

          {cargando ? (
            <div className="bg-white border border-[#DCE6F2] rounded-xl p-8 space-y-4">
              <div className="h-6 w-56 bg-[#EDF3FA] rounded animate-pulse" />
              <div className="h-80 bg-[#EDF3FA] rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              {vista === 'inicio' && (
                <InicioView
                  resumen={resumen}
                  todosHorarios={todosHorarios}
                  reprogramaciones={reprogramaciones}
                  onAbrirCalendario={abrirCalendarioEntidad}
                  onIrAReprogramar={() => {
                    setPresetReprog(null);
                    setVista('reprogramacion');
                  }}
                  onIrASolicitudes={() => setVista('solicitudes')}
                  onIrACatalogo={() => setVista('catalogo')}
                />
              )}

              {vista === 'calendario' && (
                <CalendarioSemanalView
                  docentes={docentes}
                  aulas={aulas}
                  reprogramaciones={reprogramaciones}
                  modoInicial={calendarioTarget.modo}
                  entidadInicial={calendarioTarget.entidad}
                  onIrAReprogramar={irAReprogramarConPreset}
                />
              )}

              {vista === 'reprogramacion' && (
                <ReprogramacionView
                  docentes={docentes}
                  aulas={aulas}
                  todosHorarios={todosHorarios}
                  preset={presetReprog}
                  onReprogramacionCreada={handleReprogramacionCreada}
                />
              )}

              {vista === 'solicitudes' && (
                <SolicitudesView
                  reprogramaciones={reprogramaciones}
                  seleccionadaId={solicitudSeleccionadaId}
                  onRefrescar={cargarTodo}
                  onIrANueva={() => {
                    setPresetReprog(null);
                    setVista('reprogramacion');
                  }}
                />
              )}

              {vista === 'catalogo' && (
                <CatalogoView
                  docentes={docentes}
                  aulas={aulas}
                  cursosUnicos={resumen?.cursosUnicos ?? []}
                  onAbrirCalendario={abrirCalendarioEntidad}
                  onDatosActualizados={cargarTodo}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
