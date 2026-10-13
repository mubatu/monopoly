# Monopoly Kare Olasılığı Simülatörü — Motor Uygulama Planı

Bu belge, simülasyon motorunun (arayüzsüz çekirdek + komut satırı aracı) sıfırdan
uygulanması için yazılmıştır. Görselleştirme (Three.js) ayrı bir aşamadır ve bu
planın kapsamı dışındadır; ancak motor, tarayıcıda da çalışabilecek şekilde
tasarlanmalıdır.

---

## 1. Amaç

Klasik Monopoly'de piyonların hangi karelere ne sıklıkla geldiğini Monte Carlo
yöntemiyle ölçmek. Sistem **sadece zar atar ve ilerler**; mülk satın alma, kira,
para, ev/otel yoktur. Ancak hareketi etkileyen her kural tam olarak uygulanır:

- iki zar, çift atınca tekrar atma, üst üste üç çift → Kodes,
- Kodes'e Gir karesi, Kodes'e gönderen kartlar, Kodes'ten çıkış kuralları,
- Şans ve Kamu Fonu kartlarının gerçekten çekilmesi (karıştırılmış deste, çekilen
  kart destenin altına döner, "Kodes'ten Ücretsiz Çık" kartı oyuncuda kalır).

Çıktı: her kareye geliş sayıları ve dağılımı (JSON + terminal tablosu).

## 2. Kullanıcı kararları (kesinleşmiş)

| # | Konu | Karar |
|---|------|-------|
| 1 | Tahta | **Türkçe (İstanbul) baskısı**. Bkz. §4. |
| 2 | Kodes'ten çıkış | **Yüzdesel parametre.** Örn. `jailPayProbability = 0.6`: Kodes'e düşenlerin %60'ı ilk fırsatta cezayı öder ve çıkar, %40'ı çift atmayı dener. Bkz. §6.4. |
| 3 | Ara konaklamalar | **Sayılır.** Şans'a gelip "Yeniköy'e ilerle" çekince hem Şans (7/22/36) hem Yeniköy (39) sayacı artar. Ayrıca "hamle sonu" konumu ayrı bir sayaçta tutulur. |
| 4 | Kodes / Ziyaretçi | **Ayrı sayılır.** 10 numaralı kare için iki kova: `10 (Ziyaretçi)` ve `Kodes (içeride)`. |
| 5 | Kodes'ten Ücretsiz Çık kartı | **Gerçek davranış.** Kart desteden çıkar, oyuncuda kalır, kullanıldığında ait olduğu destenin altına döner. |
| 6 | Koşu yapısı | **Parametre.** `games × turnsPerGame` (her oyun yeni karıştırılmış desteler ve Başlangıç'ta piyonlarla başlar). |
| 7 | Piyon sayısı | **2–6**, çalıştırmadan önce belirlenir. |

Not: Mülk alımı olmadığı için oyuncular birbirinden neredeyse bağımsızdır; tek
etkileşim ortak kart desteleridir. Piyon sayısının sonuçları çok az değiştirmesi
beklenir ve bu bir hata değildir.

## 3. Teknoloji

- **TypeScript + Node 22**, ESM, `strict: true`.
- Çalıştırma: `tsx` (geliştirme), `tsc` (derleme). Test: **vitest**.
- Çalışma zamanı bağımlılığı **yok** (motor tarayıcıda da çalışacak).
- Motor saf fonksiyonlardan oluşur; `console`, `fs`, `process` yalnızca `cli.ts`
  içinde kullanılır.
- Rastgele sayı üreteci tohumlanabilir olmalı (ör. `xoshiro128**` veya
  `mulberry32`); aynı tohum + aynı parametreler = aynı sonuç.

Önerilen dosya yapısı:

```
monopoly/
  package.json  tsconfig.json  vitest.config.ts
  data/
    board.istanbul.json        # 40 kare
    cards.istanbul.json        # 16 Şans + 16 Kamu Fonu
  src/
    types.ts                   # Square, Card, Config, Stats, GameState
    rng.ts                     # tohumlu RNG, rollDie(), shuffle()
    board.ts                   # data yükleme + yardımcılar (nearestStation vb.)
    cards.ts                   # Deck sınıfı: shuffle, draw, returnToBottom, removeHeld
    engine.ts                  # playTurn(), movement, jail, card resolution
    stats.ts                   # sayaçlar (Int32Array/Float64Array), yüzdeler, özet
    simulate.ts                # runSimulation(config) → Result (games×turns döngüsü)
    cli.ts                     # argüman ayrıştırma, JSON yazma, tablo basma
  test/
    board.test.ts  cards.test.ts  engine.test.ts  simulate.test.ts
  results/                     # .gitignore'a eklenir; JSON çıktıları
  PLAN.md
```

## 4. Tahta verisi (İstanbul baskısı)

Kaynaklar: World of Monopoly'nin Türkiye sayfası (Hasbro standart ref. 0695, 1995
listesi), Wikipedia "List of licensed and localized editions of Monopoly: Europe"
(Turkey/Istanbul Edition), Ekşi Sözlük ve diğer sözlüklerdeki renk grubu dökümleri.
Hepsi aynı 22 semti ve aynı renk gruplarını verir. Hasbro'nun 2010 tarihli Türkçe
kılavuzu (MONOPOLY National Instructions TR, 061001610131) köşe/özel hane adlarını
doğrular: Başlangıç, Kodes, Ücretsiz Otopark, Kodes'e Gir, Şans, Kamu Fonu,
"Kodes'ten Ücretsiz Çık".

