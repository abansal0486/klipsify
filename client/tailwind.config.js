/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      maxWidth: {
        '1140': '1140px',
      },
      fontFamily: {
        playfair: ['"Playfair"', 'serif'],
        poppins: ['"Poppins"', 'sans-serif'],
        montserrat: ['"Montserrat"', 'sans-serif'],
      },
      animation: {
        rotateslow: "rotate360 11s linear infinite",
        blob: "blob 7s infinite",
        shimmer: "shimmer 3s infinite linear",
        gradientMove: "gradientMove 6s ease infinite",
        spinSlow: "spinSlow 8s linear infinite",
      },
      keyframes: {
        rotate360: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        spinSlow: {
          from: {
            transform: "rotate(0deg)",
          },
          to: {
            transform: "rotate(360deg)",
          }
        },
        gradientMove: {

          "0%": {
            backgroundPosition: "0% 50%",
          },

          "50%": {
            backgroundPosition: "100% 50%",
          },

          "100%": {
            backgroundPosition: "0% 50%",
          },
        },

        shimmer: {
          "0%": {
            backgroundPosition: "-200% 0",
          },
          "100%": {
            backgroundPosition: "200% 0",
          },
        },
        blob: {
          "0%": {
            transform: "translate(0px, 0px) scale(1)",
          },
          "33%": {
            transform: "translate(30px, -50px) scale(1.1)",
          },
          "66%": {
            transform: "translate(-20px, 20px) scale(0.9)",
          },
          "100%": {
            transform: "translate(0px, 0px) scale(1)",
          },
        },
      },
    },
  },
  plugins: [
    require("tailwind-scrollbar"),
  ],
}

