import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Building2, Clock, Search, X } from 'lucide-react';

export interface AlertaDetalle {
  id: string;
  categoria: 'cruce' | 'aforo';
  etiqueta: string;
  mensaje: string;
}

interface NotificacionFlotanteProps {
  visible: boolean;
  titulo: string;
  resumenMeta: string;
  detalles: AlertaDetalle[];
  claveEvento: string;
  autoCierreMs?: number;
  onCerrar: () => void;
  onSugerirFranjas?: () => void;
  buscandoSugerencias?: boolean;
}

export function NotificacionFlotante({
  visible,
  titulo,
  resumenMeta,
  detalles,
  claveEvento,
  autoCierreMs = 9000,
  onCerrar,
  onSugerirFranjas,
  buscandoSugerencias = false,
}: NotificacionFlotanteProps) {
  const prefersReducedMotion = useReducedMotion();
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (!visible || pausado || autoCierreMs <= 0) return;
    const timer = setTimeout(() => {
      onCerrar();
    }, autoCierreMs);
    return () => clearTimeout(timer);
  }, [visible, pausado, claveEvento, autoCierreMs, onCerrar]);

  return (
    <div
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:bottom-5 sm:right-5 sm:w-[420px] z-50 pointer-events-none"
      aria-live="assertive"
      aria-atomic="true"
    >
      <AnimatePresence mode="wait">
        {visible && detalles.length > 0 && (
          <motion.div
            key={claveEvento}
            role="alert"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onMouseEnter={() => setPausado(true)}
            onMouseLeave={() => setPausado(false)}
            onFocus={() => setPausado(true)}
            onBlur={() => setPausado(false)}
            className="pointer-events-auto bg-white border border-[#FECACA] rounded-xl shadow-lg shadow-slate-900/10 p-4 space-y-3"
          >
            {/* Cabecera de alerta */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertTriangle className="w-4 h-4 text-[#C8102E] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 leading-snug">{titulo}</p>
                  <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5 truncate">
                    {resumenMeta}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onCerrar}
                aria-label="Cerrar notificación"
                className="p-1 -mr-1 -mt-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4AE6]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Lista concisa de conflictos detectados */}
            <ul className="space-y-2 border-t border-slate-100 pt-2.5">
              {detalles.slice(0, 3).map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-xs leading-relaxed">
                  {item.categoria === 'aforo' ? (
                    <Building2 className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-[#C8102E] shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900">{item.etiqueta}: </span>
                    <span className="text-slate-600">{item.mensaje}</span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Acciones */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
              {onSugerirFranjas ? (
                <button
                  type="button"
                  onClick={onSugerirFranjas}
                  disabled={buscandoSugerencias}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#5B4AE6] text-white text-xs font-semibold hover:bg-[#4838CC] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Search className="w-3.5 h-3.5" />
                  {buscandoSugerencias ? 'Buscando...' : 'Sugerir franjas libres'}
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={onCerrar}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
