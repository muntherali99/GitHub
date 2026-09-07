import fs from 'fs';

const files = fs.readdirSync('.').filter(f => f.endsWith('.mjs'));
for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/from "\.\.\/shared\//g, 'from "./');
  content = content.replace(/from "\.\.\/server\//g, 'from "./');
  fs.writeFileSync(file, content);
}
console.log('Fixed mjs imports');
