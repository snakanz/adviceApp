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
        primary: {
          DEFAULT: "#3B82F6", // Light blue accent like Concentro
          dark: "#1e3a8a"
        },
        brand: {
          green: "#4ade80",
          navy: "#1e293b",
        }
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

