import { BLIND_OPTIONS, BOUNTY_OPTIONS } from "@pokington/shared";
import {
  NativeButton,
  NativeOptionSelector,
  NativeTextField,
  nativeLightTheme,
} from "@pokington/ui/native";
import { StyleSheet, Text, View } from "react-native";
import { homePanelStyles } from "./homePanelStyles";

export interface CreateTablePanelProps {
  tableName: string;
  blindIdx: number;
  bountyIdx: number;
  createError: string | null;
  isCreating: boolean;
  onChangeTableName: (name: string) => void;
  onTableNameFocus: () => void;
  onChangeBlindIdx: (index: number) => void;
  onChangeBountyIdx: (index: number) => void;
  onCreate: () => void;
}

export default function CreateTablePanel({
  tableName,
  blindIdx,
  bountyIdx,
  createError,
  isCreating,
  onChangeTableName,
  onTableNameFocus,
  onChangeBlindIdx,
  onChangeBountyIdx,
  onCreate,
}: CreateTablePanelProps) {
  return (
    <View style={homePanelStyles.panel}>
      <View style={homePanelStyles.header}>
        <View>
          <Text style={homePanelStyles.largeTitle}>Create</Text>
          <Text style={homePanelStyles.subtitle}>Set stakes, create, share link.</Text>
        </View>
        <Text style={homePanelStyles.badgeLabel}>New</Text>
      </View>

      <NativeTextField
        label=""
        value={tableName}
        onChangeText={onChangeTableName}
        onFocus={onTableNameFocus}
        returnKeyType="done"
        blurOnSubmit
        placeholder="Table name"
        autoCapitalize="none"
      />

      <View style={styles.selectorBlock}>
        <Text style={styles.selectorLabel}>Blinds</Text>
        <NativeOptionSelector compact options={BLIND_OPTIONS} value={blindIdx} onChange={onChangeBlindIdx} />
      </View>

      <View style={styles.selectorBlock}>
        <Text style={styles.selectorLabel}>Bounty</Text>
        <NativeOptionSelector compact options={BOUNTY_OPTIONS} value={bountyIdx} onChange={onChangeBountyIdx} />
      </View>

      <NativeButton
        label={isCreating ? "Creating..." : "Create Table"}
        loading={isCreating}
        disabled={isCreating}
        onPress={onCreate}
        style={styles.createButton}
      />
      {createError ? <Text style={homePanelStyles.errorText}>{createError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  selectorBlock: {
    gap: 6,
  },
  selectorLabel: {
    color: nativeLightTheme.colors.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 6,
    textTransform: "uppercase",
  },
  createButton: {
    minHeight: 48,
    borderRadius: 18,
  },
});
