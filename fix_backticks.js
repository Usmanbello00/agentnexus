import fs from 'fs';
const file = 'src/components/AdminDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');
fs.writeFileSync(file, content);
console.log('Fixed backticks');