Standart Monopoly yerleşimi (ulaşım araçları 5/15/25/35, kamu kuruluşları 12/28,
Şans 7/22/36, Kamu Fonu 2/17/33, vergiler 4/38) aynen korunur.

| # | Kare | Tür | Grup |
|---|------|-----|------|
| 0 | Başlangıç | go | — |
| 1 | Kasımpaşa | property | kahverengi |
| 2 | Kamu Fonu | community_chest | — |
| 3 | Dolapdere | property | kahverengi |
| 4 | Gelir Vergisi | tax | — |
| 5 | Haydarpaşa Garı | station | ulaşım |
| 6 | Sultanahmet | property | açık mavi |
| 7 | Şans | chance | — |
| 8 | Karaköy | property | açık mavi |
| 9 | Sirkeci | property | açık mavi |
| 10 | Kodes / Sadece Ziyaretçi | jail | — |
| 11 | Beyoğlu | property | pembe |
| 12 | Elektrik İdaresi | utility | kamu kuruluşu |
| 13 | Beşiktaş | property | pembe |
| 14 | Taksim | property | pembe |
| 15 | Kadıköy Vapur İskelesi | station | ulaşım |
| 16 | Harbiye | property | turuncu |
| 17 | Kamu Fonu | community_chest | — |
| 18 | Şişli | property | turuncu |
| 19 | Mecidiyeköy | property | turuncu |
| 20 | Ücretsiz Otopark | free_parking | — |
| 21 | Bostancı | property | kırmızı |
| 22 | Şans | chance | — |
| 23 | Erenköy | property | kırmızı |
| 24 | Caddebostan | property | kırmızı |
| 25 | Kabataş Vapur İskelesi | station | ulaşım |
| 26 | Nişantaşı | property | sarı |
| 27 | Teşvikiye | property | sarı |
| 28 | Sular İdaresi | utility | kamu kuruluşu |
| 29 | Maçka | property | sarı |
| 30 | Kodes'e Gir | go_to_jail | — |
| 31 | Levent | property | yeşil |
| 32 | Etiler | property | yeşil |
| 33 | Kamu Fonu | community_chest | — |
| 34 | Bebek | property | yeşil |
| 35 | Sirkeci Garı | station | ulaşım |
| 36 | Şans | chance | — |
| 37 | Tarabya | property | lacivert |
| 38 | Lüks Vergisi | tax | — |
| 39 | Yeniköy | property | lacivert |

