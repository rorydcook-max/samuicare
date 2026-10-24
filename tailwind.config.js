/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sea: { 50: "#effcf9", 100: "#cdf5ec", 200: "#9debdb", 300: "#64d9c4", 400: "#31bfa9", 500: "#16a390", 600: "#0f8476", 700: "#0f6a60", 800: "#11544e", 900: "#123f3b", 950: "#062724" },
        sand: { 50: "#fbf8f2", 100: "#f5eee0", 200: "#ebdcc0", 300: "#dfc597", 400: "#d2aa6c" },
        ink: "#10302c",
        coral: "#f0745a",
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
      boxShadow: { soft: "0 10px 40px -12px rgba(16,48,44,.18)" },
    },
  },
  plugins: [],
};
