import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  config: {
    initialColorMode: "dark",
    useSystemColorMode: false
  },
  fonts: {
    body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    heading: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  },
  colors: {
    ink: {
      50: "#f5efe6",
      100: "#e8dfd2",
      500: "#a99e8f"
    },
    surface: {
      900: "#12100e",
      800: "#1c1917",
      700: "#242019",
      600: "#332d26"
    },
    brand: {
      300: "#f0bd6b",
      400: "#e8a33d",
      500: "#d18f2c",
      600: "#b8763b"
    },
    danger: {
      400: "#e5645c",
      500: "#c9493f"
    },
    success: {
      400: "#5fbf7a",
      500: "#43a15f"
    },
    staff: {
      900: "#0f1115",
      800: "#171a21",
      700: "#1f232c",
      600: "#2b303a",
      500: "#8d97a8"
    }
  },
  styles: {
    global: {
      "html, body, #__next": {
        bg: "surface.900",
        color: "ink.50",
        minHeight: "100%"
      },
      "*::selection": {
        bg: "brand.400",
        color: "surface.900"
      },
      "::-webkit-scrollbar": {
        height: "6px",
        width: "0px"
      }
    }
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: "12px",
        fontWeight: 700
      }
    }
  }
});

export default theme;
