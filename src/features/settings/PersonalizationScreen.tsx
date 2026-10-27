/**
 * How answers are shaped: what the assistant should know about you, how it should answer,
 * the answer length, whether it remembers things, web search by default, the default
 * model and the read-aloud voice. Text fields save with the button; switches and choices
 * save at once.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { isApiError } from "../../api/vendor/client/errors";
import type { AnswerStyle, Preferences } from "../../api/vendor/types";
import { useFeatures } from "../../app/meta";
import { qk } from "../../app/query";
import { useApi } from "../../app/session";
import { Button } from "../../ui/components/Button";
import { ChoiceList } from "../../ui/components/Inputs";
import { Text } from "../../ui/components/Text";
import { toast } from "../../ui/components/Toast";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { radius, space, type } from "../../ui/theme/tokens";
import { useModels, usePreferences } from "../chat/queries";
import { GroupLabel, ListSkeleton, Page, SwitchRow } from "./components";

/** The read-aloud voices the server accepts (apps/api/src/integrations/speech VOICES). */
export const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"] as const;
const STYLES: { value: AnswerStyle; label: string; detail: string }[] = [
  {
    value: "CONCISE",
    label: "Concise",
    detail: "Short answers, straight to the point",
  },
  { value: "BALANCED", label: "Balanced", detail: "The default" },
  {
    value: "DETAILED",
    label: "Detailed",
    detail: "Thorough answers with examples",
  },
];

export function PersonalizationScreen() {
  const { colors } = useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const features = useFeatures();
  const prefsQuery = usePreferences();
  const models = useModels().data?.chat ?? [];
  const p = prefsQuery.data;
  const [aboutMe, setAboutMe] = useState("");
  const [instructions, setInstructions] = useState("");
  useEffect(() => {
    if (p) {
      setAboutMe(p.aboutMe);
      setInstructions(p.customInstructions);
    }
  }, [p?.aboutMe, p?.customInstructions]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: (patch: Partial<Preferences>) => api.me.updatePreferences(patch),
    onMutate: (patch) => qc.setQueryData<Preferences>(qk.preferences, (old) => (old ? { ...old, ...patch } : old)),
    onSuccess: (next) => qc.setQueryData(qk.preferences, next),
    onError: (e) => {
      toast(isApiError(e) ? e.message : "That did not save.");
      qc.invalidateQueries({ queryKey: qk.preferences });
    },
  });

  if (!p)
    return (
      <Page title="Personalization">
        <ListSkeleton />
      </Page>
    );
  const textDirty = aboutMe !== p.aboutMe || instructions !== p.customInstructions;
  const field = [styles.area, { color: colors.foreground, borderColor: colors.input }];

  return (
    <Page title="Personalization" testID="settings-personalization-screen">
      <GroupLabel first>About you</GroupLabel>
      <Text variant="small" tone="muted">
        What should the assistant know about you to answer better?
      </Text>
      <TextInput
        value={aboutMe}
        onChangeText={setAboutMe}
        multiline
        maxLength={1500}
        placeholder="For example: I teach high-school physics in Pune."
        placeholderTextColor={colors.subtleForeground}
        style={field}
        testID="pref-about"
      />
      <GroupLabel>How to answer</GroupLabel>
      <Text variant="small" tone="muted">
        Instructions every new chat follows.
      </Text>
      <TextInput
        value={instructions}
        onChangeText={setInstructions}
        multiline
        maxLength={1500}
        placeholder="For example: use metric units; explain the why."
        placeholderTextColor={colors.subtleForeground}
        style={field}
        testID="pref-instructions"
      />
      {textDirty ? (
        <Button
          label="Save"
          loading={save.isPending}
          onPress={() => save.mutate({ aboutMe, customInstructions: instructions }, { onSuccess: () => toast("Saved") })}
          style={styles.start}
          testID="pref-save"
        />
      ) : null}

      <GroupLabel>Answer length</GroupLabel>
      <ChoiceList options={STYLES} selected={[p.answerStyle]} onToggle={(v) => save.mutate({ answerStyle: v })} />

      <GroupLabel>Behaviour</GroupLabel>
      {features.memory ? (
        <SwitchRow
          label="Memory"
          detail="Remember useful facts across chats. Manage them in Settings, Memory."
          value={p.memoryEnabled}
          onChange={(v) => save.mutate({ memoryEnabled: v })}
          testID="pref-memory"
        />
      ) : null}
      {features.webSearch ? (
        <SwitchRow
          label="Search the web by default"
          detail="New messages start with web search on."
          value={p.webSearchDefault}
          onChange={(v) => save.mutate({ webSearchDefault: v })}
          testID="pref-web"
          last
        />
      ) : null}

      {models.length ? (
        <>
          <GroupLabel>Default model</GroupLabel>
          <ChoiceList
            options={models.map((m) => ({
              value: m.id,
              label: m.displayName,
              detail: m.description || undefined,
            }))}
            selected={[p.defaultModelId ?? models.find((m) => m.isDefault)?.id ?? ""]}
            onToggle={(v) => save.mutate({ defaultModelId: v })}
          />
        </>
      ) : null}

      {features.readAloud ? (
        <>
          <GroupLabel>Read-aloud voice</GroupLabel>
          <View style={styles.voices}>
            {VOICES.map((v) => (
              <Pressable
                key={v}
                accessibilityRole="radio"
                accessibilityState={{ checked: p.voice === v }}
                onPress={() => save.mutate({ voice: v })}
                hitSlop={4}
                style={styles.voice}
                testID={`voice-${v}`}
              >
                <Text variant="bodyStrong" tone={p.voice === v ? "default" : "muted"} style={p.voice === v ? styles.chosen : undefined}>
                  {v[0]!.toUpperCase() + v.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: "flex-start" },
  area: {
    ...type.body,
    minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    padding: space[3],
    marginVertical: space[3],
    textAlignVertical: "top",
  },
  voices: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: space[5],
    rowGap: space[2],
  },
  voice: { paddingVertical: 6 },
  chosen: { textDecorationLine: "underline" },
});
