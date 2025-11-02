export interface BallisticsData {
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
