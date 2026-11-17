import { Icono } from './Icono';
import { Boton, Modal } from './ui';

/** "Tu información, con un propósito." (modal de privacidad del prototipo). */
export function ModalPrivacidad({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  return (
    <Modal
      titulo="Tu información, con un propósito."
      subtitulo="Autonomía y claridad durante toda la experiencia."
      abierto={abierto}
      onCerrar={onCerrar}
      pie={<Boton onClick={onCerrar}>Entendido</Boton>}
    >
      <div className="modal-hero-icon">
        <Icono n="shield" />
      </div>
      <p className="modal-text">
        NeuroGym contempla el uso de datos de contacto, reservas y asistencia para organizar el gimnasio, personalizar el entrenamiento y acompañar la constancia.
      </p>
      <div className="divider" />
      <p className="modal-text">Podés ajustar preferencias, gestionar tus adhesiones y elegir las variantes sugeridas para tu rutina. No se solicitan datos biométricos.</p>
      <div className="privacy-note">
        <Icono n="phone" />
        Los datos personales se tratan según la Ley 25.326. Los pagos se procesan con Mercado Pago; NeuroGym no almacena datos de tarjetas.
      </div>
    </Modal>
  );
}

/** "Estamos para acompañarte." Ayuda y contacto. */
export function ModalAyuda({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  return (
    <Modal titulo="Estamos para acompañarte." subtitulo="Escribinos y te respondemos a la brevedad." abierto={abierto} onCerrar={onCerrar} pie={<Boton onClick={onCerrar}>Cerrar</Boton>}>
      <div className="notice-list">
        <div className="notice">
          <Icono n="message" />
          <div>
            <h4>Soporte de NeuroGym</h4>
            <p>
              <a className="text-link" href="mailto:ayuda@neurogym.com.ar">
                ayuda@neurogym.com.ar
              </a>
            </p>
          </div>
        </div>
        <div className="notice">
          <Icono n="building" />
          <div>
            <h4>Consultas sobre tu gimnasio</h4>
            <p>Cuotas, turnos y horarios los gestiona la recepción de tu sede.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
