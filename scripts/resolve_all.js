const fs = require('fs');

const charactersToResolve = [
  'Linlin Charlotte', 'Katakuri Charlotte', 'Perospero Charlotte', 'Smoothie Charlotte', 'Pudding Charlotte', 'Brulee Charlotte', 'Oven Charlotte', 'Daifuku Charlotte', 'Cracker Charlotte', 'Compote Charlotte', 'Luffy Monkey D.', 'Dragon Monkey D.', 'Garp Monkey D.', 'Ace Portgas D.', 'Sabo', 'Edward Newgate', 'Carmel', 'Bell-mere', 'Nami',
  'Naruto Uzumaki', 'Minato Namikaze', 'Kushina Uzumaki', 'Hinata Hyuuga', 'Hanabi Hyuuga', 'Hiashi Hyuuga', 'Himawari Uzumaki', 'Boruto Uzumaki', 'Sasuke Uchiha', 'Itachi Uchiha', 'Fugaku Uchiha', 'Mikoto Uchiha', 'Sarada Uchiha', 'Sakura Haruno', 'Madara Uchiha', 'Izuna Uchiha', 'Hashirama Senju', 'Tobirama Senju', 'Jiraiya', 'Nagato',
  'Ichigo Kurosaki', 'Isshin Kurosaki', 'Masaki Kurosaki', 'Karin Kurosaki', 'Yuzu Kurosaki', 'Orihime Inoue', 'Kazui Kurosaki', 'Souken Ishida', 'Uryuu Ishida', 'Rukia Kuchiki', 'Renji Abarai', 'Kuukaku Shiba', 'Ganju Shiba', 'Kaien Shiba',
  'Tanjiro Kamado', 'Nezuko Kamado', 'Tanjuro Kamado', 'Kie Kamado', 'Shinobu Kocho', 'Kanae Kocho', 'Kanao Tsuyuri',
  'Eren Yeager', 'Grisha Yeager', 'Carla Yeager', 'Zeke Yeager',
  'Edward Elric', 'Alphonse Elric', 'Van Hohenheim', 'Trisha Elric',
  'Son Goku', 'Son Gohan', 'Son Goten', 'Chi-Chi', 'Vegeta', 'Bulma', 'Trunks',
  'Gon Freecss', 'Ging Freecss', 'Killua Zoldyck', 'Illumi Zoldyck', 'Silva Zoldyck', 'Zeno Zoldyck', 'Alluka Zoldyck', 'Kalluto Zoldyck',
  'Satoru Gojo', 'Yuji Itadori', 'Choso', 'Megumi Fushiguro', 'Toji Fushiguro', 'Maki Zenin', 'Mai Zenin',
  'Loid Forger', 'Yor Forger', 'Anya Forger', 'Yuri Briar',
  'Ai Hoshino', 'Aquamarine Hoshino', 'Ruby Hoshino',
  'Rem', 'Ram',
  'Lelouch Lamperouge', 'Nunnally Lamperouge', 'Charles zi Britannia',
  'Izuku Midoriya', 'Inko Midoriya', 'Shoto Todoroki', 'Enji Todoroki', 'Rei Todoroki', 'Toya Todoroki',
  'Light Yagami', 'Soichiro Yagami', 'Sayu Yagami',
  'Thorfinn', 'Thors', 'Ylva',
  'Jonathan Joestar', 'George Joestar I', 'Joseph Joestar', 'Jotaro Kujo', 'Holly Kujo', 'Jolyne Cujoh',
  'Natsu Dragneel', 'Zeref Dragneel', 'Igneel', 'Gray Fullbuster', 'Silver Fullbuster',
  'Ken Kaneki', 'Touka Kirishima', 'Ayato Kirishima',
  'Guts', 'Casca',
  'Rin Okumura', 'Yukio Okumura', 'Satan',
  'Shinji Ikari', 'Gendo Ikari', 'Yui Ikari',
  'Kagura', 'Kamui', 'Umibouzu',
  'Sesshoumaru', 'Inuyasha'
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  const results = {};
  for (let i = 0; i < charactersToResolve.length; i++) {
    const name = charactersToResolve[i];
    try {
      const res = await fetch('https://shikimori.one/api/characters/search?search=' + encodeURIComponent(name), {
        headers: { 'User-Agent': 'ShikimoriTitleExplorer/3.0 (https://github.com/shikimori; contact@shikimori.me)' }
      });
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        // Find best match
        const exact = items.find(x => x.name.toLowerCase() === name.toLowerCase()) ||
                      items.find(x => x.name.toLowerCase().includes(name.toLowerCase().split(' ')[0])) ||
                      items[0];
        results[name] = {
          id: exact.id,
          name: exact.name,
          russian: exact.russian || exact.name,
          image: exact.image?.preview || exact.image?.original || ''
        };
        console.log(`[${i+1}/${charactersToResolve.length}] OK: ${name} -> ${exact.russian} (${exact.id})`);
      } else {
        console.log(`[${i+1}/${charactersToResolve.length}] NOT FOUND: ${name}`);
        results[name] = null;
      }
    } catch (e) {
      console.error(`[${i+1}/${charactersToResolve.length}] ERROR: ${name} - ${e.message}`);
      results[name] = null;
    }
    await sleep(200); // polite rate limit
  }

  fs.writeFileSync('resolved_characters.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log('Finished writing resolved_characters.json');
})();
