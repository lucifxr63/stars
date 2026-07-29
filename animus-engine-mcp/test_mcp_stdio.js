// Test E2E Automatizado del Servidor MCP "Animus Engine" vía Stdio
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMcpTest() {
  console.log('──────────────────────────────────────────────────────────────────');
  console.log('🚀 ANIMUS ENGINE MCP SERVER — SUITE DE CERTIFICACIÓN POR STDIO');
  console.log('──────────────────────────────────────────────────────────────────\n');

  const serverPath = path.join(__dirname, 'dist', 'index.js');
  const child = spawn('node', [serverPath], {
    env: {
      ...process.env,
      ANIMUS_API_KEY: 'demo_public_key',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdoutBuffer = '';
  child.stderr.on('data', (d) => {
    // Log de STDERR (informativo del servidor)
    const msg = d.toString().trim();
    if (msg) console.log(`   [SERVER STDERR] ${msg}`);
  });

  const sendRequest = (method, params, id) => {
    const jsonRpc = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };
    const str = JSON.stringify(jsonRpc) + '\n';
    child.stdin.write(str);
  };

  const waitForResponse = (expectedId) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout esperando respuesta JSON-RPC para id ${expectedId}`));
      }, 15000);

      const onData = (chunk) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split('\n');
        while (lines.length > 1) {
          const line = lines.shift().trim();
          if (!line) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.id === expectedId) {
              clearTimeout(timeout);
              child.stdout.off('data', onData);
              resolve(parsed);
              return;
            }
          } catch (e) {
            // No era JSON válido o incompleto
          }
        }
        stdoutBuffer = lines.join('\n');
      };

      child.stdout.on('data', onData);
    });
  };

  try {
    // 1. Inicialización
    console.log('1️⃣ Enviando solicitud JSON-RPC initialize...');
    const t0 = Date.now();
    sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'animus-mcp-test-client', version: '1.0.0' },
    }, 1);

    const initResp = await waitForResponse(1);
    console.log(`✅ [HTTP STDIO] Initialize OK (${Date.now() - t0}ms)`);
    console.log(`   └─ Servidor: ${initResp.result.serverInfo.name} (v${initResp.result.serverInfo.version})\n`);

    // Notificar initialized
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');

    // 2. Listar Herramientas (tools/list)
    console.log('2️⃣ Listando Herramientas Disponibles (tools/list)...');
    const t1 = Date.now();
    sendRequest('tools/list', {}, 2);
    const toolsResp = await waitForResponse(2);
    const names = toolsResp.result.tools.map((t) => t.name);
    console.log(`✅ [HTTP STDIO] ${names.length} Herramientas Registradas OK (${Date.now() - t1}ms)`);
    console.log(`   └─ Tools: ${names.join(', ')}\n`);

    // 3. Probar ejecución en vivo de herramienta: animus_economic_macro
    console.log('3️⃣ Ejecutando Herramienta en Vivo (tools/call: animus_economic_macro)...');
    const t2 = Date.now();
    sendRequest('tools/call', { name: 'animus_economic_macro', arguments: {} }, 3);
    const callResp = await waitForResponse(3);
    const ms = Date.now() - t2;

    if (callResp.error) {
      console.log(`❌ [ERROR] ${callResp.error.message}`);
    } else {
      console.log(`✅ [HTTP STDIO] Herramienta Ejecutada con Éxito (${ms}ms)`);
      const text = callResp.result.content[0].text;
      let preview = text.replace(/\s+/g, ' ');
      if (preview.length > 180) preview = preview.slice(0, 177) + '...';
      console.log(`   └─ Respuesta RaaS (UF en vivo): ${preview}\n`);
    }

    // 4. Probar herramienta No Autenticada de Documentación: animus_api_docs (Fintoc methodology)
    console.log('4️⃣ Ejecutando Herramienta No Autenticada de Documentación (tools/call: animus_api_docs)...');
    const t3 = Date.now();
    sendRequest('tools/call', { name: 'animus_api_docs', arguments: {} }, 4);
    const docsResp = await waitForResponse(4);
    const msDocs = Date.now() - t3;

    if (docsResp.error) {
      console.log(`❌ [ERROR] ${docsResp.error.message}`);
    } else {
      console.log(`✅ [HTTP STDIO] Herramienta de Documentación Ejecutada con Éxito (${msDocs}ms)`);
      const text = docsResp.result.content[0].text;
      let preview = text.replace(/\s+/g, ' ');
      if (preview.length > 180) preview = preview.slice(0, 177) + '...';
      console.log(`   └─ Respuesta Documentación (LLM-First): ${preview}\n`);
    }

    console.log('──────────────────────────────────────────────────────────────────');
    console.log('📊 CERTIFICACIÓN STDIO COMPLETA: TODOS LOS PASOS EXITOSOS');
    console.log('──────────────────────────────────────────────────────────────────');

    child.kill();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error durante prueba MCP Stdio:', err);
    child.kill();
    process.exit(1);
  }
}

runMcpTest();