Notlar:
- 23 numaralı kare kullanıcı tarafından **Erenköy** olarak doğrulandı (Wikipedia'daki
  "Bağdat Caddesi" yanlış/eski).
- Baskı kullanıcı tarafından doğrulandı: **Monopoly İstanbul** (semt isimli klasik baskı).
- Pembe grup içi sıralama (Beyoğlu–Beşiktaş–Taksim) ve turuncu sıralama
  (Harbiye–Şişli–Mecidiyeköy) 1995 listesine göredir. Grup içi sıra, ara kareler
  simetrik olduğu için dağılımı pratikte etkilemez.

`board.istanbul.json` şeması:

```json
{ "edition": "istanbul", "squares": [
  { "index": 0, "name": "Başlangıç", "type": "go", "group": null },
  { "index": 1, "name": "Kasımpaşa", "type": "property", "group": "kahverengi" },
  ...
]}
```

Geçerli `type` değerleri: `go | property | community_chest | tax | station |
chance | jail | utility | free_parking | go_to_jail`.

## 5. Kart desteleri

### 5.1 Kaynak durumu ve varsayım

Türkçe kartların birebir metni internette bulunamadı (Hasbro'nun Türkçe kılavuzları
kart metinlerini içermiyor). Kılavuz yalnızca 16 Şans + 16 Kamu Fonu olduğunu,
çekilen kartın destenin altına döndüğünü ve "Kodes'ten Ücretsiz Çık" kartının
saklandığını doğrular.

Hareket kartları, Hasbro'nun uluslararası standart setinin İstanbul tahtasındaki
karşılıklarıdır (ABD: Illinois Ave → 24, St. Charles Place → 11, Reading RR → 5,
Boardwalk → 39). Kullanıcı kutudaki Türkçe Şans destesinde "en yakın ulaşım aracına
ilerle" (×2) ve "en yakın kamu kuruluşuna ilerle" kartlarının **bulunduğunu
doğruladı**; aşağıdaki set bu haliyle kesindir. Kart listesi yine de JSON'da tutulur
ki ileride başka baskılar eklenebilsin.

Düz (hareketsiz) kartların metni önemsizdir; yalnızca sayıları önemlidir.

### 5.2 Şans (16 kart)

| id | Etki | Hedef |
|----|------|-------|
| C01 | advance_to | 0 (Başlangıç) |
| C02 | advance_to | 24 (Caddebostan) |
| C03 | advance_to | 11 (Beyoğlu) |
| C04 | advance_to_nearest_utility | 12 veya 28 |
| C05 | advance_to_nearest_station | 5/15/25/35 |
| C06 | advance_to_nearest_station | 5/15/25/35 |
| C07 | advance_to | 5 (Haydarpaşa Garı) |
| C08 | advance_to | 39 (Yeniköy) |
| C09 | go_back | 3 |
| C10 | go_to_jail | — |
| C11 | get_out_of_jail_free | — |
| C12–C16 | none | — (5 düz kart) |

### 5.3 Kamu Fonu (16 kart)

| id | Etki | Hedef |
|----|------|-------|
| K01 | advance_to | 0 (Başlangıç) |
| K02 | go_to_jail | — |
| K03 | get_out_of_jail_free | — |
| K04–K16 | none | — (13 düz kart) |

`cards.istanbul.json` şeması:

```json
{ "chance": [ { "id": "C01", "text": "Başlangıç'a ilerleyin", "effect": "advance_to", "target": 0 }, ... ],
  "communityChest": [ ... ] }
```

`effect` değerleri: `advance_to | advance_to_nearest_station |
advance_to_nearest_utility | go_back | go_to_jail | get_out_of_jail_free | none`.

Yükleme sırasında doğrula: her deste tam 16 kart, id'ler benzersiz, `advance_to`
hedefleri 0–39, her destede en fazla bir `get_out_of_jail_free`.

### 5.4 Deste davranışı

