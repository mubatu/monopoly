import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { ConfigError, DEFAULT_CONFIG, resolveConfig, runSimulation } from "./simulate.js";
import { EDITIONS, type Edition, type SimulationConfig, type SimulationResult } from "./types.js";

const HELP = `Monopoly kare olasılığı simülatörü

Kullanım:
  npx tsx src/cli.ts [seçenekler]

Seçenekler:
  --players <n>     Piyon sayısı, 2–6                          (varsayılan: ${DEFAULT_CONFIG.players})
  --games <n>       Oyun sayısı, en az 1                       (varsayılan: ${DEFAULT_CONFIG.games})
  --turns <n>       Her oyunda oyuncu başına tur, en az 1      (varsayılan: ${DEFAULT_CONFIG.turnsPerGame})
  --jail-pay <p>    Kodes'te hemen ödeyenlerin oranı, 0–1      (varsayılan: ${DEFAULT_CONFIG.jailPayProbability})
  --seed <n>        32-bit tam sayı tohum                      (varsayılan: rastgele)
  --edition <ad>    Baskı: ${EDITIONS.join(", ")}                            (varsayılan: ${DEFAULT_CONFIG.edition})
  --per-game        Oyun bazında final sayımlarını da JSON'a yaz
  --out <dosya>     JSON çıktı yolu                            (varsayılan: results/<zaman>-<seed>.json)
  --help            Bu yardımı göster
`;

const FLAG_OF: Record<keyof SimulationConfig, string> = {
  edition: "--edition",
  players: "--players",
  games: "--games",
  turnsPerGame: "--turns",
  jailPayProbability: "--jail-pay",
  seed: "--seed",
  trackPerGame: "--per-game",
};

interface CliArgs {
  config: Partial<SimulationConfig>;
  out: string | null;
  help: boolean;
}

function toNumber(flag: string, value: string): number {
  const parsed = value.trim() === "" ? NaN : Number(value);
  if (Number.isNaN(parsed)) throw new Error(`${flag} için sayı bekleniyor (verilen: "${value}").`);
  return parsed;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { config: {}, out: null, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const eq = arg.indexOf("=");
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? null : arg.slice(eq + 1);

    const value = (): string => {
      if (inline !== null) return inline;
      const next = argv[++i];
      if (next === undefined) throw new Error(`${flag} için bir değer gerekli.`);
      return next;
    };
    const noValue = (): void => {
      if (inline !== null) throw new Error(`${flag} değer almaz.`);
    };

    switch (flag) {
      case "--players":
        args.config.players = toNumber(flag, value());
        break;
      case "--games":
        args.config.games = toNumber(flag, value());
        break;
      case "--turns":
        args.config.turnsPerGame = toNumber(flag, value());
        break;
      case "--jail-pay":
        args.config.jailPayProbability = toNumber(flag, value());
        break;
      case "--seed":
        args.config.seed = toNumber(flag, value());
        break;
      case "--edition":
        args.config.edition = value() as Edition;
        break;
      case "--out":
        args.out = value();
        break;
      case "--per-game":
        noValue();
        args.config.trackPerGame = true;
        break;
      case "--help":
      case "-h":
        noValue();
        args.help = true;
        break;
      default:
        throw new Error(`Bilinmeyen seçenek: ${flag} (seçenekler için --help).`);
    }
  }
  return args;
}

function formatCount(value: number): string {
  return value.toLocaleString("tr-TR");
}

function formatPct(value: number): string {
  return value.toFixed(3);
}

function formatTable(header: readonly string[], rows: readonly string[][], leftAligned: readonly number[]): string {
  const widths = header.map((title, col) => Math.max(title.length, ...rows.map((row) => row[col]!.length)));
  const line = (cells: readonly string[]): string =>
    cells
      .map((cell, col) => (leftAligned.includes(col) ? cell.padEnd(widths[col]!) : cell.padStart(widths[col]!)))
      .join("  ")
      .trimEnd();
  return [line(header), widths.map((width) => "-".repeat(width)).join("  "), ...rows.map(line)].join("\n");
}

function formatReport(result: SimulationResult): string {
  const { config, meta, jail } = result;
  const turnsPerSecond = meta.elapsedMs > 0 ? (meta.totalTurns / meta.elapsedMs) * 1000 : null;

  const squareRows = [...result.squares]
    .sort((a, b) => b.finalPct - a.finalPct || a.index - b.index)
    .map((square) => [
      String(square.index),
      square.name,
      square.group ?? "—",
      formatCount(square.landings),
      formatPct(square.landingPct),
      formatCount(square.finalLandings),
      formatPct(square.finalPct),
    ]);

  const groupRows = [...result.groups]
    .sort((a, b) => b.finalPct - a.finalPct)
    .map((group) => [
      group.group,
      String(group.squares.length),
      formatCount(group.landings),
      formatPct(group.landingPct),
      formatCount(group.finalLandings),
      formatPct(group.finalPct),
    ]);

  const speed = turnsPerSecond === null ? "" : ` (${(turnsPerSecond / 1e6).toFixed(1)} milyon tur/sn)`;
  return [
    `Monopoly (${config.edition}) — ${config.players} oyuncu × ${formatCount(config.games)} oyun × ${formatCount(config.turnsPerGame)} tur`,
    `jail-pay=${config.jailPayProbability}  seed=${config.seed}`,
    `Tur: ${formatCount(meta.totalTurns)}  Zar atışı: ${formatCount(meta.totalRolls)}  ` +
      `Geliş: ${formatCount(meta.totalLandings)}  Final: ${formatCount(meta.totalFinalLandings)}  ` +
      `Süre: ${formatCount(meta.elapsedMs)} ms${speed}`,
    "",
    formatTable(["#", "Kare", "Grup", "Geliş", "%", "Final", "%"], squareRows, [1, 2]),
    "",
    "Kodes (içeride)",
    `  Giriş: ${formatCount(jail.entries)}  (gelişlerin %${formatPct(jail.entryPct)}, finallerin %${formatPct(jail.finalPct)})`,
    `  Nedenler: Kodes'e Gir karesi ${formatCount(jail.byReason.square)}, Şans kartı ${formatCount(jail.byReason.chance_card)}, ` +
      `Kamu Fonu kartı ${formatCount(jail.byReason.chest_card)}, üç çift ${formatCount(jail.byReason.three_doubles)}`,
    `  Kodes'te geçen tur: ${formatCount(jail.turnsInJail)}  (turların %${formatPct(jail.turnsInJailPctOfTurns)})`,
    `  Çekilen kart: Şans ${formatCount(result.cards.chanceDraws)}, Kamu Fonu ${formatCount(result.cards.chestDraws)}`,
    "",
    "Grup toplamları",
    formatTable(["Grup", "Kare", "Geliş", "%", "Final", "%"], groupRows, [0]),
  ].join("\n");
}

function defaultOutPath(result: SimulationResult): string {
  const stamp = result.meta.generatedAt.replace(/\.\d+Z$/, "").replace(/:/g, "-");
  return `results/${stamp}-${result.config.seed}.json`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  // Validate before running so that a typo does not cost a full simulation.
  const config = resolveConfig(args.config);
  const result = runSimulation(config);

  const outPath = resolve(args.out ?? defaultOutPath(result));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);

  console.log(formatReport(result));
  console.log(`\nJSON: ${outPath}`);
}

try {
  main();
} catch (error) {
  const where = error instanceof ConfigError ? ` (${FLAG_OF[error.field]})` : "";
  console.error(`Hata${where}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
