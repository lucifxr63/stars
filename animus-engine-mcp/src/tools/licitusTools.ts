import { z } from 'zod';
import { raasGet } from '../client/raasClient.js';

export const LicitusActivasSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().describe('Número máximo de licitaciones a consultar (default: 10)'),
});

export const LicitusCompraAgilSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().describe('Número máximo de compras ágiles a consultar (default: 10)'),
});

export async function executeLicitusActivas(args: z.infer<typeof LicitusActivasSchema>) {
  const result = await raasGet('/mercado-publico/licitaciones', { limit: args.limit || 10 });
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export async function executeLicitusCompraAgil(args: z.infer<typeof LicitusCompraAgilSchema>) {
  const result = await raasGet('/mercado-publico/compra-agil', { limit: args.limit || 10 });
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