- Oyun başında her iki deste bağımsız olarak karıştırılır (tohumlu RNG).
- Çekim: en üstteki kart alınır, etkisi uygulanır, **destenin altına** konur.
- `get_out_of_jail_free`: kart desteden çıkar ve oyuncunun eline geçer. Oyuncu
  kartı kullandığında kart **geldiği destenin** altına döner. Bir oyuncu her iki
  desteden de birer kart tutabilir.
- Deste boşalamaz (en kötü ihtimalle 14 kart kalır), ama yine de `draw()` boş
  desteyi hata ile bildirmeli.

## 6. Hareket kuralları (engine)

### 6.1 Tur

Bir "tur" = bir oyuncunun sırası. Sıra round-robin (0,1,...,n-1,0,...).
Pseudocode:

```
playTurn(state, p):
  player = state.players[p]
  if player.inJail: return jailTurn(state, p)
  doublesCount = 0
  loop:
    (d1, d2) = roll()
    isDouble = d1 == d2
    if isDouble: doublesCount++
    if doublesCount == 3:
      sendToJail(player, reason="three_doubles")   # piyon hareket etmez
      return
    moveBy(player, d1 + d2)                        # §6.2
    resolveLanding(state, player)                  # §6.3
    if player.inJail or not isDouble: return
    # çift attı ve Kodes'e girmedi → tekrar at
```

### 6.2 Hareket ve sayım

- `moveBy(n)`: `pos = (pos + n) mod 40`. Başlangıç'tan geçmek sayılmaz
  (sadece konaklama sayılır).
- `moveTo(target)`: ileri yönde hedefe gider (`pos = target`).
- Her konaklama `stats.landings[pos]++` yapar (ara konaklamalar dahil).
- Hamle zinciri bittiğinde (kartlar çözümlendikten sonra) `stats.finalLandings[pos]++`.
  Bir zar atışı tek bir "final" üretir; çift atışla gelen ikinci atış ayrı bir final
  üretir. Kodes'e giriş `finalLandings` için `JAIL` kovasına yazılır.
- Kodes'e giriş: `stats.jailEntries++` ve `stats.jailEntryReason[reason]++`
  (`square | chance_card | chest_card | three_doubles`). Kodes'e Gir (30) karesine
  gelmek ayrıca `landings[30]++` yapar (ara konaklama).
- Kodes'te geçirilen her tur: `stats.turnsInJail++` (bu, "kareye geliş" değildir,
  ayrı raporlanır).

### 6.3 Konaklama çözümleme

| Kare türü | Davranış |
|-----------|----------|
| go, property, tax, station, utility, free_parking, jail (ziyaretçi) | Hiçbir şey |
| go_to_jail (30) | `sendToJail(reason="square")` |
| chance / community_chest | Kart çek (§6.5) |

### 6.4 Kodes

Giriş: `inJail = true`, `pos = 10`, `jailTurns = 0`, mevcut zar zinciri biter.

Kodes turu (`jailTurn`):

```
if player.hasGOOJF (herhangi bir desteden):
  kartı kullan (desteye iade), inJail=false, normal tur oyna (playTurn mantığı, çift sayacı 0'dan)
  return
if player.jailStrategy == "pay":            # §6.4.1
  inJail=false; normal tur oyna
  return
# strateji "roll":
(d1,d2) = roll()
if d1 == d2:
  inJail=false; moveBy(d1+d2); resolveLanding(); return     # çift bonusu YOK, tur biter
jailTurns++
if jailTurns == 3:
  inJail=false; moveBy(d1+d2); resolveLanding(); return     # 3. başarısız atışta ödeyip aynı zarla ilerler
# aksi halde Kodes'te kalır; stats.turnsInJail++
```

#### 6.4.1 Yüzdesel strateji parametresi

`config.jailPayProbability ∈ [0,1]`. Her **Kodes'e giriş** anında RNG ile tek bir
karar verilir: `u < p` ise `jailStrategy = "pay"`, değilse `"roll"`. Karar o
hapis dönemi boyunca sabittir (oyuncu 3 tur boyunca denemeye devam eder).
Bu "oyuncuların %60'ı hemen öder" semantiğini birebir karşılar.

