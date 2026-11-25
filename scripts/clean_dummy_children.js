const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'kinship_catalog_data.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log('Original entries:', data.length);

// Clean up fake dummy child entries
const cleaned = data.map(item => {
  // If char2 is dummy "Ребёнок"
  if (item.char2 && (item.char2.name === 'Ребёнок' || item.char2.russian === 'Ребёнок' || item.char2.id > 1000000)) {
    return {
      ...item,
      char2: null,
      relationLabel: '👑 Мать (Героиня сюжета)',
      note: item.note ? item.note.replace('Ребёнок', '').trim() : ''
    };
  }
  return item;
});

// Also remove any corrupted entries
const valid = cleaned.filter(item => item && item.char1 && item.char1.id && item.char1.name !== 'Ребёнок');

console.log('Cleaned entries:', valid.length);
fs.writeFileSync(filePath, JSON.stringify(valid, null, 2), 'utf8');
console.log('Successfully saved cleaned database!');
