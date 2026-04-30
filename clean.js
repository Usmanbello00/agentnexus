import fs from 'fs';
const file = 'workspaces/estate_db.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const key of ['properties', 'tenants', 'leases', 'emails']) {
  if (data[key]) {
    const unique = [];
    const ids = new Set();
    for (const item of data[key]) {
      if (!ids.has(item.id)) {
        unique.push(item);
        ids.add(item.id);
      }
    }
    data[key] = unique;
  }
}
fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Deduplicated db');
