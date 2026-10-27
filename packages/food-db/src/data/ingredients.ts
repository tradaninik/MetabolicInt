import type { Food } from '@mi/engine';

// P7.1 — the raw-ingredient catalog. The regional files carry COOKED dishes
// (what you log when you eat); this module carries the RAW building blocks
// (what you cook with). It exists so the recipe editor's ingredient search
// returns "rice, toor dal, onion" instead of "Hyderabadi Biryani, Pappu
// Charu" (the Day-1 bug), and it is exactly the FK target the P8 recipe
// pipeline computes macros from (ingredient qty x per-100g below).
//
// Nutrition per 100g as eaten RAW/uncooked, estimated from IFCT (NIN) and
// USDA FoodData Central - educational approximations, same honesty policy
// as the rest of the food-db. GI is the cooked-dish approximation for the
// ingredient class (Foster-Powell / Atkinson tables); pure fats/proteins
// carry GI 0. servingGrams is a sensible raw portion, display-only.
//
// All entries are region 'global' (pantry staples are pan-Indian) and get a
// 'spice' category where applicable - new union member, honest bin.

// ---------- Grains, flours & breakfast bases ----------
export const ingredientFoods: Food[] = [
  {
    id: 'rice_sona_masoori', name: 'Rice (Sona Masoori, raw)', aliases: ['sona masoori', 'raw rice', 'rice raw', 'biyyam', 'akki'],
    region: 'global', category: 'cereal', servingGrams: 75,
    kcalPer100g: 345, carbsPer100g: 77, proteinPer100g: 7, fatPer100g: 0.8, fiberPer100g: 1.5, gi: 72,
  },
  {
    id: 'rice_basmati_raw', name: 'Basmati rice (raw)', aliases: ['basmati', 'basmati rice'],
    region: 'global', category: 'cereal', servingGrams: 75,
    kcalPer100g: 345, carbsPer100g: 77, proteinPer100g: 7.5, fatPer100g: 0.6, fiberPer100g: 1.3, gi: 58,
  },
  {
    id: 'rice_idli_raw', name: 'Idli rice (parboiled, raw)', aliases: ['idli rice', 'parboiled rice', 'puzhungal arisi'],
    region: 'global', category: 'cereal', servingGrams: 75,
    kcalPer100g: 345, carbsPer100g: 78, proteinPer100g: 6.5, fatPer100g: 0.9, fiberPer100g: 1.6, gi: 70,
  },
  {
    id: 'rice_flour', name: 'Rice flour', aliases: ['rice atta', 'biyyam pindi', 'arisi maavu'],
    region: 'global', category: 'cereal', servingGrams: 60,
    kcalPer100g: 359, carbsPer100g: 79, proteinPer100g: 6, fatPer100g: 1, fiberPer100g: 2.4, gi: 75,
  },
  {
    id: 'poha_flattened_rice', name: 'Poha (flattened rice)', aliases: ['poha', 'atukulu', 'aval', 'flattened rice', 'beaten rice'],
    region: 'global', category: 'cereal', servingGrams: 60,
    kcalPer100g: 350, carbsPer100g: 78, proteinPer100g: 6.6, fatPer100g: 1.2, fiberPer100g: 2.7, gi: 70,
  },
  {
    id: 'wheat_flour_atta', name: 'Whole-wheat flour (atta)', aliases: ['atta', 'wheat flour', 'godhuma pindi', 'gehu ka atta'],
    region: 'global', category: 'cereal', servingGrams: 80,
    kcalPer100g: 340, carbsPer100g: 72, proteinPer100g: 12, fatPer100g: 1.7, fiberPer100g: 12, gi: 54,
  },
  {
    id: 'maida', name: 'Maida (refined wheat flour)', aliases: ['maida', 'all purpose flour', 'refined flour'],
    region: 'global', category: 'cereal', servingGrams: 60,
    kcalPer100g: 350, carbsPer100g: 74, proteinPer100g: 9, fatPer100g: 1, fiberPer100g: 2.7, gi: 71,
  },
  {
    id: 'sooji_rava', name: 'Sooji / rava (semolina)', aliases: ['sooji', 'rava', 'suji', 'semolina', 'upma rava', 'bombay rava'],
    region: 'global', category: 'cereal', servingGrams: 60,
    kcalPer100g: 360, carbsPer100g: 76, proteinPer100g: 10, fatPer100g: 1, fiberPer100g: 2.3, gi: 66,
  },
  {
    id: 'besan', name: 'Besan (gram flour)', aliases: ['besan', 'gram flour', 'chana flour', 'senaga pindi', 'kadala maavu'],
    region: 'global', category: 'cereal', servingGrams: 50,
    kcalPer100g: 387, carbsPer100g: 58, proteinPer100g: 22, fatPer100g: 6, fiberPer100g: 11, gi: 44,
  },
  {
    id: 'oats_rolled', name: 'Rolled oats', aliases: ['oats', 'oatmeal', 'oatmeal raw', 'jai'],
    region: 'global', category: 'cereal', servingGrams: 40,
    kcalPer100g: 379, carbsPer100g: 67, proteinPer100g: 13, fatPer100g: 7, fiberPer100g: 10, gi: 55,
  },
  {
    id: 'ragi_flour', name: 'Ragi flour (finger millet)', aliases: ['ragi', 'finger millet', 'ragi flour', 'mandia', 'kelvaragu'],
    region: 'global', category: 'cereal', servingGrams: 60,
    kcalPer100g: 328, carbsPer100g: 72, proteinPer100g: 10, fatPer100g: 1.9, fiberPer100g: 11, gi: 60,
  },
  {
    id: 'jowar_flour', name: 'Jowar flour (sorghum)', aliases: ['jowar', 'sorghum', 'jowar flour', 'jonna', 'cholam'],
    region: 'global', category: 'cereal', servingGrams: 60,
    kcalPer100g: 349, carbsPer100g: 73, proteinPer100g: 10, fatPer100g: 1.9, fiberPer100g: 9, gi: 60,
  },
  {
    id: 'bajra_flour', name: 'Bajra flour (pearl millet)', aliases: ['bajra', 'pearl millet', 'bajra flour', 'sajje', 'kambu'],
    region: 'global', category: 'cereal', servingGrams: 60,
    kcalPer100g: 361, carbsPer100g: 67, proteinPer100g: 12, fatPer100g: 5, fiberPer100g: 12, gi: 62,
  },
  {
    id: 'foxtail_millet', name: 'Foxtail millet (raw)', aliases: ['foxtail millet', 'korra', 'kakum', 'navane', 'thinai'],
    region: 'global', category: 'cereal', servingGrams: 60,
    kcalPer100g: 331, carbsPer100g: 63, proteinPer100g: 12, fatPer100g: 4, fiberPer100g: 8, gi: 55,
  },
  {
    id: 'little_millet', name: 'Little millet (raw)', aliases: ['little millet', 'samai', 'kutki', 'sama'],
    region: 'global', category: 'cereal', servingGrams: 60,
    kcalPer100g: 329, carbsPer100g: 67, proteinPer100g: 7, fatPer100g: 4, fiberPer100g: 8, gi: 55,
  },
  {
    id: 'kodo_millet', name: 'Kodo millet (raw)', aliases: ['kodo millet', 'varagu', 'arikelu', 'kodo'],
    region: 'global', category: 'cereal', servingGrams: 60,
    kcalPer100g: 349, carbsPer100g: 66, proteinPer100g: 8, fatPer100g: 3, fiberPer100g: 9, gi: 55,
  },
  {
    id: 'barnyard_millet', name: 'Barnyard millet (raw)', aliases: ['barnyard millet', 'udalu', 'kuthiraivali', 'sama rice'],
    region: 'global', category: 'cereal', servingGrams: 60,
    kcalPer100g: 325, carbsPer100g: 67, proteinPer100g: 6, fatPer100g: 3, fiberPer100g: 9, gi: 55,
  },
  {
    id: 'maize_flour', name: 'Maize flour (makki)', aliases: ['makki ka atta', 'corn flour', 'makka jonna pindi', 'makai'],
    region: 'global', category: 'cereal', servingGrams: 60,
    kcalPer100g: 357, carbsPer100g: 76, proteinPer100g: 9, fatPer100g: 3.9, fiberPer100g: 13, gi: 68,
  },
  {
    id: 'sabudana', name: 'Sabudana (sago pearls)', aliases: ['sago', 'sabudana', 'saggubiyyam', 'javvarisi', 'tapioca pearls'],
    region: 'global', category: 'cereal', servingGrams: 50,
    kcalPer100g: 350, carbsPer100g: 87, proteinPer100g: 0.2, fatPer100g: 0.2, fiberPer100g: 0.9, gi: 70,
  },
  {
    id: 'vermicelli_semiya', name: 'Vermicelli (semiya)', aliases: ['semiya', 'sevai', 'vermicelli', 'shavige'],
    region: 'global', category: 'cereal', servingGrams: 60,
    kcalPer100g: 358, carbsPer100g: 76, proteinPer100g: 9, fatPer100g: 1, fiberPer100g: 2.5, gi: 60,
  },
  {
    id: 'quinoa_raw', name: 'Quinoa (raw)', aliases: ['quinoa'],
    region: 'global', category: 'cereal', servingGrams: 60,
    kcalPer100g: 368, carbsPer100g: 64, proteinPer100g: 14, fatPer100g: 6, fiberPer100g: 7, gi: 53,
  },

  // ---------- Dals & legumes (raw) ----------
  {
    id: 'toor_dal', name: 'Toor dal (raw)', aliases: ['toor dal', 'arhar dal', 'pigeon pea', 'kandi pappu', 'togari bele', 'tuvaram paruppu'],
    region: 'global', category: 'legume', servingGrams: 50,
    kcalPer100g: 343, carbsPer100g: 62, proteinPer100g: 22, fatPer100g: 1.5, fiberPer100g: 15, gi: 30,
  },
  {
    id: 'moong_dal_split', name: 'Moong dal, split (raw)', aliases: ['moong dal', 'yellow moong dal', 'pesara pappu', 'pasi paruppu'],
    region: 'global', category: 'legume', servingGrams: 50,
    kcalPer100g: 347, carbsPer100g: 63, proteinPer100g: 24, fatPer100g: 1.2, fiberPer100g: 16, gi: 30,
  },
  {
    id: 'moong_whole', name: 'Whole moong (green gram, raw)', aliases: ['whole moong', 'green gram', 'pesalu', 'cheru payaru', 'mung'],
    region: 'global', category: 'legume', servingGrams: 50,
    kcalPer100g: 347, carbsPer100g: 63, proteinPer100g: 24, fatPer100g: 1.2, fiberPer100g: 16, gi: 30,
  },
  {
    id: 'urad_dal', name: 'Urad dal, split (raw)', aliases: ['urad dal', 'black gram split', 'minapa pappu', 'ulundhu'],
    region: 'global', category: 'legume', servingGrams: 50,
    kcalPer100g: 347, carbsPer100g: 60, proteinPer100g: 24, fatPer100g: 1.4, fiberPer100g: 18, gi: 32,
  },
  {
    id: 'urad_whole', name: 'Whole urad (black gram, raw)', aliases: ['whole urad', 'black gram', 'masha', 'minumulu'],
    region: 'global', category: 'legume', servingGrams: 50,
    kcalPer100g: 347, carbsPer100g: 60, proteinPer100g: 24, fatPer100g: 1.4, fiberPer100g: 18, gi: 32,
  },
  {
    id: 'chana_dal', name: 'Chana dal (raw)', aliases: ['chana dal', 'split bengal gram', 'senaga pappu', 'kadalai paruppu'],
    region: 'global', category: 'legume', servingGrams: 50,
    kcalPer100g: 360, carbsPer100g: 60, proteinPer100g: 22, fatPer100g: 4, fiberPer100g: 18, gi: 25,
  },
  {
    id: 'masoor_dal', name: 'Masoor dal (red lentils, raw)', aliases: ['masoor dal', 'red lentils', 'misur pappu', 'mysoor paruppu'],
    region: 'global', category: 'legume', servingGrams: 50,
    kcalPer100g: 353, carbsPer100g: 60, proteinPer100g: 25, fatPer100g: 1, fiberPer100g: 12, gi: 30,
  },
  {
    id: 'rajma_raw', name: 'Rajma (kidney beans, raw)', aliases: ['rajma', 'kidney beans', 'red beans', 'chikkara'],
    region: 'global', category: 'legume', servingGrams: 50,
    kcalPer100g: 333, carbsPer100g: 60, proteinPer100g: 24, fatPer100g: 1, fiberPer100g: 15, gi: 27,
  },
  {
    id: 'chana_whole', name: 'Chana (chickpeas, raw)', aliases: ['chana', 'chickpeas', 'chole', 'senagalu', 'kothu kadalai', 'kabuli chana'],
    region: 'global', category: 'legume', servingGrams: 50,
    kcalPer100g: 364, carbsPer100g: 61, proteinPer100g: 19, fatPer100g: 6, fiberPer100g: 17, gi: 30,
  },
  {
    id: 'horse_gram', name: 'Horse gram (raw)', aliases: ['horse gram', 'ulavalu', 'kollu', 'kulthi'],
    region: 'global', category: 'legume', servingGrams: 50,
    kcalPer100g: 321, carbsPer100g: 57, proteinPer100g: 22, fatPer100g: 0.5, fiberPer100g: 5, gi: 30,
  },
  {
    id: 'dried_green_peas', name: 'Dried green peas (raw)', aliases: ['dried peas', 'vatana', 'green peas dry', 'pattani'],
    region: 'global', category: 'legume', servingGrams: 50,
    kcalPer100g: 341, carbsPer100g: 60, proteinPer100g: 25, fatPer100g: 1, fiberPer100g: 10, gi: 25,
  },
  {
    id: 'fresh_green_peas', name: 'Green peas (fresh)', aliases: ['green peas', 'fresh peas', 'batani', 'pachai patani'],
    region: 'global', category: 'vegetable', servingGrams: 80,
    kcalPer100g: 81, carbsPer100g: 14, proteinPer100g: 5, fatPer100g: 0.4, fiberPer100g: 5, gi: 48,
  },
  {
    id: 'moth_beans', name: 'Moth beans (matki, raw)', aliases: ['matki', 'moth beans', 'moth', 'telugu matki'],
    region: 'global', category: 'legume', servingGrams: 50,
    kcalPer100g: 343, carbsPer100g: 63, proteinPer100g: 23, fatPer100g: 1, fiberPer100g: 9, gi: 30,
  },

  // ---------- Vegetables (raw) ----------
  {
    id: 'onion', name: 'Onion', aliases: ['ulli', 'eerulli', 'pyaz', 'vengayam'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 40, carbsPer100g: 9, proteinPer100g: 1.1, fatPer100g: 0.1, fiberPer100g: 1.7, gi: 10,
  },
  {
    id: 'tomato', name: 'Tomato', aliases: ['thakkali', 'tamatar', 'tomaat'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 18, carbsPer100g: 3.9, proteinPer100g: 0.9, fatPer100g: 0.2, fiberPer100g: 1.2, gi: 15,
  },
  {
    id: 'potato', name: 'Potato', aliases: ['aloo', 'batata', 'bangaladumpa', 'urulai kizhangu'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 77, carbsPer100g: 17, proteinPer100g: 2, fatPer100g: 0.1, fiberPer100g: 2.2, gi: 78,
  },
  {
    id: 'sweet_potato', name: 'Sweet potato', aliases: ['chilakada dumpa', 'shakarkandi', 'sarkaraivalli kizhangu'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 86, carbsPer100g: 20, proteinPer100g: 1.6, fatPer100g: 0.1, fiberPer100g: 3, gi: 63,
  },
  {
    id: 'carrot', name: 'Carrot', aliases: ['gajar', 'gajjarakaya'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 41, carbsPer100g: 10, proteinPer100g: 0.9, fatPer100g: 0.2, fiberPer100g: 2.8, gi: 39,
  },
  {
    id: 'french_beans', name: 'French beans', aliases: ['beans', 'chikkudikaya', 'nattai', 'pharsi'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 31, carbsPer100g: 7, proteinPer100g: 1.8, fatPer100g: 0.2, fiberPer100g: 2.7, gi: 20,
  },
  {
    id: 'cauliflower', name: 'Cauliflower', aliases: ['gobi', 'phool gobi', 'kobi', 'kosum paruppu'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 25, carbsPer100g: 5, proteinPer100g: 1.9, fatPer100g: 0.3, fiberPer100g: 2, gi: 15,
  },
  {
    id: 'cabbage', name: 'Cabbage', aliases: ['patta gobi', 'kosu', 'gobi bandha'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 25, carbsPer100g: 5.8, proteinPer100g: 1.4, fatPer100g: 0.2, fiberPer100g: 2.5, gi: 10,
  },
  {
    id: 'brinjal', name: 'Brinjal (eggplant)', aliases: ['brinjal', 'eggplant', 'baingan', 'vankaya', 'kathirikai'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 24, carbsPer100g: 5.9, proteinPer100g: 1, fatPer100g: 0.2, fiberPer100g: 3, gi: 15,
  },
  {
    id: 'okra', name: 'Bhindi (okra)', aliases: ['bhindi', 'okra', 'bendakaya', 'vendakkai', 'lady finger'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 33, carbsPer100g: 7.5, proteinPer100g: 1.9, fatPer100g: 0.2, fiberPer100g: 3.2, gi: 20,
  },
  {
    id: 'capsicum', name: 'Capsicum (bell pepper)', aliases: ['capsicum', 'bell pepper', 'shimla mirch', 'dappa milagai'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 26, carbsPer100g: 6, proteinPer100g: 1, fatPer100g: 0.3, fiberPer100g: 1.7, gi: 15,
  },
  {
    id: 'cucumber', name: 'Cucumber', aliases: ['dosakaya', 'vellarikai', 'kheera'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 15, carbsPer100g: 3.6, proteinPer100g: 0.7, fatPer100g: 0.1, fiberPer100g: 0.5, gi: 15,
  },
  {
    id: 'bottle_gourd', name: 'Bottle gourd (lauki)', aliases: ['lauki', 'dudhi', 'sorakaya', 'suraikkai', 'bottle gourd'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 14, carbsPer100g: 3.4, proteinPer100g: 0.6, fatPer100g: 0.02, fiberPer100g: 1.2, gi: 15,
  },
  {
    id: 'ridge_gourd', name: 'Ridge gourd (beerakaya)', aliases: ['ridge gourd', 'beerakaya', 'peerkangai', 'turai'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 20, carbsPer100g: 4.3, proteinPer100g: 0.6, fatPer100g: 0.2, fiberPer100g: 1.6, gi: 15,
  },
  {
    id: 'snake_gourd', name: 'Snake gourd (potlakaya)', aliases: ['snake gourd', 'potlakaya', 'padavalanga', 'chichinda'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 20, carbsPer100g: 4.6, proteinPer100g: 0.7, fatPer100g: 0.2, fiberPer100g: 1.5, gi: 15,
  },
  {
    id: 'ash_gourd', name: 'Ash gourd', aliases: ['boodida gummadikaya', 'pooshanikai', 'petha'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 15, carbsPer100g: 3.2, proteinPer100g: 0.4, fatPer100g: 0.2, fiberPer100g: 1, gi: 15,
  },
  {
    id: 'pumpkin', name: 'Pumpkin', aliases: ['gummadikaya', 'parangikai', 'kaddu'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 26, carbsPer100g: 6.5, proteinPer100g: 1, fatPer100g: 0.1, fiberPer100g: 0.5, gi: 65,
  },
  {
    id: 'drumstick', name: 'Drumstick (moringa pods)', aliases: ['drumstick', 'munagakaya', 'murungakkai', 'sahjan'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 46, carbsPer100g: 8, proteinPer100g: 3.2, fatPer100g: 0.4, fiberPer100g: 3.3, gi: 15,
  },
  {
    id: 'beetroot', name: 'Beetroot', aliases: ['chukandar', 'beet'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 43, carbsPer100g: 10, proteinPer100g: 1.6, fatPer100g: 0.2, fiberPer100g: 2.8, gi: 61,
  },
  {
    id: 'radish', name: 'Radish', aliases: ['mooli', 'mullangi', 'mulangi'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 16, carbsPer100g: 3.4, proteinPer100g: 0.7, fatPer100g: 0.1, fiberPer100g: 1.6, gi: 15,
  },
  {
    id: 'raw_banana_plantain', name: 'Raw banana (plantain)', aliases: ['raw banana', 'aratikaya', 'vazhakkai', 'kaya', 'green plantain'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 89, carbsPer100g: 22, proteinPer100g: 1.1, fatPer100g: 0.3, fiberPer100g: 2.6, gi: 55,
  },
  {
    id: 'yam', name: 'Yam (senai)', aliases: ['yam', 'senai', 'suran', 'karunai kizhangu', 'elephant foot yam'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 79, carbsPer100g: 19, proteinPer100g: 1.5, fatPer100g: 0.2, fiberPer100g: 4, gi: 50,
  },
  {
    id: 'colocasia', name: 'Colocasia (arbi)', aliases: ['arbi', 'colocasia', 'chamagadda', 'seppankilangu'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 79, carbsPer100g: 19, proteinPer100g: 1.3, fatPer100g: 0.1, fiberPer100g: 4, gi: 50,
  },
  {
    id: 'tindora', name: 'Tindora (ivy gourd)', aliases: ['tindora', 'dondakaya', 'kovakkai', 'ivy gourd'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 18, carbsPer100g: 3.1, proteinPer100g: 1.5, fatPer100g: 0.3, fiberPer100g: 1.6, gi: 15,
  },
  {
    id: 'bitter_gourd', name: 'Karela (bitter gourd)', aliases: ['karela', 'bitter gourd', 'kakarakaya', 'pavakkai'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 17, carbsPer100g: 3.4, proteinPer100g: 1, fatPer100g: 0.2, fiberPer100g: 1.6, gi: 15,
  },
  {
    id: 'gongura', name: 'Gongura (sorrel leaves)', aliases: ['gongura', 'sorrel leaves', 'pulicha keerai'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 25, carbsPer100g: 4.5, proteinPer100g: 2.5, fatPer100g: 0.5, fiberPer100g: 2, gi: 15,
  },
  {
    id: 'spinach_palak', name: 'Palak (spinach)', aliases: ['spinach', 'palak', 'keerai', 'bachhali kura'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 23, carbsPer100g: 3.6, proteinPer100g: 2.9, fatPer100g: 0.4, fiberPer100g: 2.2, gi: 15,
  },
  {
    id: 'amaranth_leaves', name: 'Amaranth leaves (thotakura)', aliases: ['thotakura', 'amaranth leaves', 'keerai leaves', 'chaulai'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 23, carbsPer100g: 4, proteinPer100g: 2.5, fatPer100g: 0.3, fiberPer100g: 2, gi: 15,
  },
  {
    id: 'methi_leaves', name: 'Methi leaves (fenugreek)', aliases: ['methi leaves', 'fenugreek leaves', 'menthya soppu', 'vendhaya keerai'],
    region: 'global', category: 'vegetable', servingGrams: 100,
    kcalPer100g: 20, carbsPer100g: 3, proteinPer100g: 3, fatPer100g: 0.4, fiberPer100g: 2, gi: 15,
  },
  {
    id: 'coriander_leaves', name: 'Coriander leaves', aliases: ['kothimeera', 'dhania patta', 'cilantro'],
    region: 'global', category: 'vegetable', servingGrams: 50,
    kcalPer100g: 23, carbsPer100g: 3.7, proteinPer100g: 2.1, fatPer100g: 0.5, fiberPer100g: 1.2, gi: 15,
  },
  {
    id: 'curry_leaves', name: 'Curry leaves', aliases: ['karevepu', 'karuveppilai', 'kadi patta'],
    region: 'global', category: 'vegetable', servingGrams: 20,
    kcalPer100g: 108, carbsPer100g: 22, proteinPer100g: 5, fatPer100g: 1, fiberPer100g: 6, gi: 15,
  },
  {
    id: 'mint_leaves', name: 'Mint leaves (pudina)', aliases: ['mint', 'pudina', 'mint leaves'],
    region: 'global', category: 'vegetable', servingGrams: 50,
    kcalPer100g: 43, carbsPer100g: 8, proteinPer100g: 3.3, fatPer100g: 0.7, fiberPer100g: 3, gi: 15,
  },
  {
    id: 'ginger', name: 'Ginger', aliases: ['allam', 'inji', 'adrak'],
    region: 'global', category: 'vegetable', servingGrams: 20,
    kcalPer100g: 80, carbsPer100g: 18, proteinPer100g: 1.8, fatPer100g: 0.8, fiberPer100g: 2, gi: 15,
  },
  {
    id: 'garlic', name: 'Garlic', aliases: ['velluli', 'poondu', 'lasun'],
    region: 'global', category: 'vegetable', servingGrams: 30,
    kcalPer100g: 149, carbsPer100g: 33, proteinPer100g: 6.4, fatPer100g: 0.5, fiberPer100g: 2, gi: 15,
  },
  {
    id: 'green_chilli', name: 'Green chilli', aliases: ['pacchi mirchi', 'harimirch', 'milagai', 'pacha mulagai'],
    region: 'global', category: 'vegetable', servingGrams: 30,
    kcalPer100g: 40, carbsPer100g: 9, proteinPer100g: 1.9, fatPer100g: 0.3, fiberPer100g: 1.7, gi: 15,
  },

  // ---------- Fruits ----------
  {
    id: 'papaya', name: 'Papaya', aliases: ['boppayi', 'pappali'],
    region: 'global', category: 'fruit', servingGrams: 150,
    kcalPer100g: 43, carbsPer100g: 11, proteinPer100g: 0.5, fatPer100g: 0.3, fiberPer100g: 1.7, gi: 55,
  },
  {
    id: 'orange', name: 'Orange', aliases: ['santra'],
    region: 'global', category: 'fruit', servingGrams: 120,
    kcalPer100g: 47, carbsPer100g: 12, proteinPer100g: 0.9, fatPer100g: 0.1, fiberPer100g: 0.5, gi: 45,
  },
  {
    id: 'guava', name: 'Guava', aliases: ['jama'],
    region: 'global', category: 'fruit', servingGrams: 120,
    kcalPer100g: 68, carbsPer100g: 14, proteinPer100g: 2.6, fatPer100g: 1, fiberPer100g: 5, gi: 25,
  },
  {
    id: 'pomegranate', name: 'Pomegranate', aliases: ['anar', 'danimma', 'madhulai'],
    region: 'global', category: 'fruit', servingGrams: 100,
    kcalPer100g: 83, carbsPer100g: 19, proteinPer100g: 1.7, fatPer100g: 1.2, fiberPer100g: 4, gi: 35,
  },
  {
    id: 'mango', name: 'Mango', aliases: ['mamidi', 'aam', 'maambazham'],
    region: 'global', category: 'fruit', servingGrams: 150,
    kcalPer100g: 60, carbsPer100g: 15, proteinPer100g: 0.8, fatPer100g: 0.4, fiberPer100g: 1.6, gi: 51,
  },
  {
    id: 'amla', name: 'Amla (Indian gooseberry)', aliases: ['amla', 'indian gooseberry', 'usiri', 'nellikai'],
    region: 'global', category: 'fruit', servingGrams: 50,
    kcalPer100g: 58, carbsPer100g: 10, proteinPer100g: 0.5, fatPer100g: 0.1, fiberPer100g: 3, gi: 15,
  },
  {
    id: 'lemon', name: 'Lemon', aliases: ['nimakaya', 'elumichai', 'limbu', 'nimmakaya'],
    region: 'global', category: 'fruit', servingGrams: 50,
    kcalPer100g: 29, carbsPer100g: 9, proteinPer100g: 1.1, fatPer100g: 0.3, fiberPer100g: 2.8, gi: 20,
  },
  {
    id: 'mosambi', name: 'Mosambi (sweet lime)', aliases: ['mosambi', 'sweet lime', 'battayi', 'sathukudi'],
    region: 'global', category: 'fruit', servingGrams: 150,
    kcalPer100g: 43, carbsPer100g: 9.3, proteinPer100g: 0.8, fatPer100g: 0.2, fiberPer100g: 1.9, gi: 45,
  },

  // ---------- Dairy ----------
  {
    id: 'milk_toned', name: 'Milk (toned)', aliases: ['milk', 'doodh', 'paal', 'palu', 'toned milk'],
    region: 'global', category: 'dairy', servingGrams: 250,
    kcalPer100g: 58, carbsPer100g: 4.7, proteinPer100g: 3.1, fatPer100g: 3, fiberPer100g: 0, gi: 31,
  },
  {
    id: 'curd', name: 'Curd (dahi)', aliases: ['curd', 'dahi', 'perugu', 'thayir', 'yogurt'],
    region: 'global', category: 'dairy', servingGrams: 150, katoriGrams: 150,
    kcalPer100g: 60, carbsPer100g: 4.7, proteinPer100g: 3.1, fatPer100g: 4, fiberPer100g: 0, gi: 30,
  },
  {
    id: 'buttermilk', name: 'Buttermilk (majjiga)', aliases: ['buttermilk', 'majjiga', 'mor', 'chaas', 'neer mor'],
    region: 'global', category: 'beverage', servingGrams: 250,
    kcalPer100g: 20, carbsPer100g: 2, proteinPer100g: 1, fatPer100g: 1, fiberPer100g: 0, gi: 15,
  },
  {
    id: 'paneer', name: 'Paneer', aliases: ['cottage cheese', 'indian cheese'],
    region: 'global', category: 'dairy', servingGrams: 80,
    kcalPer100g: 265, carbsPer100g: 1.2, proteinPer100g: 18, fatPer100g: 21, fiberPer100g: 0, gi: 10,
  },
  {
    id: 'ghee', name: 'Ghee', aliases: ['neyyi', 'nei', 'clarified butter'],
    region: 'global', category: 'fat', servingGrams: 10,
    kcalPer100g: 900, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 100, fiberPer100g: 0, gi: 0,
  },
  {
    id: 'butter', name: 'Butter', aliases: ['venna', 'makhan'],
    region: 'global', category: 'fat', servingGrams: 10,
    kcalPer100g: 717, carbsPer100g: 0.1, proteinPer100g: 0.9, fatPer100g: 81, fiberPer100g: 0, gi: 0,
  },
  {
    id: 'fresh_cream', name: 'Fresh cream (malai)', aliases: ['cream', 'malai', 'fresh cream'],
    region: 'global', category: 'fat', servingGrams: 30,
    kcalPer100g: 340, carbsPer100g: 2.7, proteinPer100g: 2.1, fatPer100g: 36, fiberPer100g: 0, gi: 30,
  },

  // ---------- Oils ----------
  {
    id: 'mustard_oil', name: 'Mustard oil', aliases: ['sarson oil', 'aava nune', 'kadugu ennai'],
    region: 'global', category: 'fat', servingGrams: 10,
    kcalPer100g: 900, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 100, fiberPer100g: 0, gi: 0,
  },
  {
    id: 'groundnut_oil', name: 'Groundnut oil', aliases: ['peanut oil'],
    region: 'global', category: 'fat', servingGrams: 10,
    kcalPer100g: 900, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 100, fiberPer100g: 0, gi: 0,
  },
  {
    id: 'sunflower_oil', name: 'Sunflower oil', aliases: ['refined oil', 'sunflower'],
    region: 'global', category: 'fat', servingGrams: 10,
    kcalPer100g: 900, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 100, fiberPer100g: 0, gi: 0,
  },
  {
    id: 'coconut_oil', name: 'Coconut oil', aliases: ['kobbari nune', 'thengai ennai'],
    region: 'global', category: 'fat', servingGrams: 10,
    kcalPer100g: 892, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 99, fiberPer100g: 0, gi: 0,
  },
  {
    id: 'sesame_oil', name: 'Sesame (gingelly) oil', aliases: ['sesame oil', 'gingelly oil', 'nuvvula nune', 'nellennai'],
    region: 'global', category: 'fat', servingGrams: 10,
    kcalPer100g: 900, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 100, fiberPer100g: 0, gi: 0,
  },

  // ---------- Nuts & seeds ----------
  {
    id: 'peanuts_raw', name: 'Peanuts (raw)', aliases: ['peanuts', 'groundnut', 'pallilu', 'kadalai', 'nilakadalai'],
    region: 'global', category: 'nut', servingGrams: 40,
    kcalPer100g: 567, carbsPer100g: 16, proteinPer100g: 26, fatPer100g: 49, fiberPer100g: 8, gi: 14,
  },
  {
    id: 'cashew', name: 'Cashew', aliases: ['cashew nuts', 'kaju', 'jeedipappu', 'mundiri'],
    region: 'global', category: 'nut', servingGrams: 30,
    kcalPer100g: 553, carbsPer100g: 44, proteinPer100g: 18, fatPer100g: 30, fiberPer100g: 3.3, gi: 25,
  },
  {
    id: 'almonds', name: 'Almonds', aliases: ['badam'],
    region: 'global', category: 'nut', servingGrams: 30,
    kcalPer100g: 579, carbsPer100g: 22, proteinPer100g: 21, fatPer100g: 50, fiberPer100g: 12, gi: 15,
  },
  {
    id: 'walnuts', name: 'Walnuts', aliases: ['akhrot', 'akrot'],
    region: 'global', category: 'nut', servingGrams: 30,
    kcalPer100g: 654, carbsPer100g: 14, proteinPer100g: 15, fatPer100g: 65, fiberPer100g: 6.7, gi: 15,
  },
  {
    id: 'sesame_seeds', name: 'Sesame seeds (til)', aliases: ['sesame seeds', 'nuvvulu', 'til', 'ellu'],
    region: 'global', category: 'nut', servingGrams: 20,
    kcalPer100g: 573, carbsPer100g: 23, proteinPer100g: 18, fatPer100g: 50, fiberPer100g: 11.8, gi: 20,
  },
  {
    id: 'poppy_seeds', name: 'Poppy seeds (khus khus)', aliases: ['poppy seeds', 'khus khus', 'gasagasa', 'gasa gasa', 'postho'],
    region: 'global', category: 'nut', servingGrams: 15,
    kcalPer100g: 525, carbsPer100g: 28, proteinPer100g: 18, fatPer100g: 42, fiberPer100g: 19, gi: 15,
  },
  {
    id: 'fresh_coconut', name: 'Fresh coconut', aliases: ['coconut', 'kobbari', 'thengai', 'nariyal'],
    region: 'global', category: 'nut', servingGrams: 50,
    kcalPer100g: 354, carbsPer100g: 15, proteinPer100g: 3.3, fatPer100g: 33, fiberPer100g: 9, gi: 45,
  },

  // ---------- Spices & condiments (new 'spice' category) ----------
  {
    id: 'turmeric', name: 'Turmeric', aliases: ['haldi', 'pasupu', 'manjal'],
    region: 'global', category: 'spice', servingGrams: 5,
    kcalPer100g: 312, carbsPer100g: 68, proteinPer100g: 9, fatPer100g: 3, fiberPer100g: 22, gi: 15,
  },
  {
    id: 'red_chilli_powder', name: 'Red chilli powder', aliases: ['chilli powder', 'karam podi', 'lal mirch', 'milagai podi'],
    region: 'global', category: 'spice', servingGrams: 5,
    kcalPer100g: 282, carbsPer100g: 50, proteinPer100g: 13, fatPer100g: 14, fiberPer100g: 34, gi: 15,
  },
  {
    id: 'coriander_powder', name: 'Coriander powder (dhania)', aliases: ['coriander powder', 'dhania powder', 'kothimeera podi'],
    region: 'global', category: 'spice', servingGrams: 5,
    kcalPer100g: 298, carbsPer100g: 55, proteinPer100g: 12, fatPer100g: 18, fiberPer100g: 33, gi: 15,
  },
  {
    id: 'cumin_seeds', name: 'Cumin (jeera)', aliases: ['cumin', 'cumin seeds', 'jeera', 'jeelakarra', 'seeragam'],
    region: 'global', category: 'spice', servingGrams: 5,
    kcalPer100g: 375, carbsPer100g: 44, proteinPer100g: 18, fatPer100g: 22, fiberPer100g: 11, gi: 15,
  },
  {
    id: 'mustard_seeds', name: 'Mustard seeds', aliases: ['aavalu', 'kadugu', 'rai'],
    region: 'global', category: 'spice', servingGrams: 5,
    kcalPer100g: 469, carbsPer100g: 28, proteinPer100g: 25, fatPer100g: 36, fiberPer100g: 12, gi: 15,
  },
  {
    id: 'fenugreek_seeds', name: 'Fenugreek seeds (methi dana)', aliases: ['methi dana', 'fenugreek seeds', 'menthulu', 'vendhayam'],
    region: 'global', category: 'spice', servingGrams: 5,
    kcalPer100g: 323, carbsPer100g: 58, proteinPer100g: 23, fatPer100g: 6, fiberPer100g: 25, gi: 15,
  },
  {
    id: 'asafoetida', name: 'Asafoetida (hing)', aliases: ['hing', 'asafoetida', 'inguva', 'perungayam'],
    region: 'global', category: 'spice', servingGrams: 2,
    kcalPer100g: 297, carbsPer100g: 68, proteinPer100g: 4, fatPer100g: 1, fiberPer100g: 15, gi: 15,
  },
  {
    id: 'black_pepper', name: 'Black pepper', aliases: ['kali mirch', 'miriyalu', 'milagu'],
    region: 'global', category: 'spice', servingGrams: 5,
    kcalPer100g: 251, carbsPer100g: 64, proteinPer100g: 10, fatPer100g: 3, fiberPer100g: 25, gi: 15,
  },
  {
    id: 'salt', name: 'Salt', aliases: ['uppu', 'namak'],
    region: 'global', category: 'spice', servingGrams: 5,
    kcalPer100g: 0, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 0, fiberPer100g: 0, gi: 0,
  },
  {
    id: 'tamarind', name: 'Tamarind', aliases: ['chintapandu', 'puli', 'imli'],
    region: 'global', category: 'spice', servingGrams: 20,
    kcalPer100g: 239, carbsPer100g: 57, proteinPer100g: 3, fatPer100g: 0.6, fiberPer100g: 5, gi: 55,
  },
  {
    id: 'jaggery', name: 'Jaggery', aliases: ['bellam', 'gur', 'vellam'],
    region: 'global', category: 'sweet', servingGrams: 20,
    kcalPer100g: 383, carbsPer100g: 98, proteinPer100g: 0.1, fatPer100g: 0.1, fiberPer100g: 0, gi: 70,
  },
  {
    id: 'sugar', name: 'Sugar', aliases: ['cheeni'],
    region: 'global', category: 'sweet', servingGrams: 15,
    kcalPer100g: 387, carbsPer100g: 100, proteinPer100g: 0, fatPer100g: 0, fiberPer100g: 0, gi: 65,
  },
  {
    id: 'garam_masala', name: 'Garam masala', aliases: ['masala'],
    region: 'global', category: 'spice', servingGrams: 5,
    kcalPer100g: 379, carbsPer100g: 40, proteinPer100g: 11, fatPer100g: 15, fiberPer100g: 25, gi: 15,
  },
  {
    id: 'sambar_powder', name: 'Sambar powder', aliases: ['sambar podi', 'sambar pudi'],
    region: 'global', category: 'spice', servingGrams: 8,
    kcalPer100g: 350, carbsPer100g: 50, proteinPer100g: 12, fatPer100g: 8, fiberPer100g: 12, gi: 15,
  },
  {
    id: 'rasam_powder', name: 'Rasam powder', aliases: ['rasam podi', 'rasam pudi'],
    region: 'global', category: 'spice', servingGrams: 8,
    kcalPer100g: 350, carbsPer100g: 50, proteinPer100g: 12, fatPer100g: 8, fiberPer100g: 12, gi: 15,
  },
  {
    id: 'cardamom', name: 'Cardamom (elaichi)', aliases: ['cardamom', 'elaichi', 'yellakai', 'elakkai'],
    region: 'global', category: 'spice', servingGrams: 3,
    kcalPer100g: 311, carbsPer100g: 68, proteinPer100g: 11, fatPer100g: 7, fiberPer100g: 28, gi: 15,
  },

  // ---------- Eggs, meat & fish (raw) ----------
  {
    id: 'egg_raw', name: 'Egg', aliases: ['eggs', 'kodiguddu', 'muttai', 'anda'],
    region: 'global', category: 'egg', servingGrams: 50,
    kcalPer100g: 143, carbsPer100g: 0.7, proteinPer100g: 13, fatPer100g: 9.5, fiberPer100g: 0, gi: 0,
  },
  {
    id: 'chicken_raw', name: 'Chicken (raw, boneless)', aliases: ['chicken', 'chicken boneless', 'koli'],
    region: 'global', category: 'meat', servingGrams: 100,
    kcalPer100g: 120, carbsPer100g: 0, proteinPer100g: 22, fatPer100g: 3, fiberPer100g: 0, gi: 0,
  },
  {
    id: 'mutton_raw', name: 'Mutton (raw)', aliases: ['mutton', 'goat meat'],
    region: 'global', category: 'meat', servingGrams: 100,
    kcalPer100g: 143, carbsPer100g: 0, proteinPer100g: 25, fatPer100g: 4, fiberPer100g: 0, gi: 0,
  },
  {
    id: 'fish_raw', name: 'Fish (raw)', aliases: ['fish', 'rohu', 'chepa', 'meen'],
    region: 'global', category: 'fish', servingGrams: 100,
    kcalPer100g: 97, carbsPer100g: 0, proteinPer100g: 19, fatPer100g: 2, fiberPer100g: 0, gi: 0,
  },
  {
    id: 'prawns_raw', name: 'Prawns (raw)', aliases: ['prawns', 'shrimp', 'royyalu', 'chemmeen', 'jhinga'],
    region: 'global', category: 'fish', servingGrams: 100,
    kcalPer100g: 99, carbsPer100g: 0, proteinPer100g: 24, fatPer100g: 0.3, fiberPer100g: 0, gi: 0,
  }];

/** Existing regional/global catalog entries that are themselves raw ingredients. */
export const CATALOG_INGREDIENT_IDS = ['banana', 'apple'];

/** Every food id usable as a recipe ingredient (raw building blocks). */
export const INGREDIENT_IDS: string[] = [
  ...ingredientFoods.map((f) => f.id),
  ...CATALOG_INGREDIENT_IDS];

