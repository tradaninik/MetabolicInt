import type { FoodTaste } from '@mi/engine';

// P4c / U16 - classical taste (rasa) and potency (virya) for every curated food.
//
// Editorial policy (reviewed like code, per spec section 6):
//   - Assignments are the commonly cited classical/neo-classical pattern for the WHOLE
//     DISH as eaten - a dish carries the union of its main ingredients' tastes.
//   - Dairy convention: milk, paneer and milk sweets are sweet and cooling; fresh curd
//     (curd rice, kadhi, misti doi, shrikhand, Greek yogurt) is sour and HEATING, while
//     the buttermilk family (lassi, mor kuzhambu) is cooling - the classical split.
//   - Millets are sweet + astringent; bajra heating, jowar cooling.
//   - Dishes assert only what the classical literature actually says; nothing here is a
//     medical dosing instruction. Dosha effects are DERIVED in the engine
//     (doshaFoodAdvice, saptarasa-dosha matrix) - never hand-written per food.
//   - Full coverage of the 139 curated foods is enforced by the dataset integrity test
//     (packages/food-db/src/__tests__/food-tastes.test.ts); a stale or missing id fails CI.

export const foodTastes: Record<string, FoodTaste> = {
  // ---- Beverages ----
  gujarati_kadhi: { rasa: ['sweet', 'sour'], virya: 'heating' }, // cooked fresh curd
  lassi: { rasa: ['sweet', 'sour'], virya: 'cooling' }, // buttermilk family
  rasam: { rasa: ['sour', 'pungent'], virya: 'heating' },
  mor_kuzhambu: { rasa: ['sour', 'astringent'], virya: 'cooling' },
  rasam_tamil: { rasa: ['sour', 'pungent'], virya: 'heating' },
  filter_coffee: { rasa: ['bitter', 'pungent'], virya: 'heating' },

  // ---- Cereals & staple plates ----
  basanti_rice: { rasa: ['sweet'], virya: 'cooling' },
  luchi: { rasa: ['sweet'], virya: 'heating' }, // fried refined flour
  pizza_margherita: { rasa: ['sweet', 'sour', 'salty'], virya: 'heating' },
  pasta: { rasa: ['sweet', 'sour'], virya: 'heating' },
  sushi_roll: { rasa: ['sweet', 'sour', 'salty'], virya: 'cooling' }, // vinegared rice
  oatmeal: { rasa: ['sweet'], virya: 'heating' },
  whole_wheat_bread: { rasa: ['sweet'], virya: 'heating' },
  white_bread: { rasa: ['sweet'], virya: 'heating' },
  quinoa_cooked: { rasa: ['sweet', 'astringent'], virya: 'heating' },
  burrito: { rasa: ['sweet', 'sour', 'salty', 'pungent'], virya: 'heating' },
  thepla: { rasa: ['bitter', 'pungent', 'sweet'], virya: 'heating' }, // methi leaves
  khichdi: { rasa: ['sweet', 'astringent'], virya: 'cooling' }, // moong-based, gentle
  bhakri_gujarati: { rasa: ['sweet', 'astringent'], virya: 'cooling' }, // jowar
  appam_kerala: { rasa: ['sweet', 'sour'], virya: 'cooling' },
  mattarice_kerala: { rasa: ['sweet', 'astringent'], virya: 'cooling' },
  bhakri_maha: { rasa: ['sweet', 'astringent'], virya: 'cooling' }, // jowar
  sabudana_khichdi: { rasa: ['sweet'], virya: 'heating' }, // peanuts + ghee
  chapati: { rasa: ['sweet'], virya: 'heating' },
  paratha: { rasa: ['sweet', 'pungent'], virya: 'heating' },
  naan: { rasa: ['sweet'], virya: 'heating' },
  jeera_rice: { rasa: ['sweet', 'pungent'], virya: 'cooling' },
  veg_pulao: { rasa: ['sweet', 'pungent'], virya: 'heating' },
  gobi_paratha: { rasa: ['sweet', 'pungent'], virya: 'heating' },
  makki_roti: { rasa: ['sweet', 'astringent'], virya: 'heating' }, // corn
  tandoori_roti: { rasa: ['sweet'], virya: 'heating' },
  dal_baati_churma: { rasa: ['sweet', 'salty', 'pungent'], virya: 'heating' },
  bajre_ki_khichdi: { rasa: ['sweet', 'astringent'], virya: 'heating' },
  bajra_roti: { rasa: ['sweet', 'astringent'], virya: 'heating' },
  idli: { rasa: ['sweet', 'sour'], virya: 'cooling' }, // steamed fermented batter
  plain_dosa: { rasa: ['sweet', 'sour'], virya: 'heating' }, // griddled
  masala_dosa: { rasa: ['sweet', 'sour', 'pungent'], virya: 'heating' },
  upma: { rasa: ['sweet', 'pungent'], virya: 'heating' },
  pongal: { rasa: ['sweet', 'pungent'], virya: 'heating' }, // pepper + ghee
  curd_rice: { rasa: ['sweet', 'sour'], virya: 'heating' }, // fresh curd is heating
  lemon_rice: { rasa: ['sour', 'pungent'], virya: 'heating' },
  tamarind_rice: { rasa: ['sour', 'pungent', 'astringent'], virya: 'heating' },
  white_rice_south: { rasa: ['sweet'], virya: 'cooling' },
  brown_rice_south: { rasa: ['sweet', 'astringent'], virya: 'cooling' },
  appam: { rasa: ['sweet', 'sour'], virya: 'cooling' },
  puttu: { rasa: ['sweet'], virya: 'cooling' }, // steamed rice + coconut
  ven_pongal: { rasa: ['sweet', 'pungent'], virya: 'heating' }, // rava upma
  thayir_sadam_tamil: { rasa: ['sweet', 'sour'], virya: 'heating' },
  venpongal_tamil: { rasa: ['sweet', 'pungent'], virya: 'heating' },
  hyderabadi_biryani: { rasa: ['sweet', 'sour', 'salty', 'pungent'], virya: 'heating' },
  veg_biryani: { rasa: ['sweet', 'sour', 'pungent'], virya: 'heating' },
  andhra_rice: { rasa: ['sweet'], virya: 'cooling' },

  // ---- Dairy ----
  misti_doi: { rasa: ['sweet', 'sour'], virya: 'heating' }, // caramelized curd
  greek_yogurt: { rasa: ['sour', 'sweet'], virya: 'heating' }, // strained curd
  paneer_butter_masala: { rasa: ['sweet', 'sour', 'salty'], virya: 'heating' },
  paneer_tikka: { rasa: ['sweet', 'sour', 'pungent'], virya: 'heating' },

  // ---- Egg ----
  egg_boiled: { rasa: ['sweet'], virya: 'heating' },

  // ---- Fats & sides ----
  coconut_chutney: { rasa: ['sweet', 'pungent', 'astringent'], virya: 'cooling' },

  // ---- Fish ----
  macher_jhol: { rasa: ['sweet', 'pungent'], virya: 'heating' },
  shorshe_chingri: { rasa: ['pungent', 'sweet'], virya: 'heating' }, // mustard
  fish_moilee: { rasa: ['sweet'], virya: 'cooling' }, // coconut-milk gravy
  meen_pollichathu: { rasa: ['sweet', 'pungent'], virya: 'heating' },
  amritsari_fish: { rasa: ['sweet', 'salty'], virya: 'heating' },

  // ---- Fruits ----
  banana: { rasa: ['sweet'], virya: 'cooling' },
  apple: { rasa: ['sweet', 'astringent'], virya: 'cooling' },
  aamras_puri: { rasa: ['sweet', 'sour'], virya: 'heating' }, // mango + fried puri

  // ---- Pulses & legumes ----
  muger_dal: { rasa: ['sweet', 'astringent'], virya: 'cooling' }, // moong
  hummus: { rasa: ['sweet', 'astringent', 'sour'], virya: 'heating' }, // chana + lemon
  tuvar_dal_gujarati: { rasa: ['sweet', 'sour', 'astringent'], virya: 'heating' }, // jaggery + lime
  amti: { rasa: ['sweet', 'sour', 'astringent'], virya: 'heating' },
  pithla: { rasa: ['pungent', 'astringent', 'sweet'], virya: 'heating' }, // besan + garlic
  dal_tadka: { rasa: ['sweet', 'astringent', 'pungent'], virya: 'heating' },
  dal_makhani: { rasa: ['sweet', 'astringent'], virya: 'heating' }, // urad
  chole: { rasa: ['sweet', 'astringent', 'sour', 'pungent'], virya: 'heating' },
  rajma: { rasa: ['sweet', 'astringent', 'sour'], virya: 'heating' },
  chole_punjabi: { rasa: ['sweet', 'astringent', 'sour', 'pungent'], virya: 'heating' },
  dal_fry_punjabi: { rasa: ['sweet', 'astringent', 'pungent'], virya: 'heating' },
  pindi_chole: { rasa: ['sweet', 'astringent', 'sour', 'pungent'], virya: 'heating' },
  kadhi_pakora: { rasa: ['sweet', 'sour', 'pungent'], virya: 'heating' },
  gatte_ki_sabzi: { rasa: ['sour', 'pungent', 'astringent'], virya: 'heating' }, // besan + curd gravy
  pesarattu: { rasa: ['sweet', 'astringent', 'pungent'], virya: 'heating' }, // moong, griddled
  sambar: { rasa: ['sour', 'sweet', 'astringent', 'pungent'], virya: 'heating' },
  sambar_tamil: { rasa: ['sour', 'sweet', 'astringent', 'pungent'], virya: 'heating' },
  pappu_charu: { rasa: ['sour', 'sweet', 'astringent'], virya: 'heating' },
  gongura_pappu: { rasa: ['sour', 'astringent', 'pungent'], virya: 'heating' }, // sorrel leaves
  pesarattu_telugu: { rasa: ['sweet', 'astringent', 'pungent'], virya: 'heating' },

  // ---- Meat ----
  burger: { rasa: ['sweet', 'salty'], virya: 'heating' },
  chicken_breast_grilled: { rasa: ['sweet'], virya: 'heating' },
  stew: { rasa: ['sweet'], virya: 'cooling' }, // coconut-milk ishtu, mild
  beef_fry: { rasa: ['sweet', 'salty', 'pungent'], virya: 'heating' },
  chicken_curry_north: { rasa: ['sweet', 'sour', 'pungent'], virya: 'heating' },
  butter_chicken: { rasa: ['sweet', 'sour', 'salty'], virya: 'heating' },
  chicken_tikka: { rasa: ['sweet', 'sour', 'pungent'], virya: 'heating' },
  laal_maas: { rasa: ['pungent', 'sweet'], virya: 'heating' }, // fiery Mathani chili
  andhra_chicken_curry: { rasa: ['pungent', 'sour', 'sweet'], virya: 'heating' },
  gongura_chicken: { rasa: ['sour', 'pungent', 'sweet'], virya: 'heating' },

  // ---- Snacks ----
  dhokla: { rasa: ['sour', 'sweet', 'astringent'], virya: 'heating' }, // fermented besan
  khandvi: { rasa: ['sour', 'sweet', 'astringent'], virya: 'heating' },
  farsan: { rasa: ['salty', 'sour', 'pungent'], virya: 'heating' },
  handvo: { rasa: ['sour', 'pungent', 'sweet'], virya: 'heating' },
  pav_bhaji: { rasa: ['sweet', 'sour', 'salty', 'pungent'], virya: 'heating' },
  vada_pav: { rasa: ['pungent', 'salty', 'sour', 'sweet'], virya: 'heating' },
  aluvadi: { rasa: ['astringent', 'pungent', 'sour'], virya: 'heating' }, // colocasia leaves
  medhu_vada: { rasa: ['sweet', 'salty'], virya: 'heating' }, // urad
  murukku: { rasa: ['salty', 'pungent', 'astringent'], virya: 'heating' },

  // ---- Sweets ----
  rasgulla: { rasa: ['sweet'], virya: 'cooling' }, // fresh chhena + sugar
  sandesh: { rasa: ['sweet'], virya: 'cooling' },
  payesh: { rasa: ['sweet'], virya: 'cooling' }, // milk kheer
  shrikhand: { rasa: ['sweet', 'sour'], virya: 'heating' }, // strained curd
  parippu_payasam: { rasa: ['sweet'], virya: 'cooling' },
  ada_pradhaman: { rasa: ['sweet'], virya: 'cooling' }, // jaggery + coconut milk
  puran_poli: { rasa: ['sweet'], virya: 'heating' }, // chana + jaggery
  modak: { rasa: ['sweet'], virya: 'heating' }, // jaggery + coconut, steamed
  basundi: { rasa: ['sweet'], virya: 'cooling' }, // reduced milk
  kheer: { rasa: ['sweet'], virya: 'cooling' },
  halwa_soondhi: { rasa: ['sweet'], virya: 'heating' }, // roasted suji + ghee
  gajar_halwa: { rasa: ['sweet'], virya: 'heating' },
  panjiri: { rasa: ['sweet'], virya: 'heating' }, // whole-wheat + ghee + nuts
  mawa_kachori: { rasa: ['sweet'], virya: 'heating' }, // fried
  choorma: { rasa: ['sweet'], virya: 'heating' },
  besan_chakki: { rasa: ['sweet', 'astringent'], virya: 'heating' },
  adhirasam: { rasa: ['sweet'], virya: 'heating' }, // jaggery, fried
  bobbatlu: { rasa: ['sweet'], virya: 'heating' },
  poothareku: { rasa: ['sweet'], virya: 'cooling' }, // rice + ghee + sugar

  // ---- Vegetables ----
  alu_dom: { rasa: ['sweet', 'pungent'], virya: 'heating' },
  chorchori: { rasa: ['pungent', 'astringent'], virya: 'heating' },
  begun_bhaja: { rasa: ['bitter', 'astringent'], virya: 'heating' }, // eggplant, fried
  green_salad: { rasa: ['bitter', 'astringent'], virya: 'cooling' }, // raw leaves
  undhiyu: { rasa: ['sweet', 'pungent', 'astringent'], virya: 'heating' },
  kappa_puzhukku: { rasa: ['sweet', 'astringent'], virya: 'heating' }, // tapioca
  thoran: { rasa: ['pungent', 'astringent'], virya: 'heating' },
  avial: { rasa: ['sweet', 'sour', 'astringent'], virya: 'cooling' }, // curd + coconut
  bharli_vangi: { rasa: ['sweet', 'sour', 'pungent'], virya: 'heating' }, // jaggery + tamarind stuffing
  sarson_ka_saag: { rasa: ['bitter', 'pungent'], virya: 'heating' }, // mustard greens
  ker_sangri: { rasa: ['sour', 'astringent', 'pungent'], virya: 'heating' }, // desert berries
  vathal_kuzhambu: { rasa: ['sour', 'astringent', 'pungent'], virya: 'heating' },
  kootu: { rasa: ['sweet', 'astringent', 'pungent'], virya: 'heating' },
  poriyal: { rasa: ['sweet', 'astringent'], virya: 'cooling' }, // mild, coconut
  pulusu: { rasa: ['sour', 'pungent', 'astringent'], virya: 'heating' },
};
