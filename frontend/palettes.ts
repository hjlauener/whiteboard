/**
 * The colour palettes of the board, chosen per board in the settings
 * ("Farbpalette"): four always, six more if switched on in the plugin
 * configuration. Each palette: ten colour families with five shades (light
 * to dark, as Excalidraw's colour picker expects), five quick picks for lines
 * and text and five for backgrounds (the first is "transparent").
 *
 * Inserted into Excalidraw when building (boardDefaults() in vite.config.ts);
 * the board picks the palette of data-config.palette when it starts. The
 * build also writes js/dist/palettes.json, from which the settings form shows
 * the colours.
 *
 * The keys of the families are translated in locales/*.json ("colors").
 */
type Shades = readonly [string, string, string, string, string];
type Picks = readonly [string, string, string, string, string];

export interface Palette {
  families: Readonly<Record<string, Shades>>;
  stroke: Picks;
  background: Picks;
}

export const DEFAULT_PALETTE = "natural";

/** always offered in the settings of a board */
export const BASE_PALETTES = ["natural", "modern", "warm", "playful"] as const;
/** offered only if switched on in the plugin configuration (Administration) */
export const EXTRA_PALETTES = ["pastel", "colorblind", "ocean", "forest", "retro", "print"] as const;

function mix(hex: string, target: number, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => Math.round(c + (target - c) * amount);
  const [r, g, b] = [channel((n >> 16) & 255), channel((n >> 8) & 255), channel(n & 255)];
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** five shades around a base colour: two lighter, the colour, two darker */
function tones(base: string): Shades {
  return [mix(base, 255, 0.75), mix(base, 255, 0.45), base.toLowerCase(), mix(base, 0, 0.25), mix(base, 0, 0.5)];
}

/** a light background colour from a base colour */
const tint = (base: string, amount = 0.75) => mix(base, 255, amount);

export const PALETTES: Readonly<Record<string, Palette>> = {
  /**
   * Ruhig und natürlich: Werner's Nomenclature of Colours (Patrick Syme,
   * 1814/1821, public domain). Colour values from the digital edition by
   * Nicholas Rougeux (c82.net/werner), as listed in Graphics::ColorNames::Werner.
   */
  natural: {
    families: {
      // 17 Greyish Black, 18 Bluish Black, 20 Pitch or Brownish Black, 21 Reddish Black, 23 Velvet Black
      blacks: ["#555152", "#413f44", "#423937", "#433635", "#241f20"],
      // 9 Ash Grey, 10 Smoke Grey, 13 Yellowish Grey, 14 Bluish Grey, 16 Blackish Grey
      greys: ["#cbc8b7", "#bfbbb0", "#bab191", "#9c9d9a", "#5b5c61"],
      // 2 Reddish White, 1 Snow White, 5 Orange White, 3 Purplish White, 8 Greyish White
      whites: ["#f2e7cf", "#f1e9cd", "#f3e9ca", "#ece6d0", "#e2ddc6"],
      // 89 Rose Red, 86 Aurora Red, 97 Brownish Purple Red, 99 Brownish Red, 96 Veinous Blood Red
      reds: ["#eedac3", "#cd6d57", "#8d746f", "#6e3b31", "#3f3033"],
      // 77 Buff Orange, 76 Dutch Orange, 78 Orpiment Orange, 81 Deep Reddish Orange, 79 Brownish Orange
      oranges: ["#ebbc71", "#dfa837", "#d17c3f", "#bb603c", "#92462f"],
      // 75 Cream Yellow, 73 Sienna Yellow, 67 Kings Yellow, 68 Saffron Yellow, 69 Gallstone Yellow
      yellows: ["#f3daa7", "#f1d28c", "#ead665", "#d09b2c", "#a36629"],
      // 51 Bluish Green, 61 Siskin Green, 50 Verdigris Green, 57 Pistachio Green, 55 Duck Green
      greens: ["#a4b6a7", "#c8c76f", "#61ac86", "#8e9849", "#33431e"],
      // 34 Greyish Blue, 32 Verditter Blue, 33 Greenish Blue, 27 China Blue, 24 Scotch Blue
      blues: ["#8aa1a6", "#6fb5a8", "#719ba2", "#383867", "#281f3f"],
      // 35 Bluish Lilac Purple, 36 Bluish Purple, 40 Imperial Purple, 41 Auricula Purple, 38 Pansy Purple
      purples: ["#d0d5d3", "#8590ae", "#584c77", "#533552", "#39334a"],
      // 105 Wood Brown, 107 Hair Brown, 100 Deep Orange-coloured Brown, 101 Deep Reddish Brown, 110 Blackish Brown
      browns: ["#c39e6d", "#8b7859", "#864735", "#553d3a", "#453b32"],
    },
    // Velvet Black, Scarlet Red, Prussian Blue, Grass Green, Dutch Orange
    stroke: ["#241f20", "#b63e36", "#1c1949", "#7d8c55", "#dfa837"],
    // transparent, Peach Blossom Red, Asparagus Green, Bluish Lilac Purple, Primrose Yellow
    background: ["transparent", "#eecfbf", "#c2c190", "#d0d5d3", "#ebdd99"],
  },

  /** Modern und klar: clean, evenly graded colours (slate ink, clear blue). */
  modern: {
    families: {
      blacks: ["#64748b", "#475569", "#334155", "#1e293b", "#0f172a"],
      greys: ["#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b"],
      whites: ["#ffffff", "#fafafa", "#f8fafc", "#f5f5f4", "#f4f4f5"],
      reds: ["#fee2e2", "#fca5a5", "#ef4444", "#dc2626", "#991b1b"],
      oranges: ["#ffedd5", "#fdba74", "#f97316", "#ea580c", "#9a3412"],
      yellows: ["#fef9c3", "#fde047", "#eab308", "#ca8a04", "#854d0e"],
      greens: ["#dcfce7", "#86efac", "#22c55e", "#16a34a", "#166534"],
      blues: ["#eff6ff", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e3a8a"],
      purples: ["#ede9fe", "#c4b5fd", "#8b5cf6", "#6d28d9", "#4c1d95"],
      browns: ["#efe5dc", "#d4b9a0", "#a67c52", "#7c5532", "#4a3220"],
    },
    stroke: ["#0f172a", "#dc2626", "#1d4ed8", "#16a34a", "#ea580c"],
    background: ["transparent", "#eff6ff", "#dcfce7", "#fef9c3", "#fee2e2"],
  },

  /** Warm und freundlich: peach, apricot, terracotta, warm dark brown as ink. */
  warm: {
    families: {
      blacks: ["#6b5a52", "#5a4a42", "#4a3b34", "#3a2e28", "#2b211c"],
      greys: ["#efe8e2", "#ddd2c8", "#c4b5a8", "#a39283", "#7d6d60"],
      whites: ["#fffaf3", "#fff5e8", "#fff1e0", "#fdf0e6", "#faebdd"],
      reds: ["#fde2dc", "#f4a596", "#e06c5a", "#c0503f", "#a84e42"],
      oranges: ["#fff1df", "#ffca8a", "#f39065", "#e0703d", "#b5532a"],
      yellows: ["#fff6d6", "#ffe29a", "#f7c75a", "#e0a93a", "#b58224"],
      greens: ["#eef3dc", "#cfdca4", "#a7bb6b", "#7e9446", "#56692c"],
      blues: ["#e6f0f2", "#b3d2d8", "#7aa9b3", "#4f7f8c", "#335a66"],
      purples: ["#f6e4ec", "#e3b3c8", "#c47a9b", "#9c5677", "#6e3a55"],
      browns: ["#f1e2d3", "#d9b796", "#b48660", "#8a5f3e", "#5e3f28"],
    },
    stroke: ["#3a2e28", "#c0503f", "#335a66", "#7e9446", "#e0703d"],
    background: ["transparent", "#fff1df", "#fde2dc", "#fff6d6", "#eef3dc"],
  },

  /** Spielerisch und frisch: comic style, saturated colours and black ink. */
  playful: {
    families: {
      blacks: ["#4d4d4d", "#333333", "#222222", "#141414", "#000000"],
      greys: ["#f0f0f0", "#d9d9d9", "#b3b3b3", "#8c8c8c", "#595959"],
      whites: ["#ffffff", "#fffdf5", "#fffbea", "#f8f9ff", "#fff8fb"],
      reds: ["#ffd6d6", "#ff8a8a", "#ff3b3b", "#e60000", "#a30000"],
      pinks: ["#ffe0f0", "#ff9ccf", "#ff4fa3", "#e6007e", "#a3005a"],
      oranges: ["#ffe3c2", "#ffb35c", "#ff8c00", "#f26b00", "#b84a00"],
      yellows: ["#fff7b3", "#ffeb3b", "#ffd600", "#ffc400", "#e6a800"],
      greens: ["#d4fcd4", "#7cf07c", "#2ee52e", "#00c21a", "#008a12"],
      blues: ["#d1ecff", "#6ec6ff", "#1ea0ff", "#0066ff", "#0033cc"],
      purples: ["#f4e6ff", "#c9a8ff", "#a78bfa", "#8a2be2", "#6d28d9"],
    },
    stroke: ["#000000", "#ff3b3b", "#0066ff", "#00c21a", "#ff8c00"],
    background: ["transparent", "#fff7b3", "#d1ecff", "#ffd6d6", "#d4fcd4"],
  },

  /** Pastell und sanft: soft, light colours; muted ink. */
  pastel: {
    families: {
      blacks: tones("#4a4458"),
      greys: tones("#a9a6b5"),
      whites: ["#ffffff", "#fdfcff", "#fbf8ff", "#f8fbff", "#fffaf7"],
      reds: tones("#f4a6a6"),
      pinks: tones("#f6b8d1"),
      oranges: tones("#f8c99b"),
      yellows: tones("#f9e79f"),
      greens: tones("#b5e2b8"),
      blues: tones("#a9cdf2"),
      purples: tones("#cdb4f0"),
    },
    stroke: ["#4a4458", "#d9777a", "#6b9bd1", "#6fb579", "#d99a5b"],
    background: ["transparent", "#fde2e4", "#e2f0cb", "#dbeafe", "#fff1c1"],
  },

  /**
   * Für Farbsehschwäche geeignet: the eight colours of Okabe and Ito ("Color
   * Universal Design", 2002), distinguishable with the common forms of
   * colour blindness.
   */
  colorblind: {
    families: {
      blacks: tones("#000000"),
      greys: tones("#8c8c8c"),
      whites: ["#ffffff", "#fafafa", "#f5f5f5", "#f8f9fb", "#fbfaf7"],
      reds: tones("#d55e00"),
      oranges: tones("#e69f00"),
      yellows: tones("#f0e442"),
      teals: tones("#009e73"),
      cyans: tones("#56b4e9"),
      blues: tones("#0072b2"),
      pinks: tones("#cc79a7"),
    },
    stroke: ["#000000", "#d55e00", "#0072b2", "#009e73", "#e69f00"],
    background: ["transparent", tint("#56b4e9"), tint("#f0e442", 0.6), tint("#cc79a7"), tint("#009e73")],
  },

  /** Meer und Himmel: blues, turquoise, sand and coral. */
  ocean: {
    families: {
      blacks: tones("#1b2a3a"),
      greys: tones("#8a9bab"),
      whites: ["#ffffff", "#f7fbff", "#f2f8fc", "#f5fbfa", "#fbf9f3"],
      blues: tones("#1f6fb2"),
      cyans: tones("#4fb3e8"),
      teals: tones("#138d90"),
      greens: tones("#4caf8e"),
      yellows: tones("#e8c872"),
      oranges: tones("#f08a5d"),
      purples: tones("#6c63c7"),
    },
    stroke: ["#1b2a3a", "#1f6fb2", "#138d90", "#f08a5d", "#6c63c7"],
    background: ["transparent", tint("#4fb3e8"), tint("#138d90"), tint("#e8c872", 0.6), tint("#f08a5d")],
  },

  /** Wald und Erde: greens, moss, ochre, rust and bark. */
  forest: {
    families: {
      blacks: tones("#2a2a22"),
      greys: tones("#8f8a7a"),
      whites: ["#fffdf7", "#fbf8ef", "#f7f4ea", "#f6f7ef", "#faf6ee"],
      greens: tones("#3f7d3a"),
      teals: tones("#2f6f62"),
      yellows: tones("#c9a227"),
      oranges: tones("#b5651d"),
      reds: tones("#9b2d30"),
      browns: tones("#7a5230"),
      blues: tones("#4a6378"),
      purples: tones("#7b5e7b"),
    },
    stroke: ["#2a2a22", "#3f7d3a", "#7a5230", "#b5651d", "#4a6378"],
    background: ["transparent", tint("#3f7d3a"), tint("#c9a227", 0.65), tint("#7a5230"), tint("#4a6378")],
  },

  /** Retro (Siebzigerjahre): mustard, orange, avocado, brick and plum. */
  retro: {
    families: {
      blacks: tones("#3b2f2f"),
      greys: tones("#a39a8c"),
      whites: ["#fffaf0", "#fdf6e3", "#faf0dc", "#f8f1e5", "#f5ecd9"],
      reds: tones("#b5442b"),
      oranges: tones("#e07a1f"),
      yellows: tones("#e1ad01"),
      greens: tones("#6b8e23"),
      teals: tones("#2a9d8f"),
      purples: tones("#7d3c6b"),
      browns: tones("#8b5a2b"),
    },
    stroke: ["#3b2f2f", "#b5442b", "#e07a1f", "#2a9d8f", "#6b8e23"],
    background: ["transparent", tint("#e1ad01", 0.65), tint("#e07a1f"), tint("#6b8e23"), tint("#2a9d8f")],
  },

  /** Druckfreundlich: black and greys with a few clear accents (prints well in black and white). */
  print: {
    families: {
      blacks: tones("#000000"),
      greys: ["#f2f2f2", "#d9d9d9", "#a6a6a6", "#737373", "#404040"],
      whites: ["#ffffff", "#fcfcfc", "#f9f9f9", "#f7f7f7", "#f4f4f4"],
      reds: tones("#c00000"),
      blues: tones("#1f4e9c"),
      greens: tones("#2e7d32"),
    },
    stroke: ["#000000", "#404040", "#808080", "#c00000", "#1f4e9c"],
    background: ["transparent", "#f2f2f2", "#d9d9d9", "#fde0e0", "#e1e9f7"],
  },
};
