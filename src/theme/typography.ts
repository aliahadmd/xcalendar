import { TextStyle } from "react-native";

const FONT_REGULAR = "Inter_400Regular";
const FONT_MEDIUM = "Inter_500Medium";
const FONT_SEMI = "Inter_600SemiBold";
const FONT_BOLD = "Inter_700Bold";

export type TypeVariant =
  | "largeTitle"
  | "title"
  | "title2"
  | "headline"
  | "body"
  | "callout"
  | "subheadline"
  | "footnote"
  | "caption"
  | "caption2";

export const type: Record<TypeVariant, TextStyle> = {
  largeTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: FONT_BOLD,
    letterSpacing: -0.6,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: FONT_BOLD,
    letterSpacing: -0.4,
  },
  title2: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: FONT_SEMI,
    letterSpacing: -0.3,
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: FONT_SEMI,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 17,
    lineHeight: 23,
    fontFamily: FONT_REGULAR,
    letterSpacing: -0.2,
  },
  callout: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONT_REGULAR,
    letterSpacing: -0.1,
  },
  subheadline: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: FONT_REGULAR,
    letterSpacing: -0.1,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: FONT_REGULAR,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT_MEDIUM,
  },
  caption2: {
    fontSize: 10.5,
    lineHeight: 14,
    fontFamily: FONT_SEMI,
    letterSpacing: 0.2,
  },
};

export const fontFamilies = {
  regular: FONT_REGULAR,
  medium: FONT_MEDIUM,
  semibold: FONT_SEMI,
  bold: FONT_BOLD,
};
