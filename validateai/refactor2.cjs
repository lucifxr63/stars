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
  // Fondos oscuros hardcodeados
  { rx: /(?<!dark:)\bbg-\[#0A0A0F\](?![a-zA-Z0-9_-])(?!.*dark:bg-)/g, rep: "bg-gray-50 dark:bg-[#0A0A0F]" },
  { rx: /(?<!dark:)\bbg-\[#12121A\](?![a-zA-Z0-9_-])(?!.*dark:bg-)/g, rep: "bg-white dark:bg-[#12121A]" },
  { rx: /(?<!dark:)\bbg-\[#1A1A26\](?![a-zA-Z0-9_-])(?!.*dark:bg-)/g, rep: "bg-gray-50 dark:bg-[#1A1A26]" },
  
  // Textos oscuros
  { rx: /(?<!dark:)\btext-\[#F0EFF8\](?![a-zA-Z0-9_-])(?!.*dark:text-)/g, rep: "text-gray-900 dark:text-[#F0EFF8]" },
  { rx: /(?<!dark:)\btext-\[#C4C4D4\](?![a-zA-Z0-9_-])(?!.*dark:text-)/g, rep: "text-gray-700 dark:text-[#C4C4D4]" },
  { rx: /(?<!dark:)\btext-\[#8B8AA0\](?![a-zA-Z0-9_-])(?!.*dark:text-)/g, rep: "text-gray-500 dark:text-[#8B8AA0]" },

  // Especial: dark:bg-[#12121A]/5 que quedó roto
  { rx: /(?<!dark:)\bbg-white dark:bg-\[#12121A\]\/5(?![a-zA-Z0-9_-])/g, rep: "bg-gray-100 dark:bg-white/5" },
  { rx: /(?<!dark:)\bbg-white dark:bg-\[#12121A\]\/2(?![a-zA-Z0-9_-])/g, rep: "bg-white dark:bg-white/5" },
];

const processFiles = (dir) => {
  const files = walkSync(dir);
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    const classRegex = /className=(?:(["'])(.*?)\1|\{`([^`]+)`\}|\{(.*?)\})/gs;
    
    content = content.replace(classRegex, (match) => {
      let newMatch = match;
      map.forEach(m => {
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
