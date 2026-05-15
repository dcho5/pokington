import { useColorScheme } from "react-native";
import { nativeLightTheme, nativeDarkTheme } from "../components/native/PokingtonNative";

export function useNativeTheme() {
  const scheme = useColorScheme();
  return scheme === "dark" ? nativeDarkTheme : nativeLightTheme;
}
