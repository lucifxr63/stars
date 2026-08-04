import { z } from 'zod';
import { raasGet } from '../client/raasClient.js';

// El gateway pagina con `page_size`, NO con `limit`: ignora el segundo.
// Estas herramientas enviaban `limit` y por eso devolvian siempre 20 items
// (~92 KB de licitaciones, ~132 KB de compra agil) sin importar lo que pidiera
// el usuario. En un MCP eso no es un detalle: cada llamada llenaba el contexto
// del modelo con veinte veces lo pedido.


export const LicitusActivasSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().describe('Número máximo de licitaciones a consultar (default: 10)'),
});

export const LicitusCompraAgilSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().describe('Número máximo de compras ágiles a consultar (default: 10)'),
});

export async function executeLicitusActivas(args: z.infer<typeof LicitusActivasSchema>) {
  const result = await raasGet('/mercado-publico/licitaciones', { page_size: args.limit || 10 });
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result),
      },
    ],
  };
}

export async function executeLicitusCompraAgil(args: z.infer<typeof LicitusCompraAgilSchema>) {
  const result = await raasGet('/mercado-publico/compra-agil', { page_size: args.limit || 10 });
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result),
      },
    ],
  };
}
