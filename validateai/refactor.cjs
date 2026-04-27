const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        filelist.push(path.join(dir, file));
      }
    }
  });
  return filelist;
};

const map = [
  // Fondos claros
  { rx: /(?<!dark:)\bbg-white\b(?!.*dark:bg-)/g, rep: "bg-white dark:bg-[#12121A]" },
  { rx: /(?<!dark:)\bbg-gray-50\b(?!.*dark:bg-)/g, rep: "bg-gray-50 dark:bg-[#0A0A0F]" },
  { rx: /(?<!dark:)\bbg-gray-100\b(?!.*dark:bg-)/g, rep: "bg-gray-100 dark:bg-white/5" },
  // Textos claros
  { rx: /(?<!dark:)\btext-gray-900\b(?!.*dark:text-)/g, rep: "text-gray-900 dark:text-[#F0EFF8]" },
  { rx: /(?<!dark:)\btext-gray-800\b(?!.*dark:text-)/g, rep: "text-gray-800 dark:text-[#F0EFF8]" },
  { rx: /(?<!dark:)\btext-gray-700\b(?!.*dark:text-)/g, rep: "text-gray-700 dark:text-[#C4C4D4]" },
  { rx: /(?<!dark:)\btext-gray-600\b(?!.*dark:text-)/g, rep: "text-gray-600 dark:text-[#8B8AA0]" },
  { rx: /(?<!dark:)\btext-gray-500\b(?!.*dark:text-)/g, rep: "text-gray-500 dark:text-[#8B8AA0]" },
  // Bordes claros
  { rx: /(?<!dark:)\bborder-gray-200\b(?!.*dark:border-)/g, rep: "border-gray-200 dark:border-white/10" },
  { rx: /(?<!dark:)\bborder-gray-100\b(?!.*dark:border-)/g, rep: "border-gray-100 dark:border-white/5" },

  // Fondos oscuros hardcodeados (Landing, Header, etc)
  { rx: /(?<!dark:)\bbg-\[#0A0A0F\]\b(?!.*dark:bg-)/g, rep: "bg-gray-50 dark:bg-[#0A0A0F]" },
  { rx: /(?<!dark:)\bbg-\[#12121A\]\b(?!.*dark:bg-)/g, rep: "bg-white dark:bg-[#12121A]" },
  { rx: /(?<!dark:)\bbg-\[#1A1A26\]\b(?!.*dark:bg-)/g, rep: "bg-gray-50 dark:bg-[#1A1A26]" },
  { rx: /(?<!dark:)\bbg-white\/5\b(?!.*dark:bg-)/g, rep: "bg-gray-100 dark:bg-white/5" },
  { rx: /(?<!dark:)\bbg-white\/8\b(?!.*dark:bg-)/g, rep: "bg-gray-200 dark:bg-white/8" },
  { rx: /(?<!dark:)\bbg-white\/3\b(?!.*dark:bg-)/g, rep: "bg-gray-50 dark:bg-white/3" },
  
  // Textos oscuros
  { rx: /(?<!dark:)\btext-\[#F0EFF8\]\b(?!.*dark:text-)/g, rep: "text-gray-900 dark:text-[#F0EFF8]" },
  { rx: /(?<!dark:)\btext-\[#C4C4D4\]\b(?!.*dark:text-)/g, rep: "text-gray-700 dark:text-[#C4C4D4]" },
  { rx: /(?<!dark:)\btext-\[#8B8AA0\]\b(?!.*dark:text-)/g, rep: "text-gray-500 dark:text-[#8B8AA0]" },

  // Bordes oscuros
  { rx: /(?<!dark:)\bborder-white\/\[0\.06\]\b(?!.*dark:border-)/g, rep: "border-gray-200 dark:border-white/[0.06]" },
  { rx: /(?<!dark:)\bborder-white\/10\b(?!.*dark:border-)/g, rep: "border-gray-200 dark:border-white/10" },
  { rx: /(?<!dark:)\bborder-white\/8\b(?!.*dark:border-)/g, rep: "border-gray-200 dark:border-white/8" },
  { rx: /(?<!dark:)\bborder-white\/6\b(?!.*dark:border-)/g, rep: "border-gray-100 dark:border-white/6" },
  { rx: /(?<!dark:)\bborder-white\/5\b(?!.*dark:border-)/g, rep: "border-gray-100 dark:border-white/5" },
];

const processFiles = (dir) => {
  const files = walkSync(dir);
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // A simpler replacement strategy: Split into className strings, and replace within them
    // This regex matches className="..." and className={...}
    const classRegex = /className=(?:(["'])(.*?)\1|\{`([^`]+)`\}|\{(.*?)\})/gs;
    
    content = content.replace(classRegex, (match) => {
      let newMatch = match;
      map.forEach(m => {
        // Only replace if it doesn't already contain the dark variant we are about to add
        // To be safer, we can just run the replace if the string doesn't already have dark: of that property
        newMatch = newMatch.replace(m.rx, m.rep);
      });
      return newMatch;
    });

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Updated', file);
    }
  });
};

processFiles(path.join(__dirname, 'src', 'components'));
processFiles(path.join(__dirname, 'src', 'app', 'routes'));
