// Script para generar el GeoJSON de Chile con las 16 regiones
// Coordenadas simplificadas pero geográficamente correctas (WGS84)
const fs = require('fs');
const path = require('path');

// GeoJSON con las 16 regiones de Chile (polígonos simplificados)
const chileGeoJSON = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Arica y Parinacota", "COD_REG": "15", "codigo": "XV" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-70.40, -17.50], [-69.45, -17.50], [-69.25, -18.00], [-69.50, -18.50],
          [-70.10, -18.50], [-70.50, -18.20], [-70.40, -17.50]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Tarapacá", "COD_REG": "01", "codigo": "I" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-70.10, -18.50], [-69.50, -18.50], [-69.00, -19.00], [-68.80, -19.50],
          [-69.00, -20.50], [-69.80, -20.80], [-70.20, -20.60], [-70.50, -19.80],
          [-70.50, -18.20], [-70.10, -18.50]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Antofagasta", "COD_REG": "02", "codigo": "II" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-70.20, -20.60], [-69.80, -20.80], [-69.00, -20.50], [-68.40, -21.50],
          [-67.80, -22.50], [-67.20, -24.00], [-68.00, -24.50], [-68.80, -25.50],
          [-69.20, -25.50], [-70.10, -25.00], [-70.80, -23.80], [-70.80, -21.50],
          [-70.50, -20.80], [-70.20, -20.60]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Atacama", "COD_REG": "03", "codigo": "III" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-70.10, -25.00], [-69.20, -25.50], [-68.80, -25.50], [-68.00, -26.50],
          [-68.50, -27.50], [-69.00, -27.50], [-69.50, -28.00], [-69.80, -28.50],
          [-70.50, -28.00], [-71.00, -27.00], [-71.00, -25.80], [-70.80, -25.20],
          [-70.10, -25.00]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Coquimbo", "COD_REG": "04", "codigo": "IV" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-70.50, -28.00], [-69.80, -28.50], [-69.50, -28.00], [-69.00, -27.50],
          [-68.50, -29.00], [-68.80, -30.00], [-69.50, -30.50], [-70.00, -31.00],
          [-71.20, -30.50], [-71.50, -29.50], [-71.20, -28.50], [-70.80, -28.00],
          [-70.50, -28.00]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Valparaíso", "COD_REG": "05", "codigo": "V" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-71.20, -30.50], [-70.00, -31.00], [-69.50, -30.50], [-69.80, -31.50],
          [-70.00, -32.50], [-70.50, -33.00], [-71.50, -33.00], [-71.60, -32.00],
          [-71.50, -31.00], [-71.20, -30.50]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Metropolitana de Santiago", "COD_REG": "13", "codigo": "RM" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-70.50, -33.00], [-70.00, -32.50], [-69.80, -33.00], [-69.70, -33.80],
          [-70.00, -34.00], [-70.50, -34.20], [-71.00, -34.00], [-71.20, -33.50],
          [-71.00, -33.00], [-70.50, -33.00]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Libertador Gral. Bernardo O'Higgins", "COD_REG": "06", "codigo": "VI" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-70.50, -34.20], [-70.00, -34.00], [-69.70, -33.80], [-69.50, -34.50],
          [-69.70, -35.00], [-70.20, -35.20], [-71.00, -35.00], [-71.20, -34.50],
          [-71.00, -34.00], [-70.50, -34.20]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Maule", "COD_REG": "07", "codigo": "VII" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-70.20, -35.20], [-69.70, -35.00], [-69.50, -34.50], [-69.20, -35.50],
          [-69.50, -36.20], [-70.00, -36.50], [-71.00, -36.50], [-71.50, -36.00],
          [-71.20, -35.50], [-71.00, -35.00], [-70.20, -35.20]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Ñuble", "COD_REG": "16", "codigo": "XVI" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-71.00, -36.50], [-70.00, -36.50], [-69.50, -36.20], [-69.20, -37.00],
          [-69.50, -37.50], [-70.00, -37.50], [-71.00, -37.20], [-71.50, -37.00],
          [-71.50, -36.00], [-71.00, -36.50]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Biobío", "COD_REG": "08", "codigo": "VIII" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-71.00, -37.20], [-70.00, -37.50], [-69.50, -37.50], [-69.20, -38.20],
          [-69.50, -38.80], [-70.20, -39.00], [-71.20, -38.80], [-72.00, -38.50],
          [-72.20, -37.80], [-71.80, -37.20], [-71.50, -37.00], [-71.00, -37.20]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "La Araucanía", "COD_REG": "09", "codigo": "IX" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-71.20, -38.80], [-70.20, -39.00], [-69.50, -38.80], [-69.50, -39.80],
          [-70.00, -40.00], [-71.00, -40.00], [-72.00, -39.80], [-72.50, -39.20],
          [-72.20, -38.80], [-72.00, -38.50], [-71.20, -38.80]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Los Ríos", "COD_REG": "14", "codigo": "XIV" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-71.00, -40.00], [-70.00, -40.00], [-69.50, -39.80], [-69.80, -40.80],
          [-70.50, -41.00], [-71.50, -40.80], [-72.50, -40.50], [-72.50, -39.80],
          [-72.50, -39.20], [-72.00, -39.80], [-71.00, -40.00]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Los Lagos", "COD_REG": "10", "codigo": "X" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-71.50, -40.80], [-70.50, -41.00], [-69.80, -40.80], [-70.00, -42.00],
          [-71.00, -42.50], [-72.50, -42.20], [-73.50, -41.80], [-73.50, -41.00],
          [-72.50, -40.50], [-71.50, -40.80]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Aysén del Gral. Carlos Ibáñez del Campo", "COD_REG": "11", "codigo": "XI" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-72.50, -42.20], [-71.00, -42.50], [-70.00, -42.00], [-70.50, -44.00],
          [-71.00, -45.00], [-72.00, -46.50], [-73.00, -47.00], [-74.00, -46.50],
          [-75.00, -44.00], [-74.00, -43.00], [-73.50, -41.80], [-72.50, -42.20]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "NOM_REG": "Magallanes y de la Antártica Chilena", "COD_REG": "12", "codigo": "XII" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-73.00, -47.00], [-72.00, -46.50], [-71.00, -45.00], [-70.50, -50.00],
          [-71.00, -51.50], [-71.50, -52.00], [-70.00, -53.00], [-68.50, -54.00],
          [-66.50, -55.00], [-68.00, -55.50], [-70.00, -55.00], [-72.00, -53.50],
          [-74.00, -51.00], [-75.00, -48.50], [-74.00, -47.50], [-73.00, -47.00]
        ]]
      }
    }
  ]
};

const outputDir = path.join(__dirname, '..', 'public', 'geo');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(
  path.join(outputDir, 'chile-regiones.json'),
  JSON.stringify(chileGeoJSON, null, 2)
);

console.log('✅ chile-regiones.json generado con', chileGeoJSON.features.length, 'regiones');
