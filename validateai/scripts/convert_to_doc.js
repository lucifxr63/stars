import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

const docsDir = path.join(process.cwd(), '../docs');
const validateaiDir = process.cwd();
const exportDir = path.join(docsDir, 'export_word');

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

const filesToConvert = [
  { src: path.join(docsDir, 'VALIDATEAI_V3_STATUS.md'), name: 'VALIDATEAI_V3_STATUS.doc' },
  { src: path.join(docsDir, 'STARTUPS_NEW.MD'), name: 'STARTUPS_NEW.doc' },
  { src: path.join(docsDir, 'STARTUPS_ANALYSIS_P1_VALIDATEAI.md'), name: 'STARTUPS_ANALYSIS_P1_VALIDATEAI.doc' },
  { src: path.join(validateaiDir, 'CLAUDE.md'), name: 'CLAUDE.doc' },
  { src: path.join(validateaiDir, 'SPRINTS.md'), name: 'SPRINTS.doc' },
  { src: path.join(validateaiDir, 'AUDITORIA_BACKEND_FRONTEND.md'), name: 'AUDITORIA_BACKEND_FRONTEND.doc' }
];

const htmlWrapper = (content) => `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Export</title>
<style>
  body { font-family: Calibri, sans-serif; line-height: 1.5; padding: 20px; }
  h1, h2, h3 { color: #2C3E50; }
  code { background-color: #F8F9FA; padding: 2px 4px; font-family: Consolas, monospace; }
  pre { background-color: #F8F9FA; padding: 10px; border-left: 4px solid #7C6FF7; font-family: Consolas, monospace; white-space: pre-wrap; }
</style>
</head>
<body>
${content}
</body>
</html>
`;

filesToConvert.forEach(file => {
  if (fs.existsSync(file.src)) {
    const mdContent = fs.readFileSync(file.src, 'utf8');
    const htmlContent = marked.parse(mdContent);
    const docContent = htmlWrapper(htmlContent);
    fs.writeFileSync(path.join(exportDir, file.name), docContent);
    console.log(`✅ Converted ${file.name}`);
  } else {
    console.log(`❌ Not found: ${file.src}`);
  }
});
