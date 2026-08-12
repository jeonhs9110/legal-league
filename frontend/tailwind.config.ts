import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Poppins drives display + body; Source Serif 4 is the italic accent only.
        display: ["var(--font-poppins)", "system-ui", "sans-serif"],
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        serif: ["var(--font-source-serif)", "Georgia", "serif"],
      },
      colors: {
        // --- Dark layer: the landing page. Strict grayscale, 0 saturation. ---
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",

        // --- Editorial layer: rankings, profiles, news, methodology. ---
        // Warm paper rather than pure white; #FFF reads as software, ivory
        // reads as print, which is the signal the category rewards.
        paper: {
          DEFAULT: "#FBFAF7",
          raised: "#FFFFFF",
          sunken: "#F4F2EA",
        },
        ink: {
          DEFAULT: "#14161A",
          muted: "#585E68",
          faint: "#8B9099",
        },
        rule: {
          DEFAULT: "#E4E0D6",
          strong: "#CBC6B8",
        },
        // One accent, used sparingly: rank markers, active nav, link underline.
        oxblood: {
          DEFAULT: "#7A2230",
          dark: "#5A1722",
          wash: "#F5EAEA",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
