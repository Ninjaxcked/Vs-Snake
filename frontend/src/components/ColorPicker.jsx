/**
 * Objetivo: elegir un color de la paleta del juego.
 * Entradas: colors (paleta, arreglo de '#rrggbb'), value (color elegido),
 *           onChange (función que recibe el color), disabledColors (colores ya usados).
 * Salidas: grupo de botones de radio con una muestra de cada color.
 * Restricciones: los colores de disabledColors no se pueden elegir.
 */
export default function ColorPicker({ colors, value, onChange, disabledColors = [] }) {
  const used = new Set(disabledColors.map((c) => c.toLowerCase()));

  return (
    <div className="swatches" role="radiogroup" aria-label="Color">
      {colors.map((color) => {
        const taken = used.has(color.toLowerCase());
        return (
          <label
            key={color}
            className={`swatch${value === color ? ' swatch-selected' : ''}${taken ? ' swatch-taken' : ''}`}
            style={{ '--swatch': color }}
            title={taken ? `${color} (en uso)` : color}
          >
            <input
              type="radio"
              name="color"
              value={color}
              checked={value === color}
              disabled={taken}
              onChange={() => onChange(color)}
              aria-label={taken ? `Color ${color} (en uso)` : `Color ${color}`}
            />
          </label>
        );
      })}
    </div>
  );
}
