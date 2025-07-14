/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"]
      },
      colors: {
        background: "#f8f9fb", // Light gray background
        card: "#ffffff",
        border: "#e5e7eb",
        muted: "#9ca3af",
        'muted-foreground': "#6b7280", // slightly darker muted for text
        primary: {
          DEFAULT: "#3B82F6", // Light blue accent like Concentro
          dark: "#1e3a8a",
          foreground: "#fff", // For text-primary-foreground
        },
        secondary: {
          DEFAULT: "#f3f4f6",
          foreground: "#1e293b", // For text-secondary-foreground
        },
        accent: {
          DEFAULT: "#e5e7eb",
          foreground: "#1e293b", // For text-accent-foreground
        },
        brand: {
          green: "#4ade80",
          navy: "#1e293b",
        },
        foreground: "#1e293b", // Navy for text-foreground
        'card-foreground': "#1e293b", // Navy for card text
        ring: "#3B82F6", // Blue for ring-ring utility
      },
      borderRadius: {
        xl: "20px"
      },
      boxShadow: {
        card: "0 4px 24px rgba(0, 0, 0, 0.05)"
      }
    }
  },
  plugins: []
}

