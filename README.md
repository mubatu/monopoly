# monopoly

Klasik Monopoly'de (İstanbul baskısı) piyonların hangi karelere ne sıklıkla geldiğini
Monte Carlo yöntemiyle ölçen simülasyon motoru ve komut satırı aracı.

Sistem yalnızca zar atar ve ilerler: mülk, kira, para, ev/otel yoktur. Hareketi
etkileyen kuralların hepsi uygulanır: çift atınca tekrar atma, üst üste üç çiftte
Kodes, Kodes'e Gir karesi, Kodes'ten çıkış kuralları ve gerçekten çekilen Şans /
Kamu Fonu kartları (karıştırılmış deste, çekilen kart alta döner, "Kodes'ten
Ücretsiz Çık" kartı oyuncuda kalır).

Tasarım ve kural ayrıntıları için bkz. [PLAN.md](PLAN.md).

## Kurulum

Node 22 veya üstü gerekir.

```bash
npm install
```

```bash
npm test
```

Motorun çalışma zamanı bağımlılığı yoktur; `src/` altında `cli.ts` dışındaki dosyalar
`fs`, `process`, `console` kullanmaz ve tarayıcıda da çalışır.

## Kullanım

```bash
npx tsx src/cli.ts --players 4 --games 1000 --turns 1000 --jail-pay 0.6 --seed 42 --out results/run1.json
```

Araç sonucu JSON olarak yazar ve terminale `finalPct`'ye göre sıralı bir tablo,
Kodes özeti ve grup toplamlarını basar.

| Seçenek | Varsayılan | Açıklama |
|---------|-----------|----------|
| `--players <n>` | `4` | Piyon sayısı, 2–6. |
| `--games <n>` | `100` | Oyun sayısı. Her oyun yeni karıştırılmış destelerle ve piyonlar Başlangıç'ta başlar. |
| `--turns <n>` | `1000` | Her oyunda **oyuncu başına** tur sayısı. Toplam tur = `players × games × turns`. |
| `--jail-pay <p>` | `0.5` | 0–1. Kodes'e her girişte bu olasılıkla "hemen öde" stratejisi seçilir; diğerleri çift atmayı dener. |
| `--seed <n>` | rastgele | 32-bit tam sayı. Aynı seed + aynı parametreler birebir aynı sonucu verir. |
| `--edition <ad>` | `istanbul` | Tahta/kart verisi. Şimdilik yalnızca `istanbul`. |
| `--per-game` | kapalı | Oyun bazında final sayımlarını da JSON'a yazar (varyans analizi için). |
| `--out <dosya>` | `results/<zaman>-<seed>.json` | JSON çıktı yolu. Zaman damgası UTC'dir. |
| `--help` | | Yardım. |

Seçenekler `--games 100` veya `--games=100` biçiminde yazılabilir. Geçersiz değerde
araç açıklayıcı bir hata basıp 1 koduyla çıkar.

Diğer komutlar: `npm run sim -- <seçenekler>` (CLI kısayolu), `npm run typecheck`,
`npm run build` (`dist/` altına derler).

### Kod içinden

```ts
import { runSimulation } from "./src/simulate.js";

const result = runSimulation(
  { players: 4, games: 100, turnsPerGame: 1000, jailPayProbability: 0.6, seed: 42 },
  { onProgress: (done, total) => {} },
);
```

Verilmeyen alanlar varsayılanlarla doldurulur; seed verilmezse saatten üretilir ve
`result.config.seed` içinde raporlanır.

## Neyin nasıl sayıldığı

- **Geliş (`landings`)**: piyonun bir karede her duruşu, ara konaklamalar dahil.
  Şans'a gelip "Yeniköy'e ilerle" çekilirse hem Şans hem Yeniköy sayacı artar.
- **Final (`finalLandings`)**: bir zar atışının, kartlar çözümlendikten sonra bittiği
  yer. Her atış en fazla bir final üretir; çiftle kazanılan ek atış ayrı bir finaldir.
- **Kodes**: 10 numaralı kare yalnızca "Sadece Ziyaretçi" gelişlerini sayar. Kodes'e
  girişler ayrı bir kovadadır (`jail.entries`) ve giren atışın finali sayılır.
  Kodes'e Gir (30) karesine gelmek `landings[30]`'u artırır ama orada hiç final olmaz.
- **Kodes'te geçen tur (`jail.turnsInJail`)**: oyuncunun çift atamayıp içeride
  kaldığı turlar. Bunlar kareye geliş değildir.
- **Kodes'ten çıkış**: Elinde "Kodes'ten Ücretsiz Çık" kartı olan oyuncu kartı ilk
  turda kullanır (iki kartı varsa önce Şans'ınkini). Yoksa girişte seçilen strateji
  uygulanır: "öde" → ilk turda çıkar ve normal tur oynar (çift atarsa tekrar atar);
  "zar at" → çift atarsa o zarla çıkar ve tekrar atmaz, üçüncü başarısız atışta
  ödeyip aynı zarla ilerler.

Buradan şu eşitlikler çıkar (testlerde doğrulanır):

```
totalLandings      = Σ squares.landings      + jail.entries
totalFinalLandings = Σ squares.finalLandings + jail.entries
totalRolls         = totalFinalLandings      + jail.turnsInJail
```

## JSON şeması

```jsonc
{
  "config": {
    "edition": "istanbul", "players": 4, "games": 1000, "turnsPerGame": 1000,
    "jailPayProbability": 0.6, "seed": 42, "trackPerGame": false
  },
  "meta": {
    "totalTurns": 4000000,          // players × games × turnsPerGame
    "totalRolls": 4718438,          // atılan zar çifti sayısı
    "totalLandings": 5012478,
    "totalFinalLandings": 4624842,
    "elapsedMs": 143,
    "generatedAt": "2026-10-13T22:37:31.604Z"
  },
  "squares": [                      // 40 kayıt, tahta sırasıyla; index 10 = Sadece Ziyaretçi
    { "index": 0, "name": "Başlangıç", "type": "go", "group": null,
      "landings": 144542, "landingPct": 2.8836,       // landings / totalLandings × 100
      "finalLandings": 144542, "finalPct": 3.1253 }   // finalLandings / totalFinalLandings × 100
  ],
  "jail": {
    "entries": 182558,
    "entryPct": 3.6421,             // entries / totalLandings × 100
    "finalPct": 3.9473,             // entries / totalFinalLandings × 100
    "byReason": { "square": 121015, "chance_card": 22048, "chest_card": 23018, "three_doubles": 16477 },
    "turnsInJail": 93596,
    "turnsInJailPctOfTurns": 2.3399 // turnsInJail / totalTurns × 100
  },
  "groups": [                       // renk grupları + "ulaşım" + "kamu kuruluşu"
    { "group": "kahverengi", "squares": [1, 3],
      "landings": 197743, "landingPct": 3.945, "finalLandings": 197743, "finalPct": 4.2757 }
  ],
  "cards": { "chanceDraws": 345937, "chestDraws": 359618 },
  "dice": {
    "doubles": 787117, "doublesPct": 16.6817,
    "sums": { "2": 131319, "3": 261982, "...": 0, "12": 131442 }
  },
  "perGame": null                   // --per-game ile: [{ "finalLandings": [40 sayı], "jailEntries": n }, ...]
}
```

Yüzdeler 4 ondalığa yuvarlanır; kesin değer gerekiyorsa ham sayılardan hesaplayın.
`squares` + `jail` yüzdeleri 100'e toplanır.

## Proje yapısı

```
data/board.istanbul.json   40 kare
data/cards.istanbul.json   16 Şans + 16 Kamu Fonu
src/types.ts               ortak tipler
src/rng.ts                 tohumlu RNG (xoshiro128**), rollDie, shuffle
src/board.ts               tahta yükleme/doğrulama, nearestStation / nearestUtility
src/cards.ts               kart yükleme/doğrulama, Deck
src/engine.ts              playTurn: hareket, Kodes, kart çözümleme
src/stats.ts               sayaçlar ve sonuç özeti
src/simulate.ts            runSimulation, yapılandırma doğrulaması
src/cli.ts                 komut satırı aracı
test/                      vitest testleri
```

## Veri kaynakları

**Tahta.** Monopoly İstanbul (semt isimli klasik baskı). Kare adları ve renk grupları
World of Monopoly'nin Türkiye sayfasına (Hasbro standart ref. 0695, 1995 listesi),
Wikipedia'daki "List of licensed and localized editions of Monopoly: Europe"
sayfasına ve sözlüklerdeki renk grubu dökümlerine dayanır. Köşe ve özel kare adları
(Başlangıç, Kodes, Ücretsiz Otopark, Kodes'e Gir, Şans, Kamu Fonu) Hasbro'nun 2010
tarihli Türkçe kılavuzundan alınmıştır. 23 numaralı kare kullanıcı tarafından
**Erenköy** olarak doğrulanmıştır. Yerleşim standart Monopoly yerleşimidir.

**Kartlar.** Türkçe kartların birebir metni çevrimiçi bulunamadı. Hareket kartları
Hasbro'nun uluslararası standart setinin İstanbul tahtasındaki karşılıklarıdır;
Şans destesindeki "en yakın ulaşım aracına ilerle" (×2) ve "en yakın kamu
kuruluşuna ilerle" kartlarının varlığı kullanıcı tarafından kutudaki desteden
doğrulanmıştır. Hareket etkisi olmayan kartların metni simülasyonu etkilemediği
için bunlar veri dosyasında "Düz kart" olarak yer alır; yalnızca sayıları
önemlidir (Şans'ta 5, Kamu Fonu'nda 13).

Başka bir baskı eklemek için `data/` altına yeni tahta ve kart dosyaları koyup
`src/board.ts`, `src/cards.ts` ve `src/types.ts` içindeki baskı listelerine eklemek
yeterlidir; yükleme sırasında veriler doğrulanır.
