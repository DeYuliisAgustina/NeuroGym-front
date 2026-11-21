import { tokenAlmacenado } from '../src/services/api';

/**
 * Sesión por pestaña: jsdom tiene un solo sessionStorage, así que "cambiar de
 * pestaña" se simula guardando y restaurando su contenido.
 */
describe('sesión por pestaña', () => {
  const CLAVE = 'neurogym.token';
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('el personal y un socio conviven en pestañas distintas', () => {
    // Pestaña A: ingresa el administrador.
    tokenAlmacenado.guardar('token-admin');
    const pestanaA = sessionStorage.getItem(CLAVE);

    // Pestaña B (nueva): arranca con el último ingreso y después ingresa un socio.
    sessionStorage.clear();
    expect(tokenAlmacenado.leer()).toBe('token-admin');
    tokenAlmacenado.guardar('token-socio');
    expect(tokenAlmacenado.leer()).toBe('token-socio');

    // Vuelve a la pestaña A: sigue siendo el administrador.
    sessionStorage.clear();
    sessionStorage.setItem(CLAVE, pestanaA!);
    expect(tokenAlmacenado.leer()).toBe('token-admin');

    // Cerrar la sesión en A no cierra la del socio para las pestañas nuevas.
    tokenAlmacenado.borrar();
    expect(tokenAlmacenado.leer()).toBe('token-socio');
  });

  it('cerrar la sesión en la pestaña del último ingreso la borra también para las nuevas', () => {
    tokenAlmacenado.guardar('token-socio');
    tokenAlmacenado.borrar();
    expect(tokenAlmacenado.leer()).toBeNull();
  });
});
