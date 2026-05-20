import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import HTMLtoDOCX from 'html-to-docx';

const docsDir = path.join(process.cwd(), '../docs');
const validateaiDir = process.cwd();
const exportDir = path.join(docsDir, 'export_word');

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

const filesToConvert = [
  { src: path.join(docsDir, 'VALIDATEAI_V3_STATUS.md'), name: 'VALIDATEAI_V3_STATUS.docx' },
  { src: path.join(docsDir, 'STARTUPS_NEW.MD'), name: 'STARTUPS_NEW.docx' },
  { src: path.join(docsDir, 'STARTUPS_ANALYSIS_P1_VALIDATEAI.md'), name: 'STARTUPS_ANALYSIS_P1_VALIDATEAI.docx' },
  { src: path.join(validateaiDir, 'CLAUDE.md'), name: 'CLAUDE.docx' },
  { src: path.join(validateaiDir, 'SPRINTS.md'), name: 'SPRINTS.docx' },
  { src: path.join(validateaiDir, 'AUDITORIA_BACKEND_FRONTEND.md'), name: 'AUDITORIA_BACKEND_FRONTEND.docx' }
];

async function convertAll() {
  for (const file of filesToConvert) {
    if (fs.existsSync(file.src)) {
      const mdContent = fs.readFileSync(file.src, 'utf8');
      const htmlContent = marked.parse(mdContent);
      
      const fileBuffer = await HTMLtoDOCX(htmlContent, null, {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      });

      fs.writeFileSync(path.join(exportDir, file.name), fileBuffer);
      console.log(`✅ Converted ${file.name}`);
    } else {
      console.log(`❌ Not found: ${file.src}`);
    }
  }
}

convertAll().catch(console.error);
