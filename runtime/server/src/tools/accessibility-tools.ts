import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError } from "../utils/errors.js";

// --- Private helper functions ---

function parseColor(input: string): { r: number; g: number; b: number } {
  const trimmed = input.trim();

  // Hex format: #RRGGBB or RRGGBB
  const hexMatch = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  }

  // RGB format: r,g,b
  const rgbMatch = trimmed.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    if (r > 255 || g > 255 || b > 255) {
      throw new Error(`RGB values must be 0-255, got: ${r},${g},${b}`);
    }
    return { r, g, b };
  }

  throw new Error(
    `Invalid color format: "${input}". Use hex (#RRGGBB) or RGB (r,g,b).`
  );
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function linearize(srgbComponent: number): number {
  // srgbComponent is 0-255, normalize to 0-1
  const s = srgbComponent / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number }
): number {
  const l1 = relativeLuminance(fg.r, fg.g, fg.b);
  const l2 = relativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function simulateColorBlindnessTransform(
  color: { r: number; g: number; b: number },
  type: string
): { r: number; g: number; b: number } {
  const { r, g, b } = color;

  // Simulation matrices (approximate LMS-space transformations)
  // These are widely-used Brettel/Vienot-derived approximations
  let matrix: number[][];

  switch (type.toLowerCase()) {
    case "protanopia":
      // No red cones
      matrix = [
        [0.56667, 0.43333, 0.0],
        [0.55833, 0.44167, 0.0],
        [0.0, 0.24167, 0.75833],
      ];
      break;
    case "deuteranopia":
      // No green cones
      matrix = [
        [0.625, 0.375, 0.0],
        [0.7, 0.3, 0.0],
        [0.0, 0.3, 0.7],
      ];
      break;
    case "tritanopia":
      // No blue cones
      matrix = [
        [0.95, 0.05, 0.0],
        [0.0, 0.43333, 0.56667],
        [0.0, 0.475, 0.525],
      ];
      break;
    case "achromatopsia":
      // Total color blindness — standard luminance grayscale
      matrix = [
        [0.2126, 0.7152, 0.0722],
        [0.2126, 0.7152, 0.0722],
        [0.2126, 0.7152, 0.0722],
      ];
      break;
    default:
      throw new Error(
        `Unknown color blindness type: "${type}". Use: protanopia, deuteranopia, tritanopia, achromatopsia.`
      );
  }

  const newR = Math.round(
    Math.max(0, Math.min(255, matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b))
  );
  const newG = Math.round(
    Math.max(0, Math.min(255, matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b))
  );
  const newB = Math.round(
    Math.max(0, Math.min(255, matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b))
  );

  return { r: newR, g: newG, b: newB };
}

function colorDifference(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): number {
  // Euclidean distance in RGB space, normalized to 0-100
  const dist = Math.sqrt(
    Math.pow(a.r - b.r, 2) + Math.pow(a.g - b.g, 2) + Math.pow(a.b - b.b, 2)
  );
  // Max possible distance is sqrt(255^2 * 3) ≈ 441.67
  return Math.round((dist / 441.67) * 10000) / 100;
}

// --- Tool registration ---

export function registerAccessibilityTools(server: McpServer): void {
  // Tool 1: check_contrast_ratio
  server.tool(
    "check_contrast_ratio",
    "Calculate WCAG contrast ratio between two colors",
    {
      foreground: z.string().describe("Hex color e.g. #FFFFFF or RGB like 255,255,255"),
      background: z.string().describe("Hex color or RGB"),
    },
    async ({ foreground, background }) => {
      try {
        const fg = parseColor(foreground);
        const bg = parseColor(background);
        const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  ratio,
                  foreground: rgbToHex(fg.r, fg.g, fg.b),
                  background: rgbToHex(bg.r, bg.g, bg.b),
                  wcag_aa_normal: ratio >= 4.5,
                  wcag_aa_large: ratio >= 3,
                  wcag_aaa_normal: ratio >= 7,
                  wcag_aaa_large: ratio >= 4.5,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  // Tool 2: get_text_readability
  server.tool(
    "get_text_readability",
    "Check text readability based on contrast and font size (WCAG AA/AAA)",
    {
      foreground: z.string().describe("Hex color e.g. #FFFFFF or RGB like 255,255,255"),
      background: z.string().describe("Hex color or RGB"),
      font_size: z.number().describe("Font size in pixels"),
      bold: z.boolean().optional().describe("Whether the text is bold"),
    },
    async ({ foreground, background, font_size, bold }) => {
      try {
        const fg = parseColor(foreground);
        const bg = parseColor(background);
        const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;
        const isBold = bold === true;

        // WCAG large text: >= 24px, or >= 18.66px if bold
        const isLargeText = font_size >= 24 || (isBold && font_size >= 18.66);

        // AA: 4.5:1 for normal, 3:1 for large
        const passesAA = isLargeText ? ratio >= 3 : ratio >= 4.5;
        // AAA: 7:1 for normal, 4.5:1 for large
        const passesAAA = isLargeText ? ratio >= 4.5 : ratio >= 7;

        let recommendation: string;
        if (passesAAA) {
          recommendation =
            "Excellent readability. Meets WCAG AAA standards.";
        } else if (passesAA) {
          recommendation =
            "Good readability. Meets WCAG AA but not AAA. Consider increasing contrast for enhanced accessibility.";
        } else {
          const needed = isLargeText ? 3 : 4.5;
          recommendation =
            `Insufficient contrast (${ratio}:1). Minimum required for WCAG AA${isLargeText ? " (large text)" : ""} is ${needed}:1. ` +
            "Increase the contrast between foreground and background colors.";
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  ratio,
                  is_large_text: isLargeText,
                  wcag_aa: passesAA,
                  wcag_aaa: passesAAA,
                  recommendation,
                  font_size,
                  bold: isBold,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  // Tool 3: simulate_color_blindness
  server.tool(
    "simulate_color_blindness",
    "Simulate how a color appears under different types of color blindness",
    {
      color: z.string().describe("Hex color e.g. #FF5733 or RGB like 255,87,51"),
      type: z
        .string()
        .describe("protanopia, deuteranopia, tritanopia, achromatopsia"),
    },
    async ({ color, type }) => {
      try {
        const original = parseColor(color);
        const simulated = simulateColorBlindnessTransform(original, type);
        const difference = colorDifference(original, simulated);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  original: {
                    r: original.r,
                    g: original.g,
                    b: original.b,
                    hex: rgbToHex(original.r, original.g, original.b),
                  },
                  simulated: {
                    r: simulated.r,
                    g: simulated.g,
                    b: simulated.b,
                    hex: rgbToHex(simulated.r, simulated.g, simulated.b),
                  },
                  type: type.toLowerCase(),
                  difference: `${difference}%`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );
}
