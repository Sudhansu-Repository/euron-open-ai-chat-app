/**
 * The model in the composer: its name as a quiet control, and a sheet listing every chat
 * model the server offers with one line of facts ("vision · tools · 128k context") and
 * its description. The choice is remembered on this device for new chats; Personalization
 * sets the account default.
 */
import { Check, ChevronDown } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { ChatModel, ModelCatalog } from "../../api/vendor/types";
import { PREF, prefs } from "../../lib/storage";
import { Sheet } from "../../ui/components/Sheet";
import { Text } from "../../ui/components/Text";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { space } from "../../ui/theme/tokens";
import { useModels, usePreferences } from "./queries";

/** "vision · tools · 128k context". Exported for tests. */
export function modelFacts(m: ChatModel): string {
  const facts: string[] = [];
  if (m.supportsVision) facts.push("vision");
  if (m.supportsTools) facts.push("tools");
  if (m.supportsReasoning) facts.push("reasoning");
  if (m.contextWindow)
    facts.push(`${m.contextWindow >= 1_000_000 ? `${Math.round(m.contextWindow / 100_000) / 10}M` : `${Math.round(m.contextWindow / 1000)}k`} context`);
  if (m.weight > 1) facts.push(`counts ${m.weight}x`);
  return facts.join(" · ");
}

/** The model to use: this device's last pick, else the account default, else the server default. Exported for tests. */
export function resolveModel(catalog: ModelCatalog | undefined, picked: string | undefined, accountDefault: string | null | undefined): ChatModel | null {
  const list = catalog?.chat ?? [];
  return list.find((m) => m.id === picked) ?? list.find((m) => m.id === accountDefault) ?? list.find((m) => m.isDefault) ?? list[0] ?? null;
}

export function useSelectedModel() {
  const catalog = useModels().data;
  const prefsQuery = usePreferences().data;
  const [picked, setPicked] = useState<string | undefined>(() => prefs.getString(PREF.lastModel));
  const model = useMemo(() => resolveModel(catalog, picked, prefsQuery?.defaultModelId), [catalog, picked, prefsQuery?.defaultModelId]);
  const choose = (id: string) => {
    setPicked(id);
    prefs.setString(PREF.lastModel, id);
  };
  return { model, models: catalog?.chat ?? [], choose };
}

export function ModelControl({ model, models, onChoose }: { model: ChatModel | null; models: ChatModel[]; onChoose: (id: string) => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!models.length) setOpen(false);
  }, [models.length]);
  if (!model) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Model: ${model.displayName}. Change`}
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={styles.control}
        testID="model-control"
      >
        <Text variant="smallStrong" tone="muted" numberOfLines={1} style={styles.name}>
          {model.displayName}
        </Text>
        <ChevronDown size={14} color={colors.mutedForeground} />
      </Pressable>
      <Sheet visible={open} title="Model" onClose={() => setOpen(false)} testID="model-sheet">
        {models.map((m, i) => {
          const selected = m.id === model.id;
          return (
            <Pressable
              key={m.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => {
                onChoose(m.id);
                setOpen(false);
              }}
              testID={`model-${m.id}`}
              style={({ pressed }) => [
                styles.row,
                i < models.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <View style={styles.flex}>
                <Text variant="bodyStrong">{m.displayName}</Text>
                <Text variant="small" tone="muted">
                  {modelFacts(m)}
                </Text>
                {m.description ? (
                  <Text variant="small" tone="subtle" style={styles.mt2}>
                    {m.description}
                  </Text>
                ) : null}
              </View>
              {selected ? <Check size={20} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  mt2: { marginTop: 2 },
  flex: { flex: 1 },
  control: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-end",
    maxWidth: "100%",
    paddingHorizontal: space[2],
    height: 36,
  },
  name: { flexShrink: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[4],
  },
});
