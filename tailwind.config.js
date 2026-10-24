/** @type {import('tailwindcss').Config} */
// Token names kept stable across the app: `sea` = lagoon teal scale, `sand` = cool mist greys,
// `ink` = deep lagoon text, `sun` = price highlight, `coral` = small warning/discount accents.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sea: { 50: "#EEF6F5", 100: "#D5ECE9", 200: "#A9D6D1", 300: "#76BBB5", 400: "#3E9A95", 500: "#167F80", 600: "#0A6C74", 700: "#0A5960", 800: "#0C474D", 900: "#0E2A2F", 950: "#08191C" },
        sand: { 50: "#F6F8F8", 100: "#EEF3F2", 200: "#DCE5E3", 300: "#C2CFCC", 400: "#97A8A5" },
        ink: "#0E2A2F",
        sun: "#F2C14E",
        coral: "#B4471F",
      },
      fontFamily: {
        display: ['"Schibsted Grotesk"', "system-ui", "sans-serif"],
        sans: ['"Schibsted Grotesk"', "system-ui", "sans-serif"],
      },
      fontSize: {
        hero: ["clamp(2.6rem, 6vw, 4.6rem)", { lineHeight: "1.02", letterSpacing: "-0.035em" }],
        price: ["clamp(3.4rem, 9vw, 5.6rem)", { lineHeight: "1", letterSpacing: "-0.04em" }],
      },
      boxShadow: { soft: "none" },
    },
  },
  plugins: [],
};
