import { z } from 'zod';
import { raasGet } from '../client/raasClient.js';

export const EconomicMacroSchema = z.object({}).describe('Obtener indicadores macroeconómicos chilenos normalizados en tiempo real (UF diaria de la CMF, UTM, TPM, etc.)');

export const EconomicCatalogSchema = z.object({}).describe('Obtener el catálogo completo multi-proveedor de series económicas en la base de datos (CMF, SII, BCCh, FRED)');

export async function executeEconomicMacro() {
  const result = await raasGet('/data/macro');
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
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
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
