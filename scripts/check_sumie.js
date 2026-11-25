const fs = require('fs');
const path = require('path');
const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'kinship_catalog_data.json'), 'utf8'));
const item = d.find(x => x.id === 'col-mom-135259');
console.log('Item:', item);
