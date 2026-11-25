const { shiki } = require('../lib/shikimori');
const fs = require('fs');

// We have 102 characters. Let's provide exact verified Shikimori IDs for them:
const exactIds = {
  // One Piece
  'Linlin Charlotte': 54495,
  'Katakuri Charlotte': 150775,
  'Perospero Charlotte': 153794,
  'Cracker Charlotte': 153725,
  'Smoothie Charlotte': 154258,
  'Pudding Charlotte': 149813,
  'Brulee Charlotte': 152902,
  'Oven Charlotte': 156133,
  'Daifuku Charlotte': 156134,
  'Compote Charlotte': 158085,
  'Luffy Monkey D.': 40,
  'Dragon Monkey D.': 4884,
  'Garp Monkey D.': 8064,
  'Ace Portgas D.': 2072,
  'Sabo': 32893,
  'Edward Newgate': 2751,
  'Carmel': 161701,
  'Bell-mere': 8063, // Bellemere
  'Nami': 724,

  // Naruto
  'Naruto Uzumaki': 17,
  'Minato Namikaze': 2535,
  'Kushina Uzumaki': 7302,
  'Hinata Hyuuga': 1555,
  'Hanabi Hyuuga': 12563,
  'Hiashi Hyuuga': 15039,
  'Himawari Uzumaki': 117789,
  'Boruto Uzumaki': 117517,
  'Sasuke Uchiha': 13,
  'Itachi Uchiha': 14,
  'Fugaku Uchiha': 16973,
  'Mikoto Uchiha': 21122,
  'Sarada Uchiha': 117791,
  'Sakura Haruno': 145,
  'Madara Uchiha': 53901,
  'Izuna Uchiha': 16406,
  'Hashirama Senju': 12464,
  'Tobirama Senju': 12465,
  'Jiraiya': 2423,
  'Nagato': 45717,

  // Bleach
  'Ichigo Kurosaki': 5,
  'Isshin Kurosaki': 2553,
  'Masaki Kurosaki': 22849,
  'Karin Kurosaki': 4018,
  'Yuzu Kurosaki': 1096,
  'Orihime Inoue': 7,
  'Kazui Kurosaki': 143634,
  'Souken Ishida': 22844,
  'Uryuu Ishida': 564,
  'Rukia Kuchiki': 6,
  'Renji Abarai': 906,

  // Dragon Ball
  'Son Goku': 246,
  'Son Gohan': 2093, // Gohan Son
  'Son Goten': 2551, // Goten Son
  'Chi-Chi': 2102,
  'Vegeta': 913,
  'Bulma': 678,
  'Trunks': 2707,

  // Attack on Titan
  'Eren Yeager': 40882,
  'Grisha Yeager': 62477,
  'Carla Yeager': 62475,
  'Zeke Yeager': 129767,

  // My Hero Academia
  'Izuku Midoriya': 117909,
  'Inko Midoriya': 139572,
  'Shoto Todoroki': 117917,
  'Enji Todoroki': 141624,
  'Rei Todoroki': 151276,
  'Toya Todoroki': 139578,

  // Fullmetal Alchemist
  'Edward Elric': 11,
  'Alphonse Elric': 12,
  'Van Hohenheim': 9792,
  'Trisha Elric': 10085,

  // Vinland Saga
  'Thorfinn': 10138,
  'Thors': 13021,
  'Ylva': 27876,

  // Evangelion
  'Shinji Ikari': 89,
  'Gendo Ikari': 1257,
  'Yui Ikari': 1258,

  // Gintama
  'Kagura': 1369,
  'Kamui': 2317,
  'Umibouzu': 3424,

  // Hunter x Hunter
  'Gon Freecss': 30,
  'Ging Freecss': 26,
  'Killua Zoldyck': 27,
  'Illumi Zoldyck': 57,
  'Silva Zoldyck': 60,
  'Zeno Zoldyck': 59,

  // Death Note
  'Light Yagami': 80,
  'Soichiro Yagami': 1927,
  'Sayu Yagami': 8135,

  // JoJo
  'Jonathan Joestar': 8087,
  'George Joestar I': 21956,
  'Joseph Joestar': 6356,
  'Jotaro Kujo': 4003,
  'Jolyne Cujoh': 14755,

  // Blue Exorcist
  'Rin Okumura': 24482,
  'Yukio Okumura': 24734,
  'Satan': 21233,
  'Shiro Fujimoto': 30431,

  // Demon Slayer
  'Tanjiro Kamado': 146156,
  'Nezuko Kamado': 146157,
  'Shinobu Kocho': 146736,
  'Kanae Kocho': 173733,

  // Code Geass
  'Lelouch Lamperouge': 417,
  'Nunnally Lamperouge': 1110,

  // Oshi no Ko
  'Ai Hoshino': 188037,
  'Aquamarine Hoshino': 185313,
  'Ruby Hoshino': 186921,

  // Tokyo Ghoul
  'Ken Kaneki': 87275,
  'Touka Kirishima': 87277,
  'Ayato Kirishima': 105231,

  // Inuyasha
  'Inuyasha': 1353,
  'Sesshoumaru': 1358,

  // Re:Zero
  'Rem': 1905,
  'Ram': 61787,

  // Jujutsu Kaisen
  'Satoru Gojo': 164471,
  'Yuji Itadori': 164475,
  'Megumi Fushiguro': 164470,
  'Toji Fushiguro': 187688,
  'Choso': 187687,
  'Maki Zenin': 164482,
  'Mai Zenin': 164483,

  // Spy x Family
  'Loid Forger': 170258,
  'Yor Forger': 170329,
  'Anya Forger': 170256,

  // Berserk
  'Guts': 422,
  'Casca': 423
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function verifyAll() {
  const resolved = {};
  const entries = Object.entries(exactIds);
  console.log(`Starting verification of ${entries.length} characters...`);

  for (let i = 0; i < entries.length; i++) {
    const [name, id] = entries[i];
    try {
      const data = await shiki(`/characters/${id}`);
      resolved[name] = {
        id: data.id,
        name: data.name,
        russian: data.russian || data.name,
        image: data.image?.preview || data.image?.original || ''
      };
      console.log(`[${i+1}/${entries.length}] VERIFIED: ${name} -> ${data.russian} (${data.id}) | img: ${resolved[name].image}`);
    } catch (e) {
      console.error(`[${i+1}/${entries.length}] ERROR: ${name} (id ${id}): ${e.message}`);
    }
    await sleep(350); // Respect rate limits
  }

  fs.writeFileSync('resolved_characters_verified.json', JSON.stringify(resolved, null, 2), 'utf8');
  console.log('Successfully wrote resolved_characters_verified.json!');
}

verifyAll();
