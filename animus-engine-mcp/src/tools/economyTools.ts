import { z } from 'zod';
import { raasGet } from '../client/raasClient.js';

export const DESC_ECONOMIC_MACRO =
  'Obtener indicadores macroeconómicos chilenos normalizados en tiempo real (UF diaria de la ' +
  'CMF, UTM, TPM, etc.).';

export const EconomicMacroSchema = z.object({}).describe(DESC_ECONOMIC_MACRO);

export const DESC_ECONOMIC_CATALOG =
  'Obtener el catálogo completo multi-proveedor de series económicas almacenadas en base de ' +
  'datos (CMF, SII, BCCh, FRED).';

export const EconomicCatalogSchema = z.object({}).describe(DESC_ECONOMIC_CATALOG);

export async function executeEconomicMacro() {
  const result = await raasGet('/data/macro');
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result),
      },
    ],
  };
}

export async function executeEconomicCatalog() {
  const result = await raasGet('/data/economy');
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result),
      },
    ],
  };
}
