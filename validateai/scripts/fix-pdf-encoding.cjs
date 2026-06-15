// Repara mojibake cp1252-double-encoded en los literales de los PDFs.
// El mojibake se generó al decodificar bytes UTF-8 como Windows-1252 y reguardar.
// Reverso: por cada caracter "bueno" G, su mojibake = cp1252decode(utf8bytes(G)).
// Reemplaza esas secuencias (que nunca aparecen en texto legítimo) por G.
// Deja intacto el Unicode legítimo (─ box-drawing en comentarios, etc.).
const fs = require('fs');

// Windows-1252 0x80-0x9F → Unicode (resto == latin1)
const CP1252 = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
};
function cp1252decode(buf) {
  let out = '';
  for (const b of buf) out += String.fromCharCode(CP1252[b] ?? b);
  return out;
}

// Caracteres "buenos" que queremos restaurar
const GOOD = [
  'á','é','í','ó','ú','ñ','ü','Á','É','Í','Ó','Ú','Ñ',
  '·','¿','¡','º','ª','°','€',
  '–','—','›','‹','•','…','✓','“','”','‘','’','™',
  '─','│','┌','┐','└','┘','├','┤','→','←','★','●','■','►','▸','✦','✱','✗','✕','×',
];

const map = [];
for (const g of GOOD) {
  const key = cp1252decode(Buffer.from(g, 'utf8'));
  if (key !== g && key.length) map.push([key, g]);
}
// Reemplazar primero las claves más largas para evitar solapamientos
map.sort((a, b) => b[0].length - a[0].length);

const apply = process.argv.includes('--apply');
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));

for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const hadBOM = s.charCodeAt(0) === 0xFEFF;
  if (hadBOM) s = s.slice(1);

  let repaired = s;
  for (const [key, g] of map) repaired = repaired.split(key).join(g);

  // Diagnóstico de mojibake residual (secuencias Ã_/Â_/â_ que casi nunca son legítimas)
  const moji = (str) => (str.match(/[ÃÂ][-¿]|â[-ÿ -⃿]/g) || []).length;
  console.log(`${f}\n   BOM:${hadBOM}  moji antes:${moji(s)}  moji después:${moji(repaired)}  cambió:${repaired !== s}`);

  if (apply && repaired !== s) {
    fs.writeFileSync(f, repaired, 'utf8'); // sin BOM
    console.log('   -> escrito');
  }
}
console.log(`\nMapa (${map.length} pares): ${map.map(([k, g]) => g).join(' ')}`);
