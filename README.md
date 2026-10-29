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
`fs`, `process`, `console` kullanmaz ve tarayıcıda da çalışır. Tek çalışma zamanı
bağımlılığı olan `three` yalnızca `web/` altındaki görselleştirme içindir.

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

Diğer komutlar: `npm run sim -- <seçenekler>` (CLI kısayolu), `npm run typecheck`
(motor + web), `npm run build` (motoru `dist/` altına derler).

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

## Görselleştirme

Tarayıcıda çalışan 3D arayüz: tahta, piyonlar, zarlar ve kart desteleri; altta
Başlat/Durdur ve hız kaydırıcısı; canlı güncellenen dağılım görünümü. Motoru doğrudan
kullanır, yani arayüzdeki sayılar aynı seed ile CLI'ın ürettikleriyle birebir aynıdır.

```bash
npm run dev
```

Vite'ın yazdığı adresi (varsayılan `http://localhost:5173`) tarayıcıda açın.
Statik derleme için `npm run build:web` (çıktı `dist-web/`), derlenmiş hali denemek
için `npm run preview`.

### Kontroller

- **Başlat / Durdur / Devam Et**: alttaki büyük buton; `Boşluk` tuşu da aynı işi yapar.
  Durdurulduğunda süren hamlenin animasyonu tamamlanır, yeni tur başlamaz.
- **Hız kaydırıcısı**: 0,5 – 1.000.000 tur/sn, logaritmik. "Tur" bir oyuncunun sırasıdır.
- **Dağılımı Göster**: tahtaya üstten bakan ısı haritası (aşağıda). `Esc` kapatır.
- **Sıfırla**: sayaçları ve piyonları başa alır, ayarlar panelindeki değerleri uygular.
- **Ayarlar** (sağ üst): piyon sayısı (2–6), Kodes'te hemen ödeyenlerin oranı, seed
  (boşsa rastgele seçilir ve sol üstte gösterilir), oyun başına tur (boşsa tek oyun
  kesintisiz sürer). Henüz tur oynanmadıysa değişiklik anında uygulanır; koşu verisi
  varken **Uygula ve Sıfırla** ile uygulanır. Simülasyon çalışırken ayarlar kilitlidir.
- Fareyle sürükleyerek kamera döndürülür, tekerlekle yakınlaştırılır.

### Hız rejimleri

| Rejim | Hız | Ne görünür |
|-------|-----|------------|
| Animasyon | ≤ 10 tur/sn | Zar yuvarlanır, piyon kare kare zıplar, çekilen kart gösterilir. Kartla ileri gitme ve Kodes'e giriş tek bir yüksek yayla, "3 kare geri" geriye zıplayarak oynar. |
| Hızlı | 10–60 tur/sn | Zar değeri doğrudan görünür, piyon turun bittiği kareye tek hareketle kayar. |
| Turbo | > 60 tur/sn | Animasyon yoktur; piyonlar her karede güncel konumlarına ışınlanır. Sol üstteki "Hız" hedefi değil, ölçülen hızı gösterir. |

Kodes'teki piyonlar hücrenin içinde, ziyaretçiler köşenin dış şeridinde durur. Elinde
"Kodes'ten Ücretsiz Çık" kartı olan piyonun yanında küçük bir kart görünür.

### Dağılım görünümü

Her kare, seçilen sayaca (**Geliş** veya **Final**) göre renklendirilir ve yüzdesi
üzerine yazılır; Kodes köşesinde hücre (Kodes'e girişler) ile dış şerit (Sadece
Ziyaretçi) ayrıdır. Renk ölçeği verinin en düşük ve en yüksek değeri arasına yayılır
(lejantta ikisi de yazar); kareler arasındaki fark bir iki yüzde puanı olduğu için
sıfırdan başlayan bir ölçekte hepsi aynı tonda görünürdü. Yanda yüzdeye göre sıralı
kare tablosu ve grup toplamları vardır; bir karenin üzerine gelince geliş ve final
sayıları birlikte görünür. Simülasyon sürerken saniyede birkaç kez güncellenir.
**JSON indir** o anki sonucu aşağıdaki şemayla kaydeder.

Arayüzde kesintisiz modda `N` tam tur (her oyuncu `N` kez) oynandığında sonuç,
`npx tsx src/cli.ts --games 1 --turns N` ile aynı seed ve ayarlarla üretilenle aynıdır.

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
src/engine.ts              playTurn: hareket, Kodes, kart çözümleme, tur olayları (TurnObserver)
src/stats.ts               sayaçlar ve sonuç özeti
src/simulate.ts            runSimulation, yapılandırma doğrulaması
src/session.ts             Session: tur tur sürülebilen simülasyon (arayüz bunu kullanır)
src/cli.ts                 komut satırı aracı
web/index.html             arayüz iskeleti
web/src/main.ts            kurulum ve bağlama
web/src/controller.ts      durum makinesi ve ana döngü (hız rejimleri)
web/src/speed.ts           kaydırıcı ↔ hız eşlemesi
web/src/layout.ts          tahta geometrisi, piyon yuvaları
web/src/timeline.ts        tur olayları → animasyon adımları
web/src/boardArt.ts        tahtanın Canvas 2D çizimi (3D doku ve dağılım görünümü ortak)
web/src/scene/             Three.js sahnesi: tahta, piyonlar, zarlar, desteler
web/src/ui/                kontroller, sayaçlar, ayarlar, dağılım görünümü
test/                      vitest testleri (test/web: arayüzün DOM'suz modülleri)
```

Tahtadaki her şey kodla çizilir; Hasbro'ya ait logo, maskot veya görsel kullanılmaz.

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
