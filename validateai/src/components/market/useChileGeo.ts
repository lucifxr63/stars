import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { geoMercator, type GeoProjection } from 'd3-geo';
import { GEO_NAME_TO_CODE } from './marketRegionConfig';

export interface RegionShape {
  name: string;
  code: string;
  shape: THREE.Shape;
  centroid: [number, number]; // [x, y] en coordenadas Three.js
}

// Proyección centrada en Chile — scale=6 produce coordenadas en ~±3 unidades Three.js
function buildProjection(): GeoProjection {
  return geoMercator()
    .center([-70.6, -35.0])   // centro de masa de Chile (ajustado para mostrar más norte)
    .scale(6)                  // 6 unidades ≈ 5-6 unidades Three.js para toda la altura
    .translate([0, 0]);
}

function coordsToShape(rings: number[][][], projection: GeoProjection): THREE.Shape {
  const outer = rings[0];
  const shape = new THREE.Shape();

  outer.forEach(([lng, lat], i) => {
    const projected = projection([lng, lat]);
    if (!projected) return;
    const [x, y] = projected;
    if (i === 0) shape.moveTo(x, -y);
    else shape.lineTo(x, -y);
  });
  shape.closePath();

  // Holes (anillos adicionales)
  rings.slice(1).forEach(ring => {
    const hole = new THREE.Path();
    ring.forEach(([lng, lat], i) => {
      const projected = projection([lng, lat]);
      if (!projected) return;
      const [x, y] = projected;
      if (i === 0) hole.moveTo(x, -y);
      else hole.lineTo(x, -y);
    });
    hole.closePath();
    shape.holes.push(hole);
  });

  return shape;
}

function getCentroid(ring: number[][], projection: GeoProjection): [number, number] {
  let cx = 0, cy = 0;
  ring.forEach(([lng, lat]) => {
    const p = projection([lng, lat]);
    if (p) { cx += p[0]; cy += -p[1]; }
  });
  return [cx / ring.length, cy / ring.length];
}

export function useChileGeo() {
  const [shapes, setShapes] = useState<RegionShape[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const projection = buildProjection();

    fetch('/geo/chile-regiones.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((geojson: GeoJSON.FeatureCollection) => {
        const result: RegionShape[] = [];

        for (const feature of geojson.features) {
          const props = feature.properties as Record<string, string>;
          const name: string = props.NOM_REG ?? props.name ?? '';
          const code: string = GEO_NAME_TO_CODE[name] ?? props.COD_REG ?? '';

          const geom = feature.geometry;
          if (!geom) continue;

          let rings: number[][][] = [];

          if (geom.type === 'Polygon') {
            rings = geom.coordinates as number[][][];
            const shape = coordsToShape(rings, projection);
            const centroid = getCentroid(rings[0], projection);
            result.push({ name, code, shape, centroid });
          } else if (geom.type === 'MultiPolygon') {
            // Usar solo el polígono más grande
            const biggest = (geom.coordinates as number[][][][]).reduce((best, cur) =>
              cur[0].length > best[0].length ? cur : best
            );
            const shape = coordsToShape(biggest, projection);
            const centroid = getCentroid(biggest[0], projection);
            result.push({ name, code, shape, centroid });
          }
        }

        setShapes(result);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { shapes, loading, error };
}
