# Monopoly Simülatörü — Görselleştirme Uygulama Planı

Bu belge, mevcut simülasyon motorunun üzerine kurulacak tarayıcı tabanlı 3D
görselleştirmenin sıfırdan uygulanması için yazılmıştır. Motorun kendisi
[PLAN.md](PLAN.md)'de tanımlıdır ve uygulanmıştır (`src/`, 113 test); kurallar ve
sayım tanımları için o belge ile [README.md](README.md) esas alınır.

---

## 1. Amaç

Simülasyonu izlenebilir hale getirmek:

- Gerçek Monopoly tahtasına çok benzeyen **3D bir tahta**; seçilen piyon sayısı kadar
  piyon Başlangıç'ta durur.
- Altta büyük bir **Başlat / Durdur** butonu.
- Butonun altında **hız kaydırıcısı** (sağa = hızlı, sola = yavaş).
- **Dağılımı Göster** butonu: tahtaya üstten bakan 2D görünümde her karenin
  geliş yüzdesi, canlı olarak.

## 2. Kararlar (kesinleşmiş)

| # | Konu | Karar |
|---|------|-------|
| 1 | Hız | **İki rejimli, logaritmik kaydırıcı.** Yavaş uçta piyonlar animasyonla ilerler; hızlı uçta animasyon yoktur, piyonlar güncel konumlarına ışınlanır. Bkz. §7. |
| 2 | Dağılım görünümü | **Canlı.** Simülasyon sürerken de açılabilir ve güncellenir; durdurmak gerekmez. |
| 3 | Tahta çizimi | 3D tahtanın yüzeyi ile 2D dağılım görünümü **aynı çizim kodundan** çıkar. |
| 4 | Sayaç seçimi | 2D görünümde **Geliş / Final** anahtarı; varsayılan Geliş. Kodes ve Sadece Ziyaretçi ayrı gösterilir. |
| 5 | Koşu yapısı | Varsayılan **kesintisiz tek oyun** (Durdur'a basılana kadar). "Oyun başına tur" isteğe bağlı ayar: doluysa o kadar turdan sonra piyonlar Başlangıç'a döner, desteler yeniden karışır, sayaçlar birikmeye devam eder. |
| 6 | Piyonlar | Farklı renklerde **sade klasik piyon** (figür modeli yok). |
| 7 | Ayarlar | Piyon sayısı (2–6), Kodes'te ödeme oranı, seed (boşsa rastgele), oyun başına tur (boşsa kesintisiz). |
| 8 | Marka | Yerleşim, renk şeritleri ve kare adları aslına sadık; **Hasbro logosu, maskotu ve taranmış görselleri kullanılmaz**, her şey kodla çizilir. |
| 9 | Çalışma yeri | Simülasyon **ana iş parçacığında**, kare başına zaman bütçesiyle çalışır. Web Worker yok (bkz. §7.3). |

## 3. Teknoloji

- **Vite 8 + TypeScript + Three.js** (`three` ≥ 0.186, `@types/three`). Arayüz
  çatısı yok: sade DOM + CSS.
- `three` yalnızca web tarafının bağımlılığıdır. `src/` altındaki motor
  bağımlılıksız kalır ve `web/`'den hiçbir şey içe aktarmaz.
- Web kodu motoru kaynak olarak içe aktarır (`../../src/session.js` gibi; Vite
  `.js` → `.ts` çözümlemesini ve `with { type: "json" }` içe aktarmalarını destekler).
- DOM/WebGL'e dokunmayan modüller (hız eşlemesi, tahta geometrisi, zaman çizelgesi,
  renk ölçeği) saf tutulur ve mevcut vitest kurulumuyla test edilir.

Dosya yapısı (öneri):

