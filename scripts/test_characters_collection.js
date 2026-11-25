const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'kinship_catalog_data.json'), 'utf8'));

const moms = new Map();
const dads = new Map();
const brothers = new Map();
const sisters = new Map();

data.forEach(p => {
  const t = p.tags || [];
  const c1 = p.char1;
  const c2 = p.char2;

  if (t.includes('mother_son') || t.includes('mother_daughter')) {
    // Determine which is mom
    const isM1 = (c1.role || '').includes('Мать') || /(а|я|ко|на|ри|ка|са)$/i.test(c1.russian || c1.name);
    const mom = isM1 ? c1 : c2;
    const child = isM1 ? c2 : c1;
    if (!moms.has(mom.id)) {
      moms.set(mom.id, {
        id: mom.id,
        name: mom.name,
        russian: mom.russian,
        image: mom.image,
        role: 'Мать',
        anime: p.anime,
        animeRu: p.animeRu || p.anime,
        children: []
      });
    }
    moms.get(mom.id).children.push({
      id: child.id,
      name: child.name,
      russian: child.russian,
      image: child.image,
      relation: t.includes('mother_son') ? 'Сын' : 'Дочь'
    });
  }

  if (t.includes('father_son') || t.includes('father_daughter')) {
    const isF1 = (c1.role || '').includes('Отец') || !/(а|я|ко|на|ри|ка|са)$/i.test(c1.russian || c1.name);
    const dad = isF1 ? c1 : c2;
    const child = isF1 ? c2 : c1;
    if (!dads.has(dad.id)) {
      dads.set(dad.id, {
        id: dad.id,
        name: dad.name,
        russian: dad.russian,
        image: dad.image,
        role: 'Отец',
        anime: p.anime,
        animeRu: p.animeRu || p.anime,
        children: []
      });
    }
    dads.get(dad.id).children.push({
      id: child.id,
      name: child.name,
      russian: child.russian,
      image: child.image,
      relation: t.includes('father_son') ? 'Сын' : 'Дочь'
    });
  }
});

console.log('Moms found:', moms.size);
console.log('Dads found:', dads.size);
console.log('Sample mom:', Array.from(moms.values())[0]);
