/** Gráfico de líneas en SVG con la misma grilla y tipografía del prototipo (analytics-line). */
export interface Serie {
  nombre: string;
  color: string;
  valores: number[];
}

export function GraficoLinea({ series, etiquetas, descripcion, sufijo = '' }: { series: Serie[]; etiquetas: string[]; descripcion: string; sufijo?: string }) {
  const max = Math.max(1, ...series.flatMap((s) => s.valores));
  const tope = Math.ceil(max / 4) * 4 || 4;
  const x = (i: number) => (etiquetas.length <= 1 ? 295 : 40 + (i * 510) / (etiquetas.length - 1));
  const y = (v: number) => 173 - (v / tope) * 144;
  return (
    <svg className="analytics-line" viewBox="0 0 580 215" role="img" aria-label={descripcion}>
      <g stroke="#e3e8db" strokeDasharray="4 4">
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M30 ${25 + i * 48}H570`} />
        ))}
      </g>
      <g fill="#74806a" fontSize="11">
        {[0, 1, 2, 3].map((i) => (
          <text key={i} x="2" y={29 + i * 48}>
            {Math.round(tope - (tope / 3) * i)}
            {sufijo}
          </text>
        ))}
        {etiquetas.map((e, i) => (
          <text key={e + i} textAnchor="middle" x={x(i)} y="199">
            {e}
          </text>
        ))}
      </g>
      {series.map((s) => (
        <g key={s.nombre}>
          <path d={s.valores.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {s.valores.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={s.color}>
              <title>
                {s.nombre} · {etiquetas[i]}: {v}
                {sufijo}
              </title>
            </circle>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Mini gráfico de tendencia (ngi-spark del prototipo). */
export function Tendencia({ valores, color, descripcion }: { valores: number[]; color: string; descripcion: string }) {
  const max = Math.max(1, ...valores);
  const puntos = valores.map((v, i) => `${8 + (i * 108) / Math.max(1, valores.length - 1)},${30 - (v / max) * 24}`).join(' ');
  return (
    <svg className="ngi-spark" viewBox="0 0 124 36" role="img" aria-label={descripcion}>
      <polyline points={puntos} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