```
monopoly/
  vite.config.ts                 # root: "web", build.outDir: "../dist-web"
  src/
    engine.ts                    # + TurnObserver kancası (§4.1)
    session.ts                   # YENİ: adım adım sürülebilen oturum (§4.2)
  web/
    index.html
    tsconfig.json                # kök tsconfig'i genişletir; lib'e DOM, types: vite/client
    src/
      main.ts                    # kurulum ve bağlama
      controller.ts              # durum makinesi + ana döngü (§7)
      speed.ts                   # kaydırıcı ↔ hız, rejim seçimi          (saf)
      layout.ts                  # kare dikdörtgenleri, yönler, piyon yuvaları (saf)
      timeline.ts                # tur olayları → animasyon adımları      (saf)
      heat.ts                    # renk ölçeği, yüzde biçimleme           (saf)
      theme.ts                   # grup/piyon/tahta renkleri, yazı tipleri
      boardArt.ts                # tahtanın Canvas 2D çizimi (3D doku + 2D görünüm)
      glyphs.ts                  # vektör simgeler (tren, vapur, ampul, musluk, ?, sandık…)
      scene/
        scene.ts                 # renderer, kamera, ışık, OrbitControls, yeniden boyutlama
        boardMesh.ts  pawns.ts  dice.ts  decks.ts
      ui/
        controls.ts              # Başlat/Durdur, hız kaydırıcısı, Dağılımı Göster
        settings.ts  hud.ts  distribution.ts
      styles.css
  test/
    observer.test.ts  session.test.ts
    web/ speed.test.ts  layout.test.ts  timeline.test.ts  heat.test.ts
```

`package.json` betikleri: `dev` (vite), `build:web` (vite build), `preview`
(vite preview). `typecheck` hem kök hem `web/tsconfig.json` için çalışmalı.
`.gitignore`'a `dist-web/` eklenir. `vitest.config.ts` ayrı kalır (vitest onu
`vite.config.ts`'e tercih eder); `include` deseni `test/web/` altını da kapsamalı.

## 4. Motor değişiklikleri

Mevcut davranış ve sonuçlar değişmemelidir: aynı seed + config, değişiklikten önceki
ile birebir aynı JSON'u üretmeli; mevcut 113 testin hepsi geçmeli.

### 4.1 Tur olayları (`TurnObserver`)

Motor şu an yalnızca sayaç tutuyor. Animasyon için bir turda olanların sıralı
dökümü gerekir. `GameState`'e isteğe bağlı bir gözlemci eklenir:

```ts
// 0 = zarla ilerleme, 1 = kartla ileri gitme, 2 = kartla geri gitme
type MoveVia = 0 | 1 | 2;
// 0 = Kodes'ten Ücretsiz Çık kartı, 1 = ödeme, 2 = çift attı, 3 = üçüncü başarısız atış
type JailExit = 0 | 1 | 2 | 3;

interface TurnObserver {
  /** Zar atıldı (Kodes'teki çıkış denemeleri dahil). */
  roll(player: number, d1: number, d2: number): void;
  /** Piyon bir kareye kondu. `stats.landings` artışlarıyla bire bir. */
  land(player: number, from: number, to: number, via: MoveVia): void;
  /** Kart çekildi. `cardIndex`, ilgili destenin `cards` dizisindeki sıradır. */
  card(player: number, deck: "chance" | "communityChest", cardIndex: number): void;
  /** Kodes'e girdi. `reason`, JAIL_ENTRY_REASONS içindeki sıradır. */
  jailEnter(player: number, reason: number): void;
  /** Kodes'ten çıktı (ardından aynı turda hareket gelir). */
  jailExit(player: number, how: JailExit): void;
  /** Çift atamadı, Kodes'te kaldı. */
  jailStay(player: number): void;
}
```

- `state.observer` varsayılan olarak `null`'dır; her çağrı noktası `null` kontrolü
  yapar. Olaylar yalnızca sayısal argüman taşır; **motor olay için nesne ayırmaz**.
- Oyuncu sırası olaylarda gerektiği için `PlayerState`'e `id` eklenebilir veya
  `playTurn` geçerli sırayı state'te tutabilir (uygulayıcının tercihi;
  `engine.test.ts`'teki `startGame` testi `toEqual` ile tam nesne karşılaştırıyor,
  alan eklenirse güncellenmeli).
- Gözlemci RNG akışını etkilemez: gözlemcili ve gözlemcisiz koşu aynı sayaçları verir.
- **Hız korunmalı.** Değişiklikten önce ve sonra
  `npx tsx src/cli.ts --games 1000 --turns 1000 --seed 1` ile tur/sn ölçülür
  (şu an ~28 milyon tur/sn); gözlemcisiz yolda kayıp %10'u geçmemeli.

