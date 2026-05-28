/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "pulse-dots": {
          "0%, 80%, 100%": { transform: "scale(0)", opacity: "0.4" },
          "40%": { transform: "scale(1)", opacity: "1" }
        }
      },
      animation: {
        "pulse-dots": "pulse-dots 1.2s infinite ease-in-out"
      }
    }
  },
  plugins: []
};

