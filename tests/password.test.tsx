import { render, screen } from '@testing-library/react';
import { AyudaPassword, faltaEnPassword } from '../src/components/AyudaPassword';

describe('Contraseña nueva: aviso en vivo', () => {
  it('dice exactamente qué falta', () => {
    expect(faltaEnPassword('454k')).toBe('Te faltan 4 caracteres');
    expect(faltaEnPassword('abcdefgh')).toBe('Te falta un número');
    expect(faltaEnPassword('1234567')).toBe('Te faltan 1 carácter y una letra');
    expect(faltaEnPassword('ab')).toBe('Te faltan 6 caracteres y un número');
    expect(faltaEnPassword('Prueba123')).toBeUndefined();
    expect(faltaEnPassword(`a1${'x'.repeat(71)}`)).toBe('Usá 72 caracteres como máximo');
  });

  it('vacía muestra la regla; mientras se escribe, el faltante en rojo; si cumple, lo confirma', () => {
    const { rerender } = render(<AyudaPassword valor="" />);
    expect(screen.getByText('Mínimo 8 caracteres, con letras y números.')).toBeInTheDocument();
    rerender(<AyudaPassword valor="454k" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Te faltan 4 caracteres.');
    rerender(<AyudaPassword valor="Prueba123" />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/cumple/)).toBeInTheDocument();
  });
});
