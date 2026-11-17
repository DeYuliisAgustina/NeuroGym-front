import { useState } from 'react';
import { api } from '../services/api';
import type { Comprobante } from '../types';
import { dinero, fechaLarga, mesAnio, MEDIO_PROTOTIPO, conSede } from '../utils/formato';
import { Icono } from './Icono';
import { Boton, ErrorFormulario, FilaDato, Insignia, Marca, Modal } from './ui';

/**
 * Texto del estado del envío por WhatsApp según lo que informó el proveedor.
 * Solo «enviado», «entregado» o «leído» indican que el mensaje salió; nunca se
 * muestra como enviado algo que el proveedor no confirmó.
 */
export function estadoEnvioWhatsapp(c: Pick<Comprobante, 'envioWhatsapp'>): string {
  const e = c.envioWhatsapp;
  const dia = (f: string | null) => (f ? ` · ${fechaLarga(f, false)}` : '');
  switch (e?.estado) {
    case 'LEIDO':
      return `WhatsApp: leído${dia(e.fechaLeido)}`;
    case 'ENTREGADO':
      return `WhatsApp: entregado${dia(e.fechaEntregado)}`;
    case 'ENVIADO':
      return `WhatsApp: enviado${dia(e.fechaEnviado)}, entrega sin confirmar`;
    case 'ACEPTADO':
      return 'WhatsApp: solicitud aceptada por el proveedor, envío sin confirmar';
    case 'PREPARADO':
      return 'WhatsApp: preparado, pendiente de envío';
    case 'FALLIDO':
      return 'WhatsApp: no se pudo enviar. El comprobante queda disponible en el historial';
    case 'OMITIDO':
      return 'WhatsApp: no enviado (entorno de prueba)';
    case 'SIMULADO':
      return 'WhatsApp: simulación, no se envió';
    default:
      return 'WhatsApp: sin envío confirmado';
  }
}

/** Filas de la composición del importe (feeBreakdown del prototipo). */
export function Composicion({ cuotaBase, adicionalPremium, descuento, plan }: { cuotaBase: number; adicionalPremium: number; descuento: number; plan?: string }) {
  return (
    <>
      <FilaDato etiqueta="Cuota del gimnasio · Básico">{dinero(cuotaBase)}</FilaDato>
      {(adicionalPremium > 0 || plan === 'Premium') && <FilaDato etiqueta="Adicional Premium">{dinero(adicionalPremium)}</FilaDato>}
      {descuento > 0 && (
        <div className="info-row discount-row">
          <span>10% de descuento sobre el total del plan</span>
          <strong>−{dinero(descuento)}</strong>
        </div>
      )}
    </>
  );
}

/** "Comprobante del gimnasio" (Figura 33 b, CU-001-009): importes congelados al momento del pago (RD12). */
export function ModalComprobante({ comprobante: c, onCerrar }: { comprobante: Comprobante | null; onCerrar: () => void }) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Descarga el mismo PDF que se envía por WhatsApp (lo genera el backend con los datos históricos).
  const descargar = async (comprobante: Comprobante) => {
    if (!comprobante.rutaPdf) return;
    setDescargando(true);
    setError(null);
    try {
      await api.descargar(comprobante.rutaPdf, `comprobante-${comprobante.numero}.pdf`);
    } catch (e) {
      setError((e as Error).message || 'No se pudo descargar el comprobante.');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <Modal
      titulo="Comprobante del gimnasio"
      subtitulo="Importes conservados al momento del registro."
      abierto={!!c}
      onCerrar={onCerrar}
      pie={
        c && (
          <>
            <Boton estilo="outline" onClick={onCerrar}>
              Cerrar
            </Boton>
            <Boton icono="download" cargando={descargando} disabled={!c.rutaPdf} onClick={() => descargar(c)}>
              Descargar comprobante
            </Boton>
            <Boton estilo="outline" icono="receipt" onClick={() => window.print()}>
              Imprimir
            </Boton>
          </>
        )
      }
    >
      {c && (
        <>
          <section className="receipt">
            <Marca />
            <Insignia>Pago registrado</Insignia>
            <h3>Cuota {mesAnio(c.periodo)}</h3>
            <p>
              {c.socio} · Plan {c.plan}
            </p>
            <div className="amount">{dinero(c.importe)}</div>
            <Composicion cuotaBase={c.cuotaBase} adicionalPremium={c.adicionalPremium} descuento={c.descuento} plan={c.plan} />
            <FilaDato etiqueta="Medio">{MEDIO_PROTOTIPO[c.medio] ?? c.medio}</FilaDato>
            <FilaDato etiqueta="Fecha">{fechaLarga(c.fechaPago)}</FilaDato>
            <FilaDato etiqueta="Referencia">{c.referencia}</FilaDato>
          </section>
          <div className="whatsapp-preview">
            <Icono n="message" />
            <div>
              <strong>{estadoEnvioWhatsapp(c)}</strong>
              <p>“Tu pago de {dinero(c.importe)} fue registrado. Tu cuota está al día y el comprobante está disponible.”</p>
            </div>
          </div>
          <p className="receipt-note">Comprobante {c.numero} · {conSede(c.sede)}. No reemplaza una factura.</p>
          <ErrorFormulario>{error}</ErrorFormulario>
        </>
      )}
    </Modal>
  );
}
