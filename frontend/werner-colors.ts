/**
 * Colours of the board: Werner's Nomenclature of Colours (Patrick Syme,
 * 1814/1821, public domain). Colour values from the digital edition by
 * Nicholas Rougeux (c82.net/werner), as listed in Graphics::ColorNames::Werner.
 * Five shades (light to dark) per colour family, as Excalidraw's palette
 * expects; inserted into Excalidraw when building (vite.config.ts).
 */
export const WERNER_PALETTE: Record<string, readonly [string, string, string, string, string]> = {
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
};

/** quick picks for lines and text: Velvet Black, Scarlet Red, Prussian Blue, Grass Green, Dutch Orange */
export const WERNER_STROKE_PICKS = ["#241f20", "#b63e36", "#1c1949", "#7d8c55", "#dfa837"] as const;
/** quick picks for backgrounds: transparent, Peach Blossom Red, Asparagus Green, Bluish Lilac Purple, Primrose Yellow */
export const WERNER_BACKGROUND_PICKS = ["transparent", "#eecfbf", "#c2c190", "#d0d5d3", "#ebdd99"] as const;
