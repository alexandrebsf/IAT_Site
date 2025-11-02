import { FC } from "react";
import { MapContainer, TileLayer, Marker, Polyline, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf";
import { BallisticsData } from "../App";

const { BaseLayer } = LayersControl;

interface Props {
  data: BallisticsData;
}

export const MapView: FC<Props> = ({ data }) => {
  const layers = [
    {
      id: "osm",
      name: "Padrão",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; OpenStreetMap contributors',
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
      attribution: "&copy; OpenTopoMap",
    },
  ];

  // Calcula segmento principal
  const start = turf.point([data.longitude, data.latitude]);
  const destination = turf.destination(start, data.distanciaX / 1000, data.direcaoTiro, {
    units: "kilometers",
  });
  const segment = turf.lineString([
    start.geometry.coordinates,
    destination.geometry.coordinates,
  ]).geometry.coordinates.map(([lng, lat]) => [lat, lng]) as [number, number][];

  return (
    <MapContainer center={[data.latitude, data.longitude]} zoom={6} className="h-full w-full">
      <LayersControl position="topright">
        {layers.map((layer) => (
          <BaseLayer key={layer.id} checked={layer.id === "osm"} name={layer.name}>
            <TileLayer url={layer.url} attribution={layer.attribution} />
          </BaseLayer>
        ))}
      </LayersControl>
      <Marker position={[data.latitude, data.longitude]} />
      <Polyline positions={segment} color="red" />
    </MapContainer>
  );
};
