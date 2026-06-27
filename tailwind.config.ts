import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";
import tailwindAnimate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/mobile-h5/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Noto Sans SC", ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        "4xl": "2rem",
        // Mobile H5 tokens generate rounded-card, rounded-button, rounded-pill.
        card: "20px",
        button: "12px",
        pill: "999px",
      },
      colors: {
        sage: {
          50: "#F0FAF5",
          100: "#DCF2E7",
          200: "#B8E5D0",
          300: "#8AD3B2",
          400: "#5DB08C",
          500: "#489A76",
          600: "#3A7D60",
          700: "#2F644E",
          800: "#264F3F",
          900: "#1F4134",
        },
        sky: {
          50: "#F0F7FC",
          100: "#DDEEF9",
          200: "#B8DDF2",
          300: "#7BBCE0",
          400: "#52A3CF",
          500: "#3A8BBA",
          600: "#2D6F96",
          700: "#255878",
          800: "#1F4761",
          900: "#1A3A50",
        },
        warm: {
          50: "#FFF8F0",
          100: "#FFEEDD",
          200: "#FDDCBA",
          300: "#F5C88A",
          400: "#F2994A",
          500: "#E8823A",
          600: "#CC6A2A",
          700: "#A85522",
          800: "#88451E",
          900: "#6F3A1B",
        },
        cream: {
          50: "#FAFDF9",
          100: "#F5FAF8",
          200: "#EDF5F1",
          300: "#E0EDE7",
          400: "#D0E2D9",
        },
        success: "#38A169",
        warning: "#DD9A20",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      height: {
        touch: "44px",
        button: "48px",
      },
      width: {
        touch: "44px",
      },
      minHeight: {
        touch: "44px",
        button: "48px",
        option: "52px",
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom, 0px)",
        "safe-top": "env(safe-area-inset-top, 0px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        slideInRight: {
          from: { transform: "translateX(30px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        slideInUp: {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        progressGrow: {
          from: { width: "0%" },
          to: { width: "var(--progress-width)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out forwards",
        "slide-in-up": "slideInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "fade-in": "fadeIn 0.2s ease-out forwards",
        progress: "progressGrow 0.6s ease-out forwards",
      },
    },
  },
  plugins: [tailwindAnimate],
};

export default config;
