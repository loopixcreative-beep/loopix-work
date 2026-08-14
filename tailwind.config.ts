import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Darker Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Darker Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ["0.9rem", { lineHeight: "1.15rem", fontWeight: "600" }],
        sm: ["1rem", { lineHeight: "1.35rem", fontWeight: "500" }],
        base: ["1.125rem", { lineHeight: "1.6rem", fontWeight: "500" }],
        lg: ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        xl: ["1.4rem", { lineHeight: "1.85rem", fontWeight: "600" }],
        "2xl": ["1.7rem", { lineHeight: "2.1rem", fontWeight: "700" }],
        "3xl": ["2.05rem", { lineHeight: "2.4rem", fontWeight: "700" }],
        "4xl": ["2.5rem", { lineHeight: "2.8rem", fontWeight: "700" }],
        "5xl": ["3.1rem", { lineHeight: "3.3rem", fontWeight: "800" }],
      },

      colors: {
        brand: {
          orange: "hsl(var(--brand-orange))",
          "orange-light": "hsl(var(--brand-orange-light))",
          "orange-foreground": "hsl(var(--brand-orange-foreground))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
        },

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
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        kaam: {
          blue: "hsl(var(--kaam-blue))",
          "blue-light": "hsl(var(--kaam-blue-light))",
          slate: "hsl(var(--kaam-slate))",
          "slate-light": "hsl(var(--kaam-slate-light))",
        },
        priority: {
          highest: "hsl(var(--priority-highest))",
          high: "hsl(var(--priority-high))",
          medium: "hsl(var(--priority-medium))",
          low: "hsl(var(--priority-low))",
          lowest: "hsl(var(--priority-lowest))",
        },
        status: {
          todo: "hsl(var(--status-todo))",
          progress: "hsl(var(--status-progress))",
          review: "hsl(var(--status-review))",
          done: "hsl(var(--status-done))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "orb-float": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(-18px,14px,0) scale(1.12)" },
        },
        "orb-float-slow": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1.05)" },
          "50%": { transform: "translate3d(22px,-16px,0) scale(0.92)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out both",
        "gradient-pan": "gradient-pan 12s ease-in-out infinite",
        "orb-float": "orb-float 14s ease-in-out infinite",
        "orb-float-slow": "orb-float-slow 18s ease-in-out infinite",
      },

    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
