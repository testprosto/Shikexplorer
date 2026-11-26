const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'kinship_catalog_data.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const mcNames = [
  'наруто', 'ичиго', 'гохан', 'гоку', 'эрен', 'идзуку', 'мидория',
  'эдвард', 'элрик', 'альфонс', 'торфинн', 'синдзи', 'аквамарин',
  'руби', 'аква', 'хосино', 'нами', 'робин', 'эйс', 'луффи', 'камуи',
  'сёто', 'тодороки', 'косэй', 'рюдзи', 'танзиро', 'тандиро', 'тандзиро',
  'сатору', 'тоору', 'тору', 'эш', 'кетчум', 'сатоси', 'рюта', 'сакамото',
  'лелуш', 'гон', 'киллуа', 'сумиэ'
];
const mcMoms = [
  'кушина', 'масаки', 'чи-чи', 'чичи', 'карла', 'инко', 'триша',
  'хельга', 'юи икари', 'ай хосино', 'рэй тодороки', 'бельмере',
  'руж', 'ольвия', 'киэ', 'саки арима', 'ясуко такасу', 'сумиэ'
];

const hentaiKeywords = ['невестка, с которой плохо обращались', 'хентай', 'hentai', 'miboujin', 'resort boin', 'tokubetsu jugyou'];

let mcTagged = 0;
let nsfwTagged = 0;

data.forEach(p => {
  if (!p.tags) p.tags = [];

  const isMomRel = p.tags.some(t => t.includes('mother')) || (p.relationLabel || '').toLowerCase().includes('мат');
  const allText = ((p.char1?.russian || '') + ' ' + (p.char1?.name || '') + ' ' + (p.char2 ? (p.char2.russian || '') + ' ' + (p.char2.name || '') : '') + ' ' + (p.animeRu || '') + ' ' + (p.anime || '')).toLowerCase();

  // 1. Tag mother_mc
  if (isMomRel && (mcNames.some(m => allText.includes(m)) || mcMoms.some(m => allText.includes(m)))) {
    if (!p.tags.includes('mother_mc')) {
      p.tags.push('mother_mc');
      mcTagged++;
    }
  }

  // 2. Tag 18+ / Hentai
  const animeText = ((p.animeRu || '') + ' ' + (p.anime || '')).toLowerCase();
  if (hentaiKeywords.some(k => animeText.includes(k))) {
    p.is18Plus = true;
    if (!p.tags.includes('hentai')) p.tags.push('hentai');
    nsfwTagged++;
  }
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Enrichment complete! Tagged ${mcTagged} MC mothers and ${nsfwTagged} 18+ entries.`);
