const pg = require('pg');

const VERTICAL_KW = {
  gambling: ['casino', 'slot machine', 'jackpot', 'roulette', 'blackjack', 'poker', 'gambling', 'казино', 'слот', 'рулетка', 'покер', 'игровые автоматы', 'азартн'],
  nutra: ['weight loss', 'diet pill', 'fat burner', 'keto diet', 'detox', 'anti-aging', 'supplement', 'skin care', 'hair growth', 'joint pain', 'blood sugar', 'похудение', 'жиросжигат', 'крем от', 'омолож'],
  crypto: ['bitcoin', 'cryptocurrency', 'crypto trading', 'blockchain', 'ethereum', 'btc', 'forex trading', 'trading platform', 'биткоин', 'криптовалют', 'трейдинг'],
  dating: ['dating app', 'dating site', 'meet singles', 'find love', 'hookup', 'знакомства', 'сайт знакомств'],
  ecom: ['free shipping', 'add to cart', 'order now', 'limited offer', 'shop now', 'buy now', 'интернет магазин', 'распродажа', 'купить сейчас'],
  finance: ['personal loan', 'credit card', 'payday loan', 'fast cash', 'insurance', 'mortgage', 'микрозайм', 'быстрый кредит'],
};

function detectVertical(text) {
  if (!text) return 'other';
  const lower = text.toLowerCase();
  let best = 'other', bestScore = 0;
  for (const [v, kws] of Object.entries(VERTICAL_KW)) {
    let score = 0;
    for (const k of kws) {
      if (lower.includes(k)) score++;
    }
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return bestScore >= 1 ? best : 'other';
}

async function main() {
  const c = new pg.Client(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_LCd6qbR3Xuoi@ep-blue-sky-agn7wsyn-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require');
  await c.connect();

  const vres = await c.query('SELECT id, slug FROM verticals');
  const vm = {};
  vres.rows.forEach(r => { vm[r.slug] = r.id; });
  console.log('Verticals map:', Object.keys(vm));

  const ads = await c.query('SELECT id, ad_text FROM ads');
  const counts = { gambling: 0, nutra: 0, crypto: 0, dating: 0, ecom: 0, finance: 0, other: 0 };

  for (const ad of ads.rows) {
    const vert = detectVertical(ad.ad_text);
    counts[vert]++;
    const vertId = vert !== 'other' ? vm[vert] || null : null;
    await c.query('UPDATE ads SET vertical_id = $1 WHERE id = $2', [vertId, ad.id]);
  }

  console.log('Results:', counts);
  console.log('Total:', ads.rows.length);
  await c.end();
}

main().catch(console.error);
