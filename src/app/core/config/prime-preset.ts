import Aura from '@primeuix/themes/aura';

const brandPrimary = {
  color: 'var(--color-primary)',
  contrastColor: 'var(--color-primary-content)',
  hoverColor: 'var(--color-primary-hover)',
  activeColor: 'var(--color-primary-active)',
};

/**
 * PrimeNG's Aura theme in the school's colours.
 *
 * Stock Aura is emerald green, so every PrimeNG button, focus ring, selected
 * option and checkbox was green beside a navy brand. Buttons and their hover
 * and pressed states read the brand tokens from src/styles.css, so they follow
 * light and dark mode and any rebrand there without a change here.
 *
 * The 50-950 scale is what PrimeNG derives tints from (focus rings, selected
 * rows, highlighted options). It is a blue scale running through the brand's
 * own values -- 500 is --color-secondary, 600 its hover, 700 the primary hover,
 * 800 the primary -- and is theme configuration, like styles.css, rather than a
 * colour hard-coded in a component.
 *
 * Built with plain spreads rather than definePreset(), whose merge helpers
 * added 2.5 kB to the first download for what is three nested overrides.
 */
export const LmsPreset = {
  ...Aura,
  semantic: {
    ...Aura.semantic,
    primary: {
      50: '#eef3fb',
      100: '#d9e3f5',
      200: '#b6c9ea',
      300: '#8ba8db',
      400: '#5f85c8',
      500: '#3e6db5',
      600: '#2d5594',
      700: '#254479',
      800: '#1a2b4c',
      900: '#142139',
      950: '#0c1424',
    },
    colorScheme: {
      ...Aura.semantic?.colorScheme,
      light: { ...Aura.semantic?.colorScheme?.light, primary: brandPrimary },
      dark: { ...Aura.semantic?.colorScheme?.dark, primary: brandPrimary },
    },
  },
};