Not: "pay" seçen oyuncu cezayı ödedikten sonra zar atar; bu atışta çift gelirse
normal kurala göre tekrar atar (3 çift kuralı dahil). "roll" ile çift atıp çıkan
oyuncu tekrar **atmaz**.

### 6.5 Kart çözümleme

| effect | Uygulama |
|--------|----------|
| none | yok |
| advance_to T | `moveTo(T)`, `landings[T]++`, sonra `resolveLanding` (T Kodes'e Gir olamaz; T Şans/KF olamaz; veri doğrulamada reddet) |
| advance_to_nearest_station | 7→15, 22→25, 36→5; `moveTo`, say |
| advance_to_nearest_utility | 7→12, 22→28, 36→12; `moveTo`, say |
| go_back 3 | 7→4 (Gelir Vergisi), 22→19 (Mecidiyeköy), 36→33 (**Kamu Fonu → yeni kart çekilir**) |
| go_to_jail | `sendToJail(reason=chance_card|chest_card)` |
| get_out_of_jail_free | kart oyuncuya geçer |

"3 kare geri" sonucu Kamu Fonu'na düşüp "Başlangıç'a ilerle" çekmek gibi zincirler
doğal olarak çalışmalı; zincir derinliği 2'yi geçemez ama kod bunu varsaymamalı
(özyineleme veya döngü güvenli olmalı).

## 7. Simülasyon yapılandırması

```ts
interface SimulationConfig {
  edition: "istanbul";          // data dosyası seçimi
  players: number;              // 2..6
  games: number;                // ≥1
  turnsPerGame: number;         // oyuncu başına tur sayısı, ≥1
  jailPayProbability: number;   // 0..1
  seed: number;                 // 32-bit tam sayı; verilmezse Date.now()
  trackPerGame?: boolean;       // oyun bazında final sayımları sakla (varyans için), varsayılan false
}
```

Tek bir koşu: `games` kez: desteleri karıştır, piyonları 0'a koy, `turnsPerGame`
tur boyunca her oyuncu için `playTurn`. Sayaçlar tüm oyunlar boyunca toplanır.

## 8. Çıktı

### 8.1 JSON (`results/<timestamp>-<seed>.json`)

```json
{
  "config": { ...SimulationConfig },
  "meta": { "totalTurns": 1200000, "totalRolls": 1402311, "totalLandings": 1510020,
            "totalFinalLandings": 1402311, "elapsedMs": 2310, "generatedAt": "ISO" },
  "squares": [
    { "index": 0, "name": "Başlangıç", "type": "go", "group": null,
      "landings": 45512, "landingPct": 3.01,
      "finalLandings": 44120, "finalPct": 3.14 },
    ...  (40 kayıt; index 10 = "Sadece Ziyaretçi")
  ],
  "jail": { "entries": 61200, "entryPct": 4.05,
            "byReason": { "square": ..., "chance_card": ..., "chest_card": ..., "three_doubles": ... },
            "turnsInJail": 83000, "turnsInJailPctOfTurns": 6.9 },
  "groups": [ { "group": "turuncu", "landings": ..., "landingPct": ... }, ... ],
  "cards": { "chanceDraws": ..., "chestDraws": ... },
  "perGame": null
}
```

`landingPct` = `landings / totalLandings * 100`; `finalPct` = `finalLandings /
totalFinalLandings * 100`. Kodes (içeride) `squares` dizisine dahil edilmez,
`jail` altında raporlanır; ancak `finalLandings` toplamında Kodes'e girişler
sayılır (`totalFinalLandings = Σ squares.finalLandings + jail.entries`).

### 8.2 Terminal

`finalPct`'ye göre sıralı tablo: `#  Kare  Grup  Geliş  %  Final  %`. Altında Kodes
özeti ve grup toplamları. Güzel olması gerekmez, okunabilir olması yeter.

### 8.3 CLI

```
npx tsx src/cli.ts --players 4 --games 1000 --turns 1000 --jail-pay 0.6 --seed 42 --out results/run1.json
```

Bütün argümanların varsayılanı olmalı (`players=4, games=100, turns=1000,
jail-pay=0.5, seed=rastgele`). Geçersiz değerlerde açıklayıcı hata ver.

## 9. Performans hedefleri

- Hedef: ≥ 2 milyon tur / saniye (M-serisi Mac, Node 22). Zorunlu değil ama
  tasarım buna izin vermeli: sayaçlar `Int32Array`/`Float64Array`, tur başına
  nesne ayırma yok, kart desteleri dizi + baş işaretçisi (shift/push yerine
  dairesel indeks veya `Uint8Array` ile).
- `simulate.ts` isteğe bağlı bir `onProgress(gamesDone)` geri çağrısı alsın
  (ileride Web Worker için).

## 10. Testler (vitest)

Veri:
- Tahta 40 kare, indeksler 0..39 sıralı, 4 istasyon (5,15,25,35), 2 kamu kuruluşu
  (12,28), 3 Şans (7,22,36), 3 Kamu Fonu (2,17,33), 22 mülk.
- Desteler 16'şar kart; hareket kartı sayıları (Şans: 10 hareket + 1 GOOJF + 5 düz;
  KF: 2 hareket + 1 GOOJF + 13 düz).

