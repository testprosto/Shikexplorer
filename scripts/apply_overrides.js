const fs = require('fs');
const res = JSON.parse(fs.readFileSync('resolved_characters_verified.json', 'utf8'));

// Exact manual overrides for characters verified with 100% accuracy
const overrides = {
  'Nami': { id: 723, name: 'Nami', russian: 'Нами', image: '/system/characters/preview/723.jpg?1717706843' },
  'Bell-mere': { id: 4890, name: 'Bellemere', russian: 'Бельмере', image: '/system/characters/preview/4890.jpg?1718484750' },
  'Jolyne Cujoh': { id: 11222, name: 'Jolyne Kuujou', russian: 'Джолин Куджо', image: '/system/characters/preview/11222.jpg?1716844557' },
  'Yuji Itadori': { id: 163847, name: 'Yuuji Itadori', russian: 'Юдзи Итадори', image: '/system/characters/preview/163847.jpg?1713218257' },
  'Toji Fushiguro': { id: 175543, name: 'Touji Fushiguro', russian: 'Тодзи Фусигуро', image: '/system/characters/preview/175543.jpg?1713218760' },
  'Choso': { id: 180764, name: 'Chousou', russian: 'Тёсо', image: '/system/characters/preview/180764.jpg?1713219287' },
  'Zeke Yeager': { id: 142314, name: 'Zeke', russian: 'Зик', image: '/system/characters/preview/142314.jpg?1715639282' },
  'Helga': { id: 171366, name: 'Helga', russian: 'Хельга', image: '/system/characters/preview/171366.jpg?1708990865' },
  'Kouka': { id: 155934, name: 'Kouka', russian: 'Кока', image: '/system/characters/preview/155934.jpg?1712063185' },
  'Shiro Fujimoto': { id: 30431, name: 'Shirou Fujimoto', russian: 'Сиро Фудзимото', image: '/system/characters/preview/30431.jpg?1711054649' },
  'Son Goku': { id: 246, name: 'Gokuu Son', russian: 'Гоку Сон', image: '/system/characters/preview/246.jpg?1718571788' },
  'Son Gohan': { id: 2093, name: 'Gohan Son', russian: 'Гохан Сон', image: '/system/characters/preview/2093.jpg?1718053938' },
  'Son Goten': { id: 2551, name: 'Goten Son', russian: 'Готэн Сон', image: '/system/characters/preview/2551.jpg?1718398246' },
  'Shoto Todoroki': { id: 117917, name: 'Shouto Todoroki', russian: 'Сёто Тодороки', image: '/system/characters/preview/117917.jpg?1717880362' },
  'Toya Todoroki': { id: 139578, name: 'Dabi', russian: 'Даби (Тоя Тодороки)', image: '/system/characters/preview/139578.jpg?1718660706' }
};

Object.assign(res, overrides);
fs.writeFileSync('resolved_characters_verified.json', JSON.stringify(res, null, 2), 'utf8');
console.log('Overrides successfully applied to resolved_characters_verified.json!');