### 4.2 Oturum (`src/session.ts`)

`runSimulation` tek seferde koşup biter. Arayüzün tur tur sürebileceği, saf
(DOM'suz) bir sarmalayıcı eklenir:

```ts
interface SessionConfig {
  edition: Edition;
  players: number;              // 2..6
  jailPayProbability: number;   // 0..1
  seed: number;                 // verilmezse Date.now() >>> 0
  turnsPerGame: number | null;  // null = kesintisiz tek oyun
}

class Session {
  readonly config: SessionConfig;
  readonly state: GameState;      // board, players, desteler, stats
  readonly nextPlayer: number;    // sıradaki oyuncu
  readonly gamesStarted: number;  // ≥ 1
  /** Sıradaki oyuncunun turunu oynar; gerekirse önce yeni oyun başlatır. */
  playNextTurn(): void;
  /** n tur oynar (hızlı yol; döngü içinde ayırma yok). */
  playTurns(n: number): void;
  /** Güncel sayaçlardan sonuç üretir; CLI ile aynı SimulationResult şeması. */
  snapshot(): SimulationResult;
}
```

- Yapılandırma doğrulaması `resolveConfig` ile aynı kuralları ve `ConfigError`'ı
  kullanır (tekrar yazılmaz; ortak yardımcılar paylaşılır).
- Oyun sınırı: `turnsPerGame` doluysa, her oyuncu o kadar tur oynadıktan sonraki ilk
  `playNextTurn` çağrısı `startGame` yapar (piyonlar 0'a, desteler yeniden karışır).
- `snapshot()` içindeki `config`: `games` = `gamesStarted`; kesintisiz modda
  `turnsPerGame` = o ana kadar tamamlanan tam tur (round) sayısı. Böylece indirilen
  JSON CLI çıktısıyla aynı şemadadır.
- **Eşdeğerlik:** aynı seed ile `turnsPerGame = T` oturumu `G × T × players` tur
  sonra `runSimulation({ games: G, turnsPerGame: T, ... })` ile aynı sayaçları
  vermelidir. Kesintisiz oturum `N × players` tur sonra
  `runSimulation({ games: 1, turnsPerGame: N })` ile aynıdır.

## 5. Tahta geometrisi ve çizimi

### 5.1 Geometri (`layout.ts`, saf)

Gerçek tahta oranları: köşe kareler kare biçimlidir; kenar karelerin derinliği
köşe kenarına, genişliği bunun ~0,62'sine eşittir. Birim olarak kenar kare
genişliği 1, köşe kenarı 1,6 alınır → tahta kenarı `9 × 1 + 2 × 1,6 = 12,2`.

Kare 0 (Başlangıç) sağ alt köşededir; indeksler saat yönünde artar (gerçek tahtadaki
gibi alt sıra sağdan sola 1–9, sol alt köşe 10, sol kenar aşağıdan yukarı 11–19,
sol üst köşe 20, üst sıra soldan sağa 21–29, sağ üst köşe 30, sağ kenar yukarıdan
aşağı 31–39).

`layout.ts` şunları verir:

- `squareRect(index)`: tahta koordinatlarında dikdörtgen + kenar (alt/sol/üst/sağ/köşe).
- `squareRotation(index)`: karenin içeriğinin dönüşü. Yazılar tahtanın dışından
  okunacak şekilde durur (alt sıra düz, sol sıra 90°, üst sıra 180°, sağ sıra 270°).
- `pawnSlot(index, slot, count)`: bir karedeki piyon yuvası (aynı karede 6 piyona
  kadar üst üste binmeyen 3×2 düzen).
- `jailSlot(slot)`: Kodes hücresinin içindeki yuvalar; ziyaretçiler için köşenin
  dış şeridindeki yuvalar ayrıdır.

### 5.2 Çizim (`boardArt.ts`)

`drawBoard(ctx, sizePx, board, options)` tahtayı Canvas 2D'ye çizer. Aynı
fonksiyon iki yerde kullanılır: 3D tahtanın üst yüz dokusu (`CanvasTexture`) ve 2D
dağılım görünümü (`options.overlay` ile, §8).

Görünüm (aslına sadık, kodla çizilmiş):

- **Zemin:** klasik açık yeşil (`#CDE6D0` dolayı), kareler arasında ince siyah çizgi.
- **Mülkler:** karenin tahta merkezine bakan ucunda grup rengi şeridi, altında
  büyük harfle semt adı. Veride fiyat yok; fiyat satırı çizilmez.
- **Ulaşım:** Haydarpaşa ve Sirkeci için tren, Kadıköy ve Kabataş iskeleleri için
  vapur simgesi + ad.
- **Kamu kuruluşları:** Elektrik İdaresi için ampul, Sular İdaresi için musluk.
- **Şans:** büyük soru işareti. **Kamu Fonu:** sandık simgesi. **Vergiler:** ad + simge.
- **Köşeler:** Başlangıç (ok ile), Kodes (parmaklıklı hücre + "Sadece Ziyaretçi"
  şeridi), Ücretsiz Otopark, Kodes'e Gir.
- **Orta alan:** Şans ve Kamu Fonu deste yerleri (çapraz yerleşim, gerçek tahtadaki
  gibi) ve çapraz bir başlık. Başlık **nötr** olmalı (ör. "İSTANBUL"); Monopoly
  logosu veya maskotu çizilmez.

Grup renkleri `theme.ts` içinde, grup adına göre:

| Grup | Renk |
|------|------|
| kahverengi | `#955436` |
| açık mavi | `#AAE0FA` |
| pembe | `#D93A96` |
| turuncu | `#F7941D` |
| kırmızı | `#ED1B24` |
| sarı | `#FEF200` |
| yeşil | `#1FB25A` |
| lacivert | `#0072BB` |

Bilinmeyen grup için nötr gri kullanılır (ileride başka baskı eklenirse kırılmasın).

Yazı ayrıntıları:

- Büyük harfe çevirirken **`toLocaleUpperCase("tr-TR")`** kullanılır
  ("Sirkeci" → "SİRKECİ"; düz `toUpperCase()` "SIRKECI" üretir ve yanlıştır).
- Uzun adlar ("Kadıköy Vapur İskelesi", "Kodes / Sadece Ziyaretçi") kelime
  sınırından satıra bölünür, sığmazsa punto küçültülür; kare dışına taşma olmaz.
- Yazı tipi: sistem yığını (`"Futura", "Century Gothic", "Trebuchet MS", sans-serif`);
  ağdan yazı tipi indirilmez.
- Doku çözünürlüğü: `renderer.capabilities.maxTextureSize` izin veriyorsa 4096,
  değilse 2048. Eğik açıda yazıların okunması için anizotropi en yükseğe alınır.

## 6. 3D sahne

- **Tahta:** ince bir kutu (12,2 × 0,15 × 12,2), üst yüzünde §5.2 dokusu, kenarları
  koyu. Altında masa düzlemi. Yumuşak gölgeler.
- **Işık:** yarımküre ışığı + gölge düşüren tek yönlü ışık.
- **Kamera:** perspektif, varsayılan olarak tahtaya çaprazdan (3/4) bakar.
  `OrbitControls` ile döndürme/yakınlaştırma; kamera masanın altına inemez,
  yakınlaşma ve uzaklaşma sınırlıdır.
- **Piyonlar:** `LatheGeometry` ile klasik piyon profili, `MeshStandardMaterial`.
  Altı ayırt edilebilir renk (ör. kırmızı, mavi, yeşil, sarı, mor, beyaz). Piyon
  sayısı ayarı değişince Başlangıç'taki piyonlar hemen güncellenir.
- **Zarlar:** tahtanın ortasında iki 3D zar (yüzleri kodla çizilmiş noktalar). Fizik
  yok: animasyonlu rejimde kısa bir yuvarlanma hareketi atılan değerlerin üstte
  kaldığı duruşla biter.
- **Desteler:** orta alandaki deste yerlerinde ince kart yığınları. Kart çekilince
  üstteki kart hafifçe kalkar ve kartın metni ekranda kısa bir bildirim olarak
  görünür ("Yeniköy'e ilerleyin."). Elde tutulan "Kodes'ten Ücretsiz Çık" kartı,
  ilgili piyonun yanında küçük bir işaretle gösterilir.
- **Kodes:** içerideki piyonlar hücrenin içinde, ziyaretçiler dış şeritte durur.
- `devicePixelRatio` 2 ile sınırlanır; pencere yeniden boyutlanınca kamera ve
  renderer güncellenir.

## 7. Denetleyici: durumlar, hız ve ana döngü

### 7.1 Durumlar ve buton

| Durum | Buton metni | Basınca |
|-------|-------------|---------|
| `idle` (hiç koşmadı / sıfırlandı) | **Başlat** | `running` |
| `running` | **Durdur** | `paused` |
| `paused` | **Devam Et** | `running` |

Ayrı ve küçük bir **Sıfırla** butonu sayaçları ve piyonları başa alır (`idle`).
`Boşluk` tuşu Başlat/Durdur'u tetikler.

Temel ilke: **motorun durumu her zaman animasyonun önündedir.** Bir tur önce motorda
oynanır, olayları toplanır, sonra animasyon bu olayları yeniden oynatır. Bu yüzden
Durdur'a basıldığında yeni tur başlatılmaz, süren animasyon tamamlanır; hız
değişince veya rejim atlanınca süren animasyon anında sonuna alınır. Piyonların
ekrandaki konumu her zaman motor durumuna yakınsar.

### 7.2 Hız kaydırıcısı (`speed.ts`, saf)

Kaydırıcı 0–100, değer logaritmik eşlenir:

```
hız (tur/sn) = vMin × (vMax / vMin) ^ (s / 100)      vMin = 0,5   vMax = 1.000.000
```

Varsayılan konum ≈ 2 tur/sn. Kaydırıcının yanında güncel değer yazılır
("2 tur/sn", "12 bin tur/sn"). Burada "tur" bir oyuncunun sırasıdır.

| Rejim | Hız | Davranış |
|-------|-----|----------|
| A — Animasyon | ≤ 10 tur/sn | Zar yuvarlanır; piyon zar toplamı kadar kare kare zıplar; kart ve Kodes hareketleri gösterilir. |
| B — Hızlı | 10–60 tur/sn | Zar yuvarlanmaz, değerler doğrudan gösterilir; piyon son konumuna tek hareketle kayar. |
| C — Turbo | > 60 tur/sn | Animasyon ve olay toplama yok (`observer = null`). Her karede bir tur demeti oynanır, piyonlar güncel konumlarına ışınlanır, zar ve kart bildirimi gizlenir. |

Rejim A'daki hareketler (`timeline.ts`, olaylardan üretilir):

- `land` (zarla): çevre boyunca ileri doğru kare kare zıplama (parabolik yay).
- `land` (kartla ileri): hedefe tek bir yüksek yayla uçuş (zar hareketinden ayırt
  edilsin diye).
- `land` (kartla geri): geriye doğru kare kare zıplama.
- `jailEnter`: Kodes hücresine tek yayla uçuş. `jailStay`: piyon yerinde kısa bir
  sallanma. `jailExit`: hücreden çıkıp ardından gelen hareket.
- Bir turun toplam süresi yaklaşık `1 / hız` saniyedir; çiftle gelen ek atışlar
  aynı sürenin tekrarıdır (gerçek hız hedefin biraz altında kalabilir, sorun değil).

### 7.3 Ana döngü (`controller.ts`)

`requestAnimationFrame` ile; `dt` 100 ms ile sınırlanır (sekme arka plandan dönünce
sıçrama olmasın).

- **A/B:** süren animasyon yoksa ve birikim ≥ 1 ise: `session.playNextTurn()`
  gözlemciyle çağrılır, olaylar toplanır, zaman çizelgesi kurulur. Birikim 1'i
  aşmaz (patlama olmaz).
- **C:** `n = floor(birikim)` tur `session.playTurns` ile oynanır. Kare başına
  **8 ms zaman bütçesi** vardır (her 1024 turda `performance.now()` kontrolü);
  bütçe dolarsa kalan birikim atılır. HUD'da hedef değil **ölçülen** hız gösterilir.

Motor ~28 milyon tur/sn hızında olduğundan 8 ms'lik bütçe 1 milyon tur/sn hedefini
rahatça karşılar; bu yüzden Web Worker gerekmez ve piyon konumları ile sayaçlar
doğrudan okunabilir.

## 8. Dağılım görünümü

**Dağılımı Göster** butonu ekranın büyük kısmını kaplayan bir katman açar (Esc veya
kapat düğmesiyle kapanır; arkada simülasyon sürer).

- Tahta üstten, §5.2'deki `drawBoard` ile çizilir; her karenin gövdesi ısı rengine
  boyanır, grup rengi şeridi görünür kalır.
- Her karede yüzde yazar (`tr-TR` biçimi, iki ondalık: "%3,19").
- **Kodes köşesi ikiye ayrılır:** hücre = Kodes'e girişler (`jail.entryPct` /
  `jail.finalPct`), dış şerit = Sadece Ziyaretçi (10 numaralı karenin değeri).
- **Geliş / Final** anahtarı; varsayılan Geliş. (Final modunda Kodes'e Gir karesi
  her zaman %0'dır; bu beklenen davranıştır.)
- Renk ölçeği: tek tonlu, algısal olarak sıralı (açık → koyu), doğrusal, 0'dan en
  yüksek değere. Yazı rengi zemin parlaklığına göre açık/koyu seçilir. Yanında
  ölçek göstergesi (lejant) bulunur.
- Yan tarafta (dar ekranda altta) yüzdeye göre sıralı kare tablosu ve grup toplamları.
- **JSON indir** butonu `session.snapshot()` çıktısını CLI ile aynı şemada indirir.
- Canlı güncelleme saniyede ~4 kez yapılır (her karede yeniden çizilmez). Veri
  yokken "Henüz veri yok" yazar.

Veri kaynağı her zaman `session.snapshot()`'tır; yüzdeler arayüzde yeniden
hesaplanmaz.

## 9. Arayüz yerleşimi

- Tuval tüm pencereyi kaplar.
- **Alt orta panel:** büyük Başlat/Durdur butonu; altında hız kaydırıcısı ("Yavaş"
  … "Hızlı" etiketleri, güncel değer ve rejim adı); yanında Dağılımı Göster.
- **Sol üst (HUD):** toplam tur, zar atışı, oyun sayısı, ölçülen hız, son olay
  satırı (ör. "Mavi: 4+3 → Şans → Kadıköy Vapur İskelesi").
- **Sağ üst (ayarlar):** piyon sayısı (2–6), Kodes'te ödeme oranı (%0–100), seed
  (boş = rastgele), oyun başına tur (boş = kesintisiz), Sıfırla.
- Ayarlar yalnızca `idle` veya `paused` durumunda değiştirilebilir. `idle`'da
  değişiklik hemen uygulanır; koşu verisi varken değişiklik **Uygula ve Sıfırla**
  ile uygulanır (sayaçlar sıfırlanır). Geçersiz değerde `ConfigError` mesajı
  alanın altında gösterilir.
- Kullanılan seed her zaman ekranda görünür (rastgele seçildiyse de), böylece koşu
  CLI ile tekrarlanabilir.
- Metinler Türkçedir. Pencere daraldığında paneller üst üste binmez.

## 10. Testler

Motor (vitest):

- **Gözlemci:** sahte zarlı senaryolarda olay sırası (ör. 36'da "3 kare geri":
  `roll`, `land(29→36)`, `card`, `land(36→33, geri)`, `card`; üç çift:
  üçüncü `roll`'dan sonra `land` yok, `jailEnter`).
- Olay sayıları sayaçlarla tutarlı: `land` = Σ landings, `roll` = totalRolls,
  `card` = çekilen kartlar, `jailEnter` = jailEntries, `jailStay` = turnsInJail.
- Gözlemcili ve gözlemcisiz koşu aynı sayaçları verir.
- **Oturum:** §4.2'deki iki eşdeğerlik; oyun sınırında piyonların 0'a dönmesi ve
  destelerin 16'ya tamamlanması; `playTurns(n)` ile `n` kez `playNextTurn` aynı
  sonucu verir; geçersiz yapılandırma `ConfigError` fırlatır.

Web, saf modüller (vitest, DOM'suz):

- `speed`: uç değerler (0 → 0,5; 100 → 1.000.000), monotonluk, rejim eşikleri,
  ters eşleme.
- `layout`: 40 kare çevreyi boşluksuz ve çakışmasız kaplar; köşeler 0/10/20/30'da;
  aynı karedeki 6 yuva ve Kodes yuvaları birbirinden ayrık ve kare sınırları içinde.
- `timeline`: olay dizisinden doğru sırada adımlar; toplam süre hedefle uyumlu;
  zar hareketinde ara kareler doğru (39 → 0 sarması dahil).
- `heat`: 0 ve en yüksek değer uç renkleri verir; `tr-TR` yüzde biçimi.

Tarayıcıda elle doğrulama (geliştirme sunucusu açıkken, ekran görüntüsüyle):

1. Açılışta tahta ve seçili sayıda piyon Başlangıç'ta; konsolda hata yok.
2. Bütün kare adları okunaklı, taşma yok, Türkçe büyük harfler doğru (SİRKECİ, ŞİŞLİ).
3. Başlat → buton "Durdur" olur, piyonlar hareket eder; Durdur → durur, "Devam Et".
4. Kaydırıcı uçtan uca: A → B → C geçişlerinde takılma veya piyonların geride
   kalması yok; turbo'da HUD sayaçları akar.
5. Yavaş hızda bir Şans kartı hareketi, bir Kodes'e giriş ve bir çift atışı gözle
   doğrulanır.
6. Dağılım görünümü koşu sırasında açılır ve güncellenir; Geliş/Final anahtarı
   çalışır; Kodes ile Ziyaretçi ayrı.
7. Aynı seed ile arayüzde `N` tur koşup indirilen JSON'un kare sayıları, CLI'da
   aynı seed ve tur sayısıyla üretilenle aynıdır.
8. Piyon sayısı 2 ve 6 ile denenir; ayar değişikliği ve Sıfırla çalışır.

## 11. Uygulama sırası

Her adım kendi başına doğrulanabilir olmalıdır.

1. **Motor:** `TurnObserver` + `Session` + testleri; hız ölçümü (önce/sonra).
2. **İskelet:** Vite, `web/` yapısı, `layout.ts` + `boardArt.ts`; önce düz 2D
   tuvalde tahtayı doğru çiz, sonra 3D sahneye doku olarak koy.
3. **Piyonlar ve denetleyici:** Başlat/Durdur, rejim A animasyonu, zarlar.
4. **Hız:** kaydırıcı, rejim B ve C, HUD.
5. **Dağılım görünümü:** ısı haritası, anahtar, tablo, JSON indirme.
6. **Ayarlar, Sıfırla, desteler/kart bildirimi, cila.**
7. **README:** "Görselleştirme" bölümü (çalıştırma, kontroller, hız rejimleri).

## 12. Teslim kontrol listesi

1. `npm install && npm test` temiz; mevcut 113 test + yeni testler geçer.
2. `npm run typecheck` hem motor hem web için temiz.
3. `npm run dev` ile uygulama açılır; §10'daki 8 maddelik elle doğrulama tamam.
4. `npm run build:web` hatasız derlenir; `npm run preview` ile çalışır.
5. CLI davranışı ve çıktısı değişmemiş; motor hızı §4.1'deki sınır içinde.
6. `src/` altında `cli.ts` dışında hâlâ Node'a özgü API yok; motor `web/`'den bir
   şey içe aktarmıyor.

## 13. Kapsam dışı (ileride)

- Gerçek oyun figürleri (şapka, araba vb.) için 3D modeller.
- 3D tahtada karelerden yükselen sütunlarla ısı gösterimi.
- Web Worker ve çok çekirdekli koşu.
- Mobil/dokunmatik için özel yerleşim (uygulama dar ekranda bozulmamalı, ama
  hedef masaüstüdür).
- Mülk, para ve kira (motor kapsamı dışında).

## 14. Açık sorular

Uygulamayı engelleyen soru yok. Karar verilirse plana eklenecek tek konu:

- Araç şirket dışında yayımlanacaksa adlandırma ve görsel benzerlik hukuken
  gözden geçirilmelidir (§2, karar 8 bunu varsayılan olarak güvenli tarafta tutar).
