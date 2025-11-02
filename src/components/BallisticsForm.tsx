import { FC } from "react";
import { BallisticsData } from "../App";

interface Props {
  data: BallisticsData;
  onChange: (newData: BallisticsData) => void;
}

const fields: { key: keyof BallisticsData; label: string }[] = [
  { key: "anguloDispersao", label: "Ângulo Dispersão (°)" },
  { key: "distanciaX", label: "Distância X (m)" },
  { key: "anguloP", label: "Ângulo P (°)" },
  { key: "distanciaW", label: "Distância W (m)" },
  { key: "distanciaA", label: "Distância A (m)" },
  { key: "distanciaB", label: "Distância B (m)" },
  { key: "alturaMaxima", label: "Altura Máxima (m)" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
  { key: "direcaoTiro", label: "Direção do Tiro (°)" },
];

export const BallisticsForm: FC<Props> = ({ data, onChange }) => {
  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    onChange({
      ...data,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    });
  };

  return (
    <div className="space-y-4">
      {/* Munição */}
      <div>
        <label className="block font-medium">Munição</label>
        <select
          name="munição"
          value={data.munição}
          onChange={handleInput}
          className="w-full border rounded px-2 py-1"
        >
          <option value="explosiva">Explosiva</option>
          <option value="nao-explosiva">Não explosiva</option>
        </select>
      </div>

      {/* Tipo de Impacto */}
      <div>
        <label className="block font-medium">Tipo de Impacto</label>
        <select
          name="tipoImpacto"
          value={data.tipoImpacto}
          onChange={handleInput}
          className="w-full border rounded px-2 py-1"
        >
          <option value="terra">Terra</option>
          <option value="metal">Metal</option>
        </select>
      </div>

      {/* Campos numéricos */}
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block font-medium">{f.label}</label>
          <input
            type="number"
            name={f.key}
            step="0.1"
            value={data[f.key]}
            onChange={handleInput}
            className="w-full border rounded px-2 py-1"
          />
        </div>
      ))}
    </div>
  );
};
