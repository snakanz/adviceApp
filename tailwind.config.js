/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"]
      },
      colors: {
        // Deep Dark Mode Palette
        background: "#0A0B10",        // Deep Obsidian
        card: "#181923",              // Frosted Black
        border: "#292A34",            // Dark border
        muted: "#181923",
        'muted-foreground': "#8F90A6", // Muted Gray

        primary: {
          DEFAULT: "#337AFF",         // Vibrant Blue
          dark: "#1e40af",
          foreground: "#E0E0E0",      // Soft White
        },
        secondary: {
          DEFAULT: "#181923",
          foreground: "#E0E0E0",
        },
        accent: {
          DEFAULT: "#00C49F",         // Modern Emerald
          foreground: "#E0E0E0",
        },
        brand: {
          emerald: "#00C49F",
          blue: "#337AFF",
          green: "#00C49F",           // Keep for compatibility
          navy: "#0A0B10",
        },
        foreground: "#E0E0E0",        // Soft White
        'card-foreground': "#E0E0E0",
        ring: "#337AFF",              // Vibrant Blue
      },
      borderRadius: {
        xl: "20px"
      },
      boxShadow: {
        'card': '0 4px 24px rgba(0, 0, 0, 0.3)',
        'soft': '0 2px 8px rgba(0, 0, 0, 0.2)',
        'medium': '0 4px 12px rgba(0, 0, 0, 0.25)',
        'large': '0 8px 32px rgba(0, 0, 0, 0.35)',
        'glow-emerald': '0 0 20px rgba(0, 196, 159, 0.25)',
        'glow-blue': '0 0 20px rgba(51, 122, 255, 0.25)',
      },
      backdropBlur: {
        'glass': '10px',
      }
    }
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.glass': {
          'backdrop-filter': 'blur(10px)',
          '-webkit-backdrop-filter': 'blur(10px)',
        },
        '.glass-card': {
          'background': 'rgba(24, 25, 35, 0.75)',
          'backdrop-filter': 'blur(10px)',
          '-webkit-backdrop-filter': 'blur(10px)',
          'border': '1px solid rgba(41, 42, 52, 0.5)',
        },
      });
    },
  ]
}

