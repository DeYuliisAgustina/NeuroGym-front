import { useState, type FormEvent } from 'react';
import { AreaTexto, Aviso, Boton, Cargando, EncabezadoPagina, Estado, Modal, Pestanas, Vacio } from '../../components/ui';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { EstadoEquipo } from '../../types';
import { fecha } from '../../utils/formato';

interface Equipo {
  id: number;
  nombre: string;
  categoria: string;
  estado: EstadoEquipo;
  disponible: boolean;
  mantenimientoHasta: string | null;
}
interface Incidencia {
  id: number;
  descripcion: string;
  estado: string;
  fecha: string;
  equipo: { nombre: string };
  archivos: { id: number; url: string; tipo: 'FOTO' | 'VIDEO' }[];
}

/** Equipamiento de mi sede y reporte de incidencias con fotos o videos (RF8). */
export function Equipamiento() {
  const [vista, setVista] = useState<'equipos' | 'reportes'>('equipos');
  const equipos = useApi(() => api.get<Equipo[]>('/socio/equipamiento'));
  const reportes = useApi(() => api.get<Incidencia[]>('/socio/incidencias'));
  const [reportando, setReportando] = useState<Equipo | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [archivos, setArchivos] = useState<FileList | null>(null);
  const accion = useAccion();

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!descripcion.trim()) return accion.setError('Describí la falla.');
    const datos = new FormData();
    datos.append('equipoId', String(reportando!.id));
    datos.append('descripcion', descripcion);
    Array.from(archivos ?? []).forEach((a) => datos.append('archivos', a));
    if (await accion.ejecutar(() => api.post('/socio/incidencias', datos), 'Gracias. Tu reporte fue enviado al gimnasio.')) {
      setReportando(null);
      setDescripcion('');
      setArchivos(null);
      void reportes.recargar();
    }
  };

  return (
    <div>
      <EncabezadoPagina titulo="Equipamiento" descripcion="Consultá la disponibilidad y avisá si algo no funciona. El gimnasio decide sobre cada equipo." />
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <Pestanas valor={vista} onCambiar={setVista} opciones={[{ valor: 'equipos', texto: 'Equipamiento de mi sede' }, { valor: 'reportes', texto: `Mis reportes (${reportes.datos?.length ?? 0})` }]} />
      {vista === 'equipos' && (
        <div className="tarjeta">
          {equipos.cargando && <Cargando />}
          {equipos.datos?.map((e) => (
            <div key={e.id} className="fila-entre" style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--borde)' }}>
              <div>
                <strong>{e.nombre}</strong>
                <div className="tenue" style={{ fontSize: '0.88rem' }}>
                  {e.categoria}
                  {e.mantenimientoHasta && ` · mantenimiento hasta ${fecha(e.mantenimientoHasta, true)}`}
                </div>
              </div>
              <div className="fila">
                <Estado valor={e.estado} />
                <Boton variante="texto" chico onClick={() => setReportando(e)}>
                  Reportar
                </Boton>
              </div>
            </div>
          ))}
        </div>
      )}
      {vista === 'reportes' && (
        <div className="pila">
          {reportes.datos?.length === 0 && <Vacio>No reportaste incidencias.</Vacio>}
          {reportes.datos?.map((r) => (
            <div key={r.id} className="tarjeta">
              <div className="fila-entre">
                <strong>{r.equipo.nombre}</strong>
                <Estado valor={r.estado} />
              </div>
              <p>{r.descripcion}</p>
              <small>{fecha(r.fecha, true)}</small>
              <div className="fila">
                {r.archivos.map((a) =>
                  a.tipo === 'FOTO' ? <img key={a.id} src={a.url} alt="Foto adjunta" style={{ width: 96, borderRadius: 10 }} /> : <video key={a.id} src={a.url} controls style={{ width: 160 }} />,
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal titulo={`Reportar falla: ${reportando?.nombre ?? ''}`} abierto={!!reportando} onCerrar={() => setReportando(null)}>
        <form onSubmit={enviar}>
          <Aviso tipo="error">{accion.error}</Aviso>
          <AreaTexto etiqueta="¿Qué pasa con el equipo?" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={2000} />
          <div className="campo">
            <label htmlFor="adjuntos">Fotos o videos (opcional, hasta 5)</label>
            <input id="adjuntos" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" capture="environment" multiple onChange={(e) => setArchivos(e.target.files)} />
          </div>
          <Boton type="submit" bloque cargando={accion.enviando}>
            Enviar reporte
          </Boton>
        </form>
      </Modal>
    </div>
  );
}
