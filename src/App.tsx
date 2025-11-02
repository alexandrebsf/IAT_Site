import { useState, useRef, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface BallisticsData {
  munição: "explosiva" | "nao-explosiva";
  tipoImpacto: "terra" | "metal";
  anguloDispersao: number;
  distanciaX: number;
  anguloP: number;
  distanciaW: number;
  distanciaA: number;
  distanciaB: number;
  alturaMaxima: number;
  latitude: number;
  longitude: number;
  direcaoTiro: number;
}

// --- FUNÇÕES DE UTILIDADE ---
function calculateDestinationPoint(
  lat: number,
  lng: number,
  bearing: number,
  distance: number
): [number, number] {
  const R = 6371000;
  const δ = distance / R;
  const θ = (bearing * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;

  const φ2 =
    Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));

  return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI];
}

function createArcPoints(
  lat: number,
  lng: number,
  radius: number,
  startBearing: number,
  endBearing: number,
  segments: number = 100
): [number, number][] {
  const points: [number, number][] = [];
  let start = startBearing;
  let end = endBearing;
  if (end < start) end += 360;

  for (let i = 0; i <= segments; i++) {
    const bearing = start + ((end - start) * i) / segments;
    points.push(calculateDestinationPoint(lat, lng, bearing % 360, radius));
  }
  return points;
}

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [data, setData] = useState<BallisticsData>({
    munição: "explosiva",
    tipoImpacto: "terra",
    anguloDispersao: 5,
    distanciaX: 5474,
    anguloP: 24,
    distanciaW: 1225,
    distanciaA: 615,
    distanciaB: 615,
    alturaMaxima: 1090,
    latitude: -23.5505,
    longitude: -46.6333,
    direcaoTiro: 0,
  });

  const [drawTrajectory, setDrawTrajectory] = useState(false);
  const [calculatedData, setCalculatedData] = useState<BallisticsData | null>(null);

  const mapRef = useRef<L.Map | null>(null);
  const linesRef = useRef<Record<string, L.Polyline | null>>({});
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);

  const layers = [
    {
      id: "osm",
      name: "Padrão",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
    {
      id: "satellite",
      name: "Satélite",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles © Esri",
    },
    {
      id: "terrain",
      name: "Terreno",
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attribution: "Map data: &copy; OpenTopoMap",
    },
  ];

  // Desenha uma linha simples
  const drawLine = (key: string, startLat: number, startLng: number, bearing: number, distance: number, color: string, dash = "5,5"): [number, number] => {
    const [endLat, endLng] = calculateDestinationPoint(startLat, startLng, bearing, distance);
    if (linesRef.current[key]) mapRef.current!.removeLayer(linesRef.current[key]!);
    linesRef.current[key] = L.polyline([[startLat, startLng], [endLat, endLng]], { color, dashArray: dash }).addTo(mapRef.current!);
    return [endLat, endLng];
  };

  // Desenha todas as linhas e arcos
  const drawAll = (d: BallisticsData) => {
    if (!mapRef.current) return;
    Object.values(linesRef.current).forEach(line => line && mapRef.current!.removeLayer(line));
    linesRef.current = {};

    const { latitude, longitude, direcaoTiro, distanciaX, anguloDispersao, anguloP, distanciaW, distanciaA, distanciaB, munição } = d;

    // Linhas A, B, C
    const [endALat, endALng] = drawLine("A", latitude, longitude, direcaoTiro, distanciaX, "#FF0000");
    const [endBLat, endBLng] = drawLine("B", latitude, longitude, direcaoTiro + anguloDispersao, distanciaX, "#00AA00", "2,2");
    const [endCLat, endCLng] = drawLine("C", latitude, longitude, direcaoTiro - anguloDispersao, distanciaX, "#00AA00", "2,2");

    // Linhas D, E
    const distanciaD = anguloP !== 0 ? distanciaW / Math.sin(anguloP * Math.PI / 180) : distanciaX;
    const [endDLat, endDLng] = drawLine("D", latitude, longitude, direcaoTiro + anguloDispersao + anguloP, distanciaD, "#0000FF");
    const [endELat, endELng] = drawLine("E", latitude, longitude, direcaoTiro - anguloDispersao - anguloP, distanciaD, "#0000FF");

    // Linhas F, G
    let anguloB = anguloP;
    if (distanciaX > 0 && distanciaA > 0) {
      const arcsinValue = Math.asin(distanciaW / distanciaX) * (180 / Math.PI);
      anguloB = arcsinValue;
    }
    let distanciaF = (distanciaX * Math.cos((anguloB * Math.PI) / 180)) - (distanciaW / Math.tan((anguloP * Math.PI) / 180));
    drawLine("F", endDLat, endDLng, direcaoTiro + anguloDispersao, distanciaF, "#0000FF");
    drawLine("G", endELat, endELng, direcaoTiro - anguloDispersao, distanciaF, "#0000FF");

    // Arco principal
    if (distanciaX > 0 && distanciaW > 0) {
      const bearingB = direcaoTiro + anguloDispersao;
      const bearingC = direcaoTiro - anguloDispersao;
      const bearingF = bearingB + Math.asin(distanciaW / distanciaX) * 180 / Math.PI;
      const bearingG = bearingC - Math.asin(distanciaW / distanciaX) * 180 / Math.PI;
      const arcPoints = createArcPoints(latitude, longitude, distanciaX, bearingG, bearingF, 150);
      linesRef.current.arc && mapRef.current.removeLayer(linesRef.current.arc);
      linesRef.current.arc = L.polyline(arcPoints, { color: "#0000FF", weight: 3, dashArray: "8,4" }).addTo(mapRef.current!);
    }

    // Linhas H-M e círculo maior só para munição explosiva
    if (munição === "explosiva") {
      const sin25 = Math.sin(25 * Math.PI / 180);
      const distanciaH = distanciaA / sin25;
      const [endHLat, endHLng] = drawLine("H", latitude, longitude, direcaoTiro + 25 + anguloDispersao + anguloP, distanciaH, "#FF0000");
      const [endILat, endILng] = drawLine("I", latitude, longitude, direcaoTiro - 25 - anguloDispersao - anguloP, distanciaH, "#FF0000");

      const sinAngP = Math.sin(anguloP * Math.PI / 180);
      const tanAngP = Math.tan(anguloP * Math.PI / 180);
      const tan25 = Math.tan(25 * Math.PI / 180);
      let distanciaJ = distanciaD + (distanciaA / sinAngP) - (distanciaA / tanAngP) - (distanciaA / tan25);

      const [endJLat, endJLng] = drawLine("J", endHLat, endHLng, direcaoTiro + anguloDispersao + anguloP, distanciaJ, "#FF0000");
      const [endKLat, endKLng] = drawLine("K", endILat, endILng, direcaoTiro - anguloDispersao - anguloP, distanciaJ, "#FF0000");

      const anguloLRad = Math.asin((distanciaA + distanciaW) / (distanciaX + distanciaB));
      const cosAngP = Math.cos(anguloP * Math.PI / 180);
      const cosAngP25 = Math.cos((anguloP + 25) * Math.PI / 180);
      const distanciaL = Math.max(0, (distanciaX + distanciaB) * Math.cos(anguloLRad) - distanciaJ * cosAngP - distanciaH * cosAngP25);
      const distanciaM = distanciaL;

      drawLine("L", endJLat, endJLng, direcaoTiro + anguloDispersao, distanciaL, "#FF0000");
      drawLine("M", endKLat, endKLng, direcaoTiro - anguloDispersao, distanciaM, "#FF0000");

      // Círculo maior
      const raioCirculo = distanciaX + distanciaB;
      const anguloArcCircle = anguloDispersao + Math.asin((distanciaA + distanciaW) / raioCirculo) * 180 / Math.PI;
      const circlePoints = createArcPoints(latitude, longitude, raioCirculo, direcaoTiro - anguloArcCircle, direcaoTiro + anguloArcCircle, 200);
      linesRef.current.circle && mapRef.current.removeLayer(linesRef.current.circle);
      linesRef.current.circle = L.polyline(circlePoints, { color: "#FF0000", weight: 3, dashArray: "10,5" }).addTo(mapRef.current!);
    }
  };

useEffect(() => {
  if (!mapRef.current) {
    mapRef.current = L.map("map", { zoomControl: true }).setView([data.latitude, data.longitude], 13);
    markersGroupRef.current = L.featureGroup().addTo(mapRef.current);

    const layersControl = L.control.layers({}, {}, { position: "topright" }).addTo(mapRef.current);
    layers.forEach((layer) => {
      const tileLayer = L.tileLayer(layer.url, { attribution: layer.attribution, maxZoom: 19 });
      if (layer.id === "osm") tileLayer.addTo(mapRef.current!);
      layersControl.addBaseLayer(tileLayer, layer.name);
    });

    // --- NOVO: clique no mapa ---
    mapRef.current.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setData(prev => ({ ...prev, latitude: lat, longitude: lng }));
      setCalculatedData(prev => prev ? { ...prev, latitude: lat, longitude: lng } : null);
    });
  }

  if (calculatedData) {
    drawAll(calculatedData);

    // Centraliza no final da linha A
    const [endALat, endALng] = calculateDestinationPoint(
      calculatedData.latitude,
      calculatedData.longitude,
      calculatedData.direcaoTiro,
      calculatedData.distanciaX
    );
    mapRef.current.setView([calculatedData.latitude, calculatedData.longitude], mapRef.current.getZoom());
    
    // Criar bounds com origem e ponto final
    const bounds = L.latLngBounds([
    [calculatedData.latitude, calculatedData.longitude],
    [endALat, endALng],
    ]);

    // Ajustar mapa para caber toda a linha A com padding
    mapRef.current.fitBounds(bounds, { padding: [25, 25] });
  
  }
}, [calculatedData]);



  return (
    <div className="flex flex-col h-screen">
      <header className="bg-gray-800 text-white p-4 font-bold text-lg">Simulador Balístico</header>
      <div className="flex flex-1">
      {/* FORMULÁRIO */}
      <aside className="w-full md:w-1/3 p-4 overflow-y-auto border-r border-gray-300">
        <h2 className="font-semibold text-lg mb-4">Parâmetros Balísticos</h2>

        {/* Campos categóricos */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div>
            <label className="block font-medium mb-1">Munição</label>
            <select
              value={data.munição}
              onChange={(e) =>
                setData({ ...data, munição: e.target.value as "explosiva" | "nao-explosiva" })
              }
              className="w-full border rounded px-2 py-1"
            >
              <option value="explosiva">Explosiva</option>
              <option value="nao-explosiva">Não Explosiva</option>
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Tipo de Impacto</label>
            <select
              value={data.tipoImpacto}
              onChange={(e) =>
                setData({ ...data, tipoImpacto: e.target.value as "terra" | "metal" })
              }
              className="w-full border rounded px-2 py-1"
            >
              <option value="terra">Terra</option>
              <option value="metal">Metal</option>
            </select>
          </div>
        </div>

        {/* Campos numéricos em 2 colunas */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Direção de Tiro (°)", key: "direcaoTiro", step: 0.1 },
            { label: "Ângulo de Dispersão (°)", key: "anguloDispersao", step: 0.1 },
            { label: "Distância X (m)", key: "distanciaX", step: 1 },
            { label: "Ângulo P (°)", key: "anguloP", step: 0.1 },
            { label: "Distância W (m)", key: "distanciaW", step: 1 },
            { label: "Distância A (m)", key: "distanciaA", step: 1 },
            { label: "Distância B (m)", key: "distanciaB", step: 1 },
            { label: "Altura Máxima (m)", key: "alturaMaxima", step: 1 },
            { label: "Latitude", key: "latitude", step: 0.000001 },
            { label: "Longitude", key: "longitude", step: 0.000001 },
          ].map((field) => (
            <div key={field.key}>
              <label className="block font-medium mb-1">{field.label}</label>
              <input
                type="number"
                step={field.step}
                value={data[field.key as keyof BallisticsData] as number}
                onChange={(e) =>
                  setData({ ...data, [field.key]: parseFloat(e.target.value) })
                }
                className="w-full border rounded px-2 py-1"
              />
            </div>
          ))}
        </div>
          {/* Botão Calcular Trajetória */}
          <button
  className="mt-3 w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700 transition-colors"
  onClick={() => setCalculatedData({ ...data })} // Atualiza os dados de cálculo
>
  Calcular Trajetória
</button>
      </aside>

        {/* MAPA */}
        <div className="w-full md:w-2/3">
          <div id="map" className="h-full w-full"></div>
        </div>
      </div>
    </div>
  );
}
