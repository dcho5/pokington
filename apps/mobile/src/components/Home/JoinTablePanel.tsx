import { NativeButton, NativeTextField, nativeLightTheme } from "@pokington/ui/native";
import { StyleSheet, Text, View } from "react-native";
import { homePanelStyles } from "./homePanelStyles";

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
  return (
    <View style={homePanelStyles.panel}>
      <View style={homePanelStyles.header}>
        <View>
          <Text style={homePanelStyles.title}>Join</Text>
          <Text style={homePanelStyles.subtitle}>Enter a 6-character code.</Text>
        </View>
        <Text style={homePanelStyles.badgeLabel}>Code</Text>
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
      {joinError ? <Text style={homePanelStyles.errorText}>{joinError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: nativeLightTheme.colors.text,
    shadowOpacity: 0,
    elevation: 0,
  },
});
