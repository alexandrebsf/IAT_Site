import { useState, useRef, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* Tipagens */
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

interface DRS {
  id: string;
  name: string;
  data: BallisticsData;
  calculated: BallisticsData | null;
  visible: boolean;
}

/* Utilitários (mantidos do seu código) */
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
    Math.asin(
      Math.sin(φ1) * Math.cos(δ) +
        Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
    );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

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

/* Defaults */
const defaultBallisticsData: BallisticsData = {
  munição: "explosiva",
  tipoImpacto: "terra",
  anguloDispersao: 5,
  distanciaX: 5474,
  anguloP: 24,
  distanciaW: 1225,
  distanciaA: 615,
  distanciaB: 615,
  alturaMaxima: 1090,
  latitude: -15.666,
  longitude: -47.23046667,
  direcaoTiro: 173,
};

export default function App() {
  /* Estado: lista de DRSs e aba selecionada */
  const [drsList, setDrsList] = useState<DRS[]>([
    {
      id: crypto.randomUUID(),
      name: "DRS 1",
      data: { ...defaultBallisticsData },
      calculated: null,
      visible: true,
    },
  ]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  /* Estado novo: habilitar toque no mapa */
  const [touchEnabled, setTouchEnabled] = useState<boolean>(false);

  /* Refs do mapa e das featureGroups por DRS */
  const mapRef = useRef<L.Map | null>(null);
  // cada drsId -> L.FeatureGroup contendo suas linhas/arcos
  const linesRefsRef = useRef<Record<string, L.FeatureGroup | null>>({});
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);

  const layers = [
    {
      id: "osm",
      name: "Padrão",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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

  /* --- Limpa todos featureGroups (todos os desenhos) --- */
  const clearAllDrawings = () => {
    if (!mapRef.current) return;
    Object.values(linesRefsRef.current).forEach((fg) => {
      if (fg) {
        try {
          mapRef.current!.removeLayer(fg);
        } catch (e) {}
      }
    });
    linesRefsRef.current = {};
  };

  /* --- Desenha todo o conjunto de um DRS dentro de um FeatureGroup --- */
  const drawAllFor = (d: BallisticsData, drsId: string) => {
    if (!mapRef.current) return;

    if (linesRefsRef.current[drsId]) {
      try {
        mapRef.current.removeLayer(linesRefsRef.current[drsId]!);
      } catch (e) {}
    }

    const fg = L.featureGroup();
    linesRefsRef.current[drsId] = fg;

    const {
      latitude,
      longitude,
      direcaoTiro,
      distanciaX,
      anguloDispersao,
      anguloP,
      distanciaW,
      distanciaA,
      distanciaB,
      munição,
    } = d;

    // helper to add polyline to featureGroup
    const addLine = (
      key: string,
      startLat: number,
      startLng: number,
      bearing: number,
      distance: number,
      color: string,
      dash = "5,5"
    ): [number, number] => {
      const [endLat, endLng] = calculateDestinationPoint(
        startLat,
        startLng,
        bearing,
        distance
      );
      const poly = L.polyline([[startLat, startLng], [endLat, endLng]], {
        color,
        dashArray: dash,
      });
      fg.addLayer(poly);
      return [endLat, endLng];
    };

    const [endALat, endALng] = addLine(
      "A",
      latitude,
      longitude,
      direcaoTiro,
      distanciaX,
      "#FF0000"
    );
    addLine("B", latitude, longitude, direcaoTiro + anguloDispersao, distanciaX, "#00AA00", "2,2");
    addLine("C", latitude, longitude, direcaoTiro - anguloDispersao, distanciaX, "#00AA00", "2,2");

    // Linhas D, E
    const distanciaD = anguloP !== 0 ? distanciaW / Math.sin((anguloP * Math.PI) / 180) : distanciaX;
    const [endDLat, endDLng] = addLine(
      "D",
      latitude,
      longitude,
      direcaoTiro + anguloDispersao + anguloP,
      distanciaD,
      "#0000FF"
    );
    const [endELat, endELng] = addLine(
      "E",
      latitude,
      longitude,
      direcaoTiro - anguloDispersao - anguloP,
      distanciaD,
      "#0000FF"
    );

    let anguloB = anguloP;
    if (distanciaX > 0 && distanciaA > 0) {
      const arcsinValue = Math.asin(distanciaW / distanciaX) * (180 / Math.PI);
      anguloB = arcsinValue;
    }
    let distanciaF = distanciaX * Math.cos((anguloB * Math.PI) / 180) - distanciaW / Math.tan((anguloP * Math.PI) / 180);
    addLine("F", endDLat, endDLng, direcaoTiro + anguloDispersao, distanciaF, "#0000FF");
    addLine("G", endELat, endELng, direcaoTiro - anguloDispersao, distanciaF, "#0000FF");

    const bearingB = direcaoTiro + anguloDispersao;
    const bearingC = direcaoTiro - anguloDispersao;
    const bearingF = bearingB + Math.asin(distanciaW / distanciaX) * (180 / Math.PI);
    const bearingG = bearingC - Math.asin(distanciaW / distanciaX) * (180 / Math.PI);
    const arcPoints = createArcPoints(latitude, longitude, distanciaX, bearingG, bearingF, 150);
    const arcPoly = L.polyline(arcPoints, { color: "#0000FF", weight: 3, dashArray: "8,4" });
    fg.addLayer(arcPoly);

    // Linhas H-M e círculo maior só para munição explosiva
    if (munição === "explosiva") {
      const sin25 = Math.sin(25 * Math.PI / 180);
      const distanciaH = distanciaA / sin25;
      const [endHLat, endHLng] = addLine("H", latitude, longitude, direcaoTiro + 25 + anguloDispersao + anguloP, distanciaH, "#FF0000");
      const [endILat, endILng] = addLine("I", latitude, longitude, direcaoTiro - 25 - anguloDispersao - anguloP, distanciaH, "#FF0000");

      const sinAngP = Math.sin((anguloP * Math.PI) / 180);
      const tanAngP = Math.tan((anguloP * Math.PI) / 180);
      const tan25 = Math.tan((25 * Math.PI) / 180);
      let distanciaJ = distanciaD + (distanciaA / sinAngP) - (distanciaA / tanAngP) - (distanciaA / tan25);

      const [endJLat, endJLng] = addLine("J", endHLat, endHLng, direcaoTiro + anguloDispersao + anguloP, distanciaJ, "#FF0000");
      const [endKLat, endKLng] = addLine("K", endILat, endILng, direcaoTiro - anguloDispersao - anguloP, distanciaJ, "#FF0000");

      const anguloLRad = Math.asin((distanciaA + distanciaW) / (distanciaX + distanciaB));
      const cosAngP = Math.cos((anguloP * Math.PI) / 180);
      const cosAngP25 = Math.cos(((anguloP + 25) * Math.PI) / 180);
      const distanciaL = Math.max(0, (distanciaX + distanciaB) * Math.cos(anguloLRad) - distanciaJ * cosAngP - distanciaH * cosAngP25);
      const distanciaM = distanciaL;

      addLine("L", endJLat, endJLng, direcaoTiro + anguloDispersao, distanciaL, "#FF0000");
      addLine("M", endKLat, endKLng, direcaoTiro - anguloDispersao, distanciaM, "#FF0000");

      const raioCirculo = distanciaX + distanciaB;
      const anguloArcCircle = anguloDispersao + (Math.asin((distanciaA + distanciaW) / raioCirculo) * 180) / Math.PI;
      const circlePoints = createArcPoints(latitude, longitude, raioCirculo, direcaoTiro - anguloArcCircle, direcaoTiro + anguloArcCircle, 200);
      const circlePoly = L.polyline(circlePoints, { color: "#FF0000", weight: 3, dashArray: "10,5" });
      fg.addLayer(circlePoly);
    }

    // adicionar featureGroup ao mapa por fim
    fg.addTo(mapRef.current!);
  
  };

  /* --- Redesenha tudo: limpa e desenha todos os DRS calculados e visíveis --- */
  const redrawAll = () => {
    if (!mapRef.current) return;
    clearAllDrawings();
    drsList.forEach((drs) => {
      if (drs.visible && drs.calculated) {
        drawAllFor(drs.calculated!, drs.id);
      }
    });

    // ajustar bounds para caber tudo
    const allLayers: L.Layer[] = [];
    Object.values(linesRefsRef.current).forEach((fg) => {
      if (fg) {
        const layers = fg.getLayers();
        if (layers && layers.length > 0) allLayers.push(...layers);
      }
    });

    if (allLayers.length > 0) {
      try {
        const bounds = L.featureGroup(allLayers).getBounds();
        mapRef.current!.fitBounds(bounds, { padding: [25, 25] });
      } catch (err) {}
    }
  };

  /* --- Gerenciamento de DRSs (add/remove/toggle) --- */
  const addNewDrs = () => {
    const id = crypto.randomUUID();
    const newDrs: DRS = {
      id,
      name: `DRS ${drsList.length + 1}`,
      data: { ...defaultBallisticsData },
      calculated: null,
      visible: true,
    };
    // uso funcional para garantir que o novo índice seja calculado corretamente
    setDrsList((prev) => {
      const newList = [...prev, newDrs];
      // selecionar o novo DRS
      setSelectedIndex(newList.length - 1);
      return newList;
    });
  };

  const removeDrs = (index: number) => {
    const drs = drsList[index];
    if (drs && linesRefsRef.current[drs.id]) {
      try {
        mapRef.current!.removeLayer(linesRefsRef.current[drs.id]!);
      } catch (e) {}
      delete linesRefsRef.current[drs.id];
    }
    const newList = drsList.filter((_, i) => i !== index);
    setDrsList(newList);
    if (selectedIndex >= newList.length) setSelectedIndex(Math.max(0, newList.length - 1));
  };

  const toggleVisibility = (index: number) => {
    setDrsList((prev) => prev.map((d, i) => (i === index ? { ...d, visible: !d.visible } : d)));
  };

  /* --- Atualizar dados do DRS selecionado --- */
  // fromMapClick: se true, também grava calculated (comportamento desejado)
  const updateSelectedDrsData = (patch: Partial<BallisticsData>, fromMapClick = false) => {
    // usamos atualização funcional para garantir coerência
    setDrsList((prev) => {
      const newList = prev.map((d, i) => {
        if (i !== selectedIndex) return d;
        // removemos featureGroup desse drs imediatamente (evita duplicatas temporárias)
        if (linesRefsRef.current[d.id]) {
          try {
            mapRef.current!.removeLayer(linesRefsRef.current[d.id]!);
          } catch (e) {}
          delete linesRefsRef.current[d.id];
        }
        const newData = { ...d.data, ...patch };
        return {
          ...d,
          data: newData,
          calculated: fromMapClick ? { ...newData } : null,
        };
      });

      return newList;
    });
    // redrawAll será acionado pelo useEffect que observa drsList
  };

  /* --- Calcular para o DRS selecionado (congela e redesenha via useEffect) --- */
  const calculateForSelected = () => {
    setDrsList((prev) => prev.map((d, i) => (i === selectedIndex ? { ...d, calculated: { ...d.data } } : d)));
  };

  /* --- Inicialização do mapa (sem handler de clique) --- */
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map("map", { zoomControl: true }).setView(
        [defaultBallisticsData.latitude, defaultBallisticsData.longitude],
        13
      );
      markersGroupRef.current = L.featureGroup().addTo(mapRef.current);

      const layersControl = L.control.layers({}, {}, { position: "topright" }).addTo(mapRef.current);
      layers.forEach((layer) => {
        const tileLayer = L.tileLayer(layer.url, { attribution: layer.attribution, maxZoom: 19 });
        if (layer.id === "satellite") tileLayer.addTo(mapRef.current!);
        layersControl.addBaseLayer(tileLayer, layer.name);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- useEffect para o handler de clique — depende de selectedIndex para não usar closure "velha" --- */
  useEffect(() => {
    if (!mapRef.current) return;

    const handler = (e: L.LeafletMouseEvent) => {
      if (!touchEnabled) return;
      const { lat, lng } = e.latlng;
      // atualiza somente o DRS selecionado (selectedIndex mais recente aqui)
      updateSelectedDrsData({ latitude: lat, longitude: lng }, true);
    };

    mapRef.current.on("click", handler);

    return () => {
      mapRef.current?.off("click", handler);
    };
  }, [selectedIndex, touchEnabled]);

  /* --- useEffect para garantir redraw quando drsList muda (adicionar/remover/toggle/editar/calculated) --- */
  useEffect(() => {
    if (!mapRef.current) return;
    redrawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drsList]);

  /* --- JSX --- */
  return (
    <div className="flex flex-col h-screen">
      <header className="bg-gray-800 text-white p-4 flex items-center gap-3 sticky top-0 z-50">
        <img src="iat.png" alt="iat" className="h-10 w-auto object-contain" />
        <div className="font-bold text-lg">Simulador Balístico — Múltiplos DRS</div>
      </header>
      <div className="flex-1 flex flex-col md:flex-row">
        <aside className="w-full md:w-1/3 border-b md:border-b-0 md:border-r flex flex-col bg-gray-100">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sticky top-20 z-40 bg-gray-100">
            {drsList.map((d, i) => (
              <div
                key={d.id}
                className={`flex items-center gap-2 px-3 py-1 rounded-md cursor-pointer ${
                  i === selectedIndex ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"
                }`}
                onClick={() => setSelectedIndex(i)}
              >
                <span className="font-medium">{d.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVisibility(i);
                  }}
                  title="Mostrar/Ocultar"
                  className="text-sm px-1 rounded bg-white/10"
                >
                  {d.visible ? "👁" : "🙈"}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDrs(i);
                  }}
                  title="Remover"
                  className="text-sm px-1 rounded bg-red-500 text-white"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={addNewDrs}
              className="ml-2 px-3 py-1 rounded-md bg-green-600 text-white font-semibold"
            >
              + Novo DRS
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <h2 className="font-semibold text-lg mb-4">{drsList[selectedIndex]?.name || "Sem DRS"}</h2>

            {drsList[selectedIndex] && (
              <>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div>
                    <label className="block font-medium mb-1">Munição</label>
                    <select
                      value={drsList[selectedIndex].data.munição}
                      onChange={(e) => updateSelectedDrsData({ munição: e.target.value as any })}
                      className="w-full border rounded px-2 py-1"
                    >
                      <option value="explosiva">Explosiva</option>
                      <option value="nao-explosiva">Não Explosiva</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Tipo de Impacto</label>
                    <select
                      value={drsList[selectedIndex].data.tipoImpacto}
                      onChange={(e) => updateSelectedDrsData({ tipoImpacto: e.target.value as any })}
                      className="w-full border rounded px-2 py-1"
                    >
                      <option value="terra">Terra</option>
                      <option value="metal">Metal</option>
                    </select>
                  </div>
                </div>

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
                        value={drsList[selectedIndex].data[field.key as keyof BallisticsData] as number}
                        onChange={(e) =>
                          updateSelectedDrsData({ [field.key]: parseFloat(e.target.value) } as any)
                        }
                        className="w-full border rounded px-2 py-1"
                      />
                    </div>
                  ))}
                </div>

                <button
                  className="mt-3 w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700 transition-colors"
                  onClick={calculateForSelected}
                >
                  Calcular Trajetória
                </button>

                {/* NOVO BOTÃO: Habilitar toque no mapa */}
                <button
                  className="mt-2 w-full bg-yellow-500 text-black font-semibold py-2 rounded hover:bg-yellow-600 transition-colors"
                  onClick={() => setTouchEnabled((prev) => !prev)}
                >
                  {touchEnabled ? "Desabilitar toque no mapa" : "Habilitar toque no mapa"}
                </button>

                <div className="mt-3 text-sm text-gray-600">
                  Clique no mapa para atualizar a origem e redesenhar (funciona como Calcular).
                </div>
              </>
            )}
          </div>
        </aside>

        <div className="w-full md:w-2/3 md:ml-2 h-[70vh] md:h-auto">
          <div id="map" className="h-full w-full"></div>
        </div>
      </div>
    </div>
  );
}
