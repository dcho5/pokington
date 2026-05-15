import { NativeButton, NativeTextField, useNativeTheme, type NativeTheme } from "@pokington/ui/native";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createHomePanelStyles } from "./homePanelStyles";

export interface JoinTablePanelProps {
  tableCode: string;
  joinError: string | null;
  isJoining: boolean;
  onChangeTableCode: (code: string) => void;
  onJoin: () => void;
}

export default function JoinTablePanel({
  tableCode,
  joinError,
  isJoining,
  onChangeTableCode,
  onJoin,
}: JoinTablePanelProps) {
  const theme = useNativeTheme();
  const panelStyles = useMemo(() => createHomePanelStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={panelStyles.panel}>
      <View style={panelStyles.header}>
        <View>
          <Text style={panelStyles.title}>Join</Text>
          <Text style={panelStyles.subtitle}>Enter a 6-character code.</Text>
        </View>
        <Text style={panelStyles.badgeLabel}>Code</Text>
      </View>
      <View style={styles.row}>
        <NativeTextField
          label=""
          containerStyle={styles.codeField}
          value={tableCode}
          onChangeText={(value: string) => onChangeTableCode(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
          returnKeyType="done"
          blurOnSubmit
          placeholder="Table code"
          autoCapitalize="characters"
          maxLength={6}
          style={styles.codeInput}
        />
        <NativeButton
          label={isJoining ? "..." : "Join"}
          disabled={isJoining}
          loading={isJoining}
          onPress={onJoin}
          style={styles.joinButton}
        />
      </View>
      {joinError ? <Text style={panelStyles.errorText}>{joinError}</Text> : null}
    </View>
  );
}

function createStyles(t: NativeTheme) { return StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  codeInput: {
    minHeight: 50,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  codeField: {
    flex: 1,
    minWidth: 0,
  },
  joinButton: {
    minWidth: 78,
    borderRadius: 18,
    backgroundColor: t.colors.buttonNeutral,
    shadowOpacity: 0,
    elevation: 0,
  },
}); }
