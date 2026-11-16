import { useState } from 'react';
import { CambioPassword } from '../../components/CambioPassword';
import { Aviso, Boton, Campo, Cargando, EncabezadoPagina } from '../../components/ui';
import { useAccion, useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { fecha } from '../../utils/formato';
import { telefonoValido } from '../../validations/formularios';

interface Perfil {
  telefono: string;
  esPremium: boolean;
  plan: { tipo: 'BASICO' | 'PREMIUM' };
  sede: { nombre: string };
  bonificacionVigente: { hasta: string } | null;
  usuario: { nombre: string; apellido: string; email: string };
}

/** Perfil del socio: datos de contacto, Plan Premium (RF12) y contraseña. */
export function PerfilSocio() {
  const perfil = useApi(() => api.get<Perfil>('/socio/perfil'));
  const [telefono, setTelefono] = useState<string | null>(null);
  const accion = useAccion();
  if (perfil.cargando) return <Cargando />;
  if (perfil.error) return <Aviso tipo="error">{perfil.error}</Aviso>;
  const p = perfil.datos!;
  const tel = telefono ?? p.telefono;

  const guardar = async () => {
    if (!telefonoValido(tel)) return accion.setError('Teléfono inválido');
    if (await accion.ejecutar(() => api.put('/socio/perfil', { telefono: tel }), 'Datos guardados.')) void perfil.recargar();
  };
  const cambiarPlan = async (plan: 'BASICO' | 'PREMIUM') => {
    const texto = plan === 'PREMIUM' ? '¿Contratar el Plan Premium? El adicional se suma a tu cuota.' : '¿Dar de baja el Plan Premium? Dejarás de acceder al marketplace.';
    if (!window.confirm(texto)) return;
    if (await accion.ejecutar(() => api.put('/socio/plan', { plan }), plan === 'PREMIUM' ? 'Ya tenés el Plan Premium.' : 'Volviste al Plan Básico.')) void perfil.recargar();
  };

  return (
    <div>
      <EncabezadoPagina titulo={`${p.usuario.nombre} ${p.usuario.apellido}`} descripcion={`${p.usuario.email} · ${p.sede.nombre}`} />
      <Aviso tipo="error">{accion.error}</Aviso>
      <Aviso tipo="exito">{accion.exito}</Aviso>
      <div className="grilla-2">
        <div className="tarjeta">
          <h2>Mis datos</h2>
          <Campo etiqueta="Teléfono (WhatsApp)" value={tel} onChange={(e) => setTelefono(e.target.value)} />
          <Boton cargando={accion.enviando} onClick={guardar}>
            Guardar cambios
          </Boton>
        </div>
        <div className="tarjeta">
          <h2>Mi plan</h2>
          <p>
            Plan <strong>{p.plan.tipo === 'PREMIUM' ? 'Premium' : 'Básico'}</strong>
            {p.bonificacionVigente && ` · Premium bonificado hasta el ${fecha(p.bonificacionVigente.hasta)}`}
          </p>
          <p className="tenue">El Plan Premium suma el acceso a nutricionistas y deportólogos del marketplace.</p>
          {p.plan.tipo === 'BASICO' ? (
            <Boton variante="acento" onClick={() => cambiarPlan('PREMIUM')}>
              Contratar Premium
            </Boton>
          ) : (
            <Boton variante="secundario" onClick={() => cambiarPlan('BASICO')}>
              Dar de baja Premium
            </Boton>
          )}
        </div>
      </div>
      <CambioPassword />
    </div>
  );
}
