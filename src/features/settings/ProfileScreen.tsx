/** Profile: the photo and the name shown in the app and on chats you share. */
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { isApiError } from "../../api/vendor/client/errors";
import { useSession } from "../../app/session";
import { Button } from "../../ui/components/Button";
import { Field } from "../../ui/components/Inputs";
import { Avatar } from "../../ui/components/Media";
import { Text } from "../../ui/components/Text";
import { toast } from "../../ui/components/Toast";
import { space } from "../../ui/theme/tokens";
import { pickPhotos } from "../chat/attachments";
import { Notice, Page } from "./components";
import { u } from "./styles";

export function ProfileScreen() {
  const { api, me, setMe } = useSession();
  const [name, setName] = useState(me?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!me) return null;

  async function changePhoto() {
    const [picked] = await pickPhotos("library", 1).catch((e) => {
      toast(e instanceof Error ? e.message : "That picture could not be opened.");
      return [];
    });
    if (!picked) return;
    setPhotoBusy(true);
    try {
      const file = await api.files.upload({
        purpose: "AVATAR",
        file: {
          uri: picked.uri,
          name: picked.name,
          type: picked.type,
          size: picked.size,
        } as unknown as Blob & { name: string },
      });
      setMe(await api.users.updateMe({ avatarFileId: file.id }));
    } catch (e) {
      toast(isApiError(e) ? e.message : "The photo could not be changed.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      setMe(await api.users.updateMe({ avatarFileId: null }));
    } catch {
      toast("The photo could not be removed.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      setMe(await api.users.updateMe({ displayName: name.trim() }));
      toast("Saved");
    } catch (e) {
      setError(isApiError(e) ? e.message : "That did not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title="Profile" testID="settings-profile">
      <View style={[u.row, { gap: space[4], marginTop: space[6] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change photo"
          onPress={() => {
            changePhoto();
          }}
          disabled={photoBusy}
        >
          <Avatar uri={me.avatarUrl} name={name} size={80} />
          {photoBusy ? <ActivityIndicator style={styles.photoSpinner} /> : null}
        </Pressable>
        <View style={u.flex}>
          <Button
            label="Change photo"
            variant="outline"
            size="sm"
            onPress={() => {
              changePhoto();
            }}
            disabled={photoBusy}
            style={u.start}
          />
          {me.avatarUrl ? (
            <Button
              label="Remove"
              variant="ghost"
              size="sm"
              onPress={() => {
                removePhoto();
              }}
              disabled={photoBusy}
              style={[u.start, { marginTop: space[1] }]}
            />
          ) : null}
        </View>
      </View>
      <View style={{ marginTop: space[6] }}>
        <Field label="Name" value={name} onChangeText={setName} maxLength={80} hint="Shown in the app and on chats you share." testID="profile-name" />
        <Text variant="small" tone="muted">{`Username @${me.username} · ${me.email}`}</Text>
      </View>
      {error ? <Notice tone="danger" body={error} /> : null}
      <Button
        label="Save"
        loading={saving}
        disabled={name.trim() === me.displayName}
        onPress={() => {
          save();
        }}
        style={{ marginTop: space[6] }}
        testID="profile-save"
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  photoSpinner: { position: "absolute", top: 30, left: 30 },
});
