export const HEIGHT_OPTIONS = ["S", "M", "L", "XL"] as const;

export type HeightOption = (typeof HEIGHT_OPTIONS)[number];
