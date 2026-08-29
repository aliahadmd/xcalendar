export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 22,
  full: 9999,
} as const;

export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
  spring: {
    damping: 22,
    stiffness: 320,
    mass: 0.9,
  },
  springSoft: {
    damping: 28,
    stiffness: 260,
    mass: 1,
  },
} as const;