Motor (tohumlu RNG ile deterministik, gerekirse enjekte edilen sahte zar):
- `nearestStation(7)=15, (22)=25, (36)=5`; `nearestUtility(7)=12, (22)=28, (36)=12`.
- 3 kare geri: 36 → 33 ve ikinci kart çekilir (deste başı 2 ilerler).
- Üç çift → Kodes, piyon üçüncü atışta hareket etmez, `jailEntries.three_doubles` artar.
- Kodes'e Gir (30): `landings[30]` artar, oyuncu `inJail`, `pos=10`.
- Kodes "roll" stratejisi: çift → çıkar, tekrar atmaz; 3. başarısız atışta zarla çıkar.
- Kodes "pay" stratejisi: hemen çıkar, çift atarsa tekrar atar.
- GOOJF: kart desteden çıkar (deste 15), Kodes'e girince sonraki turda otomatik
  kullanılır, deste tekrar 16 olur ve kart en altta.
- `jailPayProbability=1` → hiç `turnsInJail` olmaz (GOOJF hariç); `=0` → herkes dener.
- Aynı seed + config → birebir aynı JSON (meta.elapsedMs/generatedAt hariç).

Simülasyon (küçük koşu, ör. 4 oyuncu × 20 oyun × 500 tur):
- `Σ finalLandings + jail.entries = totalFinalLandings`, `Σ landings ≥ totalFinalLandings`.
- Zar toplamı dağılımı 2..12 için beklenen üçgen dağılıma yakın (kaba tolerans).
- Niteliksel kontroller: Kodes (giriş) en yüksek kova; turuncu grup toplamı
  pembe gruptan yüksek; Şans kareleri `finalPct` olarak `landingPct`'den düşük
  (hareket kartları oyuncuyu oradan alır); Kodes'e Gir (30) `finalLandings=0`.

## 11. Teslim kontrol listesi

1. `npm install && npm test` temiz.
2. `npx tsx src/cli.ts --players 4 --games 1000 --turns 1000 --seed 1` birkaç
   saniyede biter, JSON ve tabloyu üretir.
3. README'ye: kurulum, CLI kullanımı, parametre açıklamaları, JSON şeması,
   tahta/kart verilerinin kaynakları.
4. `.gitignore`: `node_modules/`, `results/`, `dist/`.

## 12. Açık sorular

Kalmadı. Kart seti (§5), 23 numaralı kare (Erenköy) ve baskı (Monopoly İstanbul)
kullanıcı tarafından 2026-10-14'te doğrulandı. Plan olduğu gibi uygulanabilir.
