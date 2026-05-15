import { BLIND_OPTIONS, BOUNTY_OPTIONS } from "@pokington/shared";
import {
  NativeButton,
  NativeOptionSelector,
  NativeTextField,
  useNativeTheme,
  type NativeTheme,
} from "@pokington/ui/native";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createHomePanelStyles } from "./homePanelStyles";

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
  const theme = useNativeTheme();
  const panelStyles = useMemo(() => createHomePanelStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={panelStyles.panel}>
      <View style={panelStyles.header}>
        <View>
          <Text style={panelStyles.largeTitle}>Create</Text>
          <Text style={panelStyles.subtitle}>Set stakes, create, share link.</Text>
        </View>
        <Text style={panelStyles.badgeLabel}>New</Text>
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
      {createError ? <Text style={panelStyles.errorText}>{createError}</Text> : null}
    </View>
  );
}

function createStyles(t: NativeTheme) { return StyleSheet.create({
  selectorBlock: {
    gap: 6,
  },
  selectorLabel: {
    color: t.colors.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 6,
    textTransform: "uppercase",
  },
  createButton: {
    minHeight: 48,
    borderRadius: 18,
  },
}); }
