'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const name of fs.readdirSync('src')) {
  if (/\.(js|gs)$/.test(name)) new vm.Script(fs.readFileSync(path.join('src', name), 'utf8'), { filename: name });
}
const manifest = JSON.parse(fs.readFileSync('src/appsscript.json', 'utf8'));
if (manifest.runtimeVersion !== 'V8') throw new Error('Apps Script V8 runtime is required.');
const documents = ['README.md', ...fs.readdirSync('docs').filter(name => name.endsWith('.md')).map(name => path.join('docs', name))];
for (const file of documents) {
  for (const match of fs.readFileSync(file, 'utf8').matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    if (match[1].includes('://') || match[1].startsWith('#')) continue;
    const target = path.resolve(path.dirname(file), match[1].split('#')[0]);
    if (!fs.existsSync(target)) throw new Error('Broken link in ' + file + ': ' + match[1]);
  }
}
console.log('Apps Script syntax, manifest, and local documentation links checked.');
