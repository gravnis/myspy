require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const vr = await c.query('SELECT id, slug FROM verticals');
  const vmap = {};
  vr.rows.forEach(r => { vmap[r.slug] = r.id; });
  console.log('Verticals:', Object.keys(vmap));

  const patterns = [
    ['gambling', '(gambl|casino|slot|poker|bet |betting|blackjack|roulette|jackpot|spin.*win|lucky.*win)'],
    ['nutra', '(weight|slim|diet|keto|health|supplement|vitamin|pill|capsule|cream|serum|wrinkle|collagen|detox|cleanse|fat.*burn|lose.*weight|anti.*aging)'],
    ['crypto', '(crypto|bitcoin|btc|ethereum|eth|token|blockchain|nft|defi|trading.*bot|binance|coinbase)'],
    ['finance', '(finance|loan|credit|mortgage|invest|insurance|banking|forex|stock.*market|trading|broker)'],
    ['dating', '(dating|single|match|love|relationship|hookup|meet.*people|find.*partner|tinder|bumble)'],
    ['ecom', '(shop|buy|sale|discount|offer|deal|order|price|shipping|delivery|store|product|free.*shipping|limited.*time)'],
  ];

  for (const [slug, pattern] of patterns) {
    const vid = vmap[slug];
    if (!vid) { console.log('No vertical for', slug); continue; }
    const r = await c.query(`
      UPDATE ads SET vertical_id = $1
      WHERE vertical_id IS NULL
      AND lower(coalesce(ad_text,'') || ' ' || coalesce(link_title,'') || ' ' || coalesce(advertiser_name,'') || ' ' || coalesce(landing_url,'')) ~ $2
    `, [vid, pattern]);
    console.log(slug, ':', r.rowCount, 'updated');
  }

  // Remaining -> 'other'
  let otherId = vmap['other'];
  if (!otherId) {
    const ir = await c.query("INSERT INTO verticals (id, name, slug) VALUES (gen_random_uuid(), 'Other', 'other') RETURNING id");
    otherId = ir.rows[0].id;
    console.log('Created other vertical:', otherId);
  }
  const rem = await c.query('UPDATE ads SET vertical_id = $1 WHERE vertical_id IS NULL', [otherId]);
  console.log('other:', rem.rowCount, 'updated');

  // Final
  const final = await c.query('SELECT v.slug, count(a.id) as cnt FROM verticals v LEFT JOIN ads a ON a.vertical_id = v.id GROUP BY v.slug ORDER BY cnt DESC');
  console.log('\n=== Final distribution ===');
  final.rows.forEach(r => console.log(r.slug, '-', r.cnt));

  await c.end();
}

main().catch(console.error);
