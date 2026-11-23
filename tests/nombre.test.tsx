import { render, screen } from '@testing-library/react';
import { AyudaNombre, errorNombreCompleto } from '../src/components/AyudaNombre';

describe('Nombre y apellido: solo letras', () => {
  it('debajo del recuadro dice «Solo letras.» mientras no haya error', () => {
    render(<AyudaNombre valor="María José" />);
    expect(screen.getByText('Solo letras.')).toBeInTheDocument();
  });

  it('apenas se escribe un número muestra el error en rojo', () => {
    render(<AyudaNombre valor="Pepe2" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Usá solo letras, sin números ni símbolos');
  });

  it('el campo vacío no marca error hasta enviar', () => {
    render(<AyudaNombre valor="" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('el mensaje general frena el envío con números o símbolos', () => {
    expect(errorNombreCompleto('Ana', "D'Angelo")).toBeUndefined();
    expect(errorNombreCompleto('Ana2', 'Paz')).toContain('solo letras');
    expect(errorNombreCompleto('Ana', '#')).toContain('solo letras');
  });
});
