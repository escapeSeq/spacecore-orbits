/** High-contrast signal colours for beams, orbits, and coverage on light sky */
export const LIGHT_SIGNAL_PALETTE = [
  '#E11D48', // vivid red
  '#1D4ED8', // strong blue
  '#EA580C', // vivid orange
  '#7C3AED', // deep violet
  '#059669', // emerald
  '#DB2777', // magenta
  '#0284C7', // cyan
  '#CA8A04', // gold
];

export const COLOR_SCHEMES = {
  dark: {
    id: 'dark',
    label: 'Dark',
    canvas: '#000000',
    showStars: true,
    starsSaturation: 0,
    starsLightness: 0.9,
    signalPalette: null,
    highContrastSignals: false,
    ambientLight: 0.1,
    directionalLight: 2,
    pointLight: 0.5,
    gridColor: '#00ff00',
    gridOpacity: 0.25,
    orbitOpacity: 0.6,
    beamOpacity: 0.15,
    coverageRingOpacity: 0.8,
    loadingWireframe: '#00ff00',
    loadingTorus: '#ffffff',
    earthBrightness: 1,
    earthSilhouetteColor: '#000000',
    pickSatelliteColor: () => `hsl(${Math.random() * 360}, 70%, 50%)`,
  },
  light: {
    id: 'light',
    label: 'Light',
    canvas: '#FAFAFA',
    showStars: true,
    starsSaturation: 0,
    starsLightness: 0.08,
    signalPalette: LIGHT_SIGNAL_PALETTE,
    highContrastSignals: true,
    ambientLight: 0.72,
    directionalLight: 1.25,
    pointLight: 0.3,
    gridColor: '#1D4ED8',
    gridOpacity: 0.5,
    orbitOpacity: 0.95,
    beamOpacity: 0.62,
    coverageRingOpacity: 1,
    loadingWireframe: '#1D4ED8',
    loadingTorus: '#7C3AED',
    earthBrightness: 1.38,
    earthSilhouetteColor: '#E2E8F0',
    pickSatelliteColor: (index = 0) =>
      LIGHT_SIGNAL_PALETTE[index % LIGHT_SIGNAL_PALETTE.length],
  },
};

export const DEFAULT_COLOR_SCHEME = 'dark';
