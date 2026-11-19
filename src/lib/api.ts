import type {
  Aula,
  DiaSemana,
  Docente,
  EstadoReprogramacion,
  Estudiante,
  FranjaSugerida,
  Horario,
  Matricula,
  Reprogramacion,
  ResultadoValidacion,
  ResumenSistema,
} from '../types/academic';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  if (res.status === 204) {
    return undefined as T;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `Error del servidor (HTTP ${res.status})`) as Error & {
      status?: number;
      payload?: unknown;
    };
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data as T;
}

export const api = {
  getResumen: () => requestJson<ResumenSistema>('/api/resumen'),

  getDocentes: () => requestJson<Docente[]>('/api/docentes'),

  crearDocente: (body: { codigo: string; nombres: string; apellidos: string }) =>
    requestJson<Docente>('/api/docentes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getEstudiantes: (q = '', limit = 60) =>
    requestJson<{ total: number; items: Estudiante[] }>(
      `/api/estudiantes?q=${encodeURIComponent(q)}&limit=${limit}`
    ),

  crearEstudiante: (body: { codigo: string; nombres: string; apellidos: string }) =>
    requestJson<Estudiante>('/api/estudiantes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getAulas: (params?: { minAforo?: number; pabellon?: string }) => {
    const qs = new URLSearchParams();
    if (params?.minAforo) qs.set('minAforo', String(params.minAforo));
    if (params?.pabellon) qs.set('pabellon', params.pabellon);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<Aula[]>(`/api/aulas${suffix}`);
  },

  getHorarios: (params?: { docente?: string; estudiante?: string; aula?: string; curso?: string }) => {
    const qs = new URLSearchParams();
    if (params?.docente) qs.set('docente', params.docente);
    if (params?.estudiante) qs.set('estudiante', params.estudiante);
    if (params?.aula) qs.set('aula', params.aula);
    if (params?.curso) qs.set('curso', params.curso);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<Horario[]>(`/api/horarios${suffix}`);
  },

  crearHorario: (body: {
    docenteCodigo: string;
    curso: string;
    dia: DiaSemana;
    horaInicio: string;
    horaFin: string;
    aula: string;
  }) =>
    requestJson<Horario>('/api/horarios', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  crearMatricula: (body: { estudianteCodigo: string; curso: string }) =>
    requestJson<Matricula>('/api/matriculas', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getReprogramaciones: () => requestJson<Reprogramacion[]>('/api/reprogramaciones'),

  validarReprogramacion: (body: {
    docenteCodigo: string;
    curso: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    aula: string;
    bufferMinutos: number;
  }) =>
    requestJson<ResultadoValidacion>('/api/reprogramaciones/validar', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  sugerirFranjas: (body: {
    docenteCodigo: string;
    curso: string;
    fecha: string;
    duracionMin: number;
    bufferMinutos: number;
  }) =>
    requestJson<{ franjas: FranjaSugerida[] }>('/api/reprogramaciones/sugerir-franjas', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  crearReprogramacion: (body: {
    docenteCodigo: string;
    curso: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    aula: string;
    motivo: string;
    bufferMinutos: number;
  }) =>
    requestJson<{ reprogramacion: Reprogramacion; validacion: ResultadoValidacion }>(
      '/api/reprogramaciones',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    ),

  actualizarEstadoReprogramacion: (id: number, estado: EstadoReprogramacion) =>
    requestJson<Reprogramacion>(`/api/reprogramaciones/${id}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado }),
    }),

  eliminarReprogramacion: (id: number) =>
    requestJson<void>(`/api/reprogramaciones/${id}`, { method: 'DELETE' }),
};
