/**
 * Welcome (which server), sign in with two-factor, sign up, forgot password and email
 * verification: the signed-out stack. Signing in swaps the navigator to the chat, so
 * these screens never navigate there themselves.
 */
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { ChevronLeft, Server } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isApiError } from "../../api/vendor/client/errors";
import { useMeta } from "../../app/meta";
import type { RootScreen } from "../../app/routes";
import { useSession } from "../../app/session";
import { config } from "../../config";
import { normalizeServer, probeServer } from "../../lib/server";
import { Button, IconButton } from "../../ui/components/Button";
import { Field, type FieldRef } from "../../ui/components/Inputs";
import { Text } from "../../ui/components/Text";
import { useTheme } from "../../ui/theme/ThemeProvider";
import { space } from "../../ui/theme/tokens";

/** Matches the server's username rule (apps/api/src/domain/username.ts). */
const USERNAME = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/i;

function message(e: unknown): string {
  if (isApiError(e)) {
    if (e.code === "NETWORK_ERROR") return "Cannot reach the server. Check your connection.";
    if (e.code === "RATE_LIMITED") return "Too many attempts. Wait a minute and try again.";
    return e.message;
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

function AuthFrame({ title, lead, children, onBack }: { title: string; lead?: string; children: React.ReactNode; onBack?: () => void}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const meta = useMeta().data;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.top}>
        {onBack ? <IconButton label="Back" onPress={onBack} icon={<ChevronLeft size={26} color={colors.foreground} />} /> : <View style={styles.side} />}
        <Text variant="smallStrong" tone="muted">
          {meta?.appName ?? ""}
        </Text>
        <View style={styles.side} />
      </View>
      <View style={[styles.body, { paddingBottom: insets.bottom + space[6] }]}>
        <Text variant="title">{title}</Text>
        {lead ? (
          <Text tone="muted" style={{ marginTop: space[2], marginBottom: space[6] }}>
            {lead}
          </Text>
        ) : (
          <View style={{ height: space[6] }} />
        )}
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

function TextLink({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} testID={testID}>
      <Text variant="smallStrong" tone="link">
        {label}
      </Text>
    </Pressable>
  );
}

export function SignInScreen({ navigation }: RootScreen<"SignIn">) {
  const { signIn } = useSession();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<FieldRef>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await signIn({
        login: login.trim(),
        password,
        ...(needsCode ? (useRecovery ? { recoveryCode: code.trim() } : { totp: code.trim() }) : {}),
      });
      if (!r.ok && "totpRequired" in r) setNeedsCode(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title={needsCode ? "Two-step verification" : "Sign in"}
      lead={
        needsCode
          ? useRecovery
            ? "Enter one of your recovery codes."
            : "Enter the six-digit code from your authenticator app."
          : "Pick up your chats where you left off."
      }
      onBack={() => (needsCode ? setNeedsCode(false) : navigation.goBack())}
    >
      {needsCode ? (
        <>
          <Field
            label={useRecovery ? "Recovery code" : "Code"}
            value={code}
            onChangeText={setCode}
            autoFocus
            keyboardType={useRecovery ? "default" : "number-pad"}
            autoCapitalize="none"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            testID="signin-code"
            onSubmitEditing={submit}
          />
          <TextLink
            label={useRecovery ? "Use your authenticator app" : "Use a recovery code"}
            onPress={() => {
              setUseRecovery((v) => !v);
              setCode("");
            }}
          />
        </>
      ) : (
        <>
          <Field
            label="Email or username"
            value={login}
            onChangeText={setLogin}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            testID="signin-login"
          />
          <Field
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            testID="signin-password"
          />
          <TextLink label="Forgot your password?" onPress={() => navigation.navigate("ForgotPassword")} testID="signin-forgot" />
        </>
      )}
      {error ? (
        <Text tone="danger" variant="small" style={{ marginTop: space[4] }} testID="signin-error">
          {error}
        </Text>
      ) : null}
      <Button
        label={needsCode ? "Verify" : "Sign in"}
        size="lg"
        block
        loading={busy}
        disabled={!login || !password || (needsCode && !code)}
        onPress={submit}
        style={{ marginTop: space[6] }}
        testID="signin-submit"
      />
      {!needsCode ? (
        <View style={styles.switchRow}>
          <Text variant="small" tone="muted">
            New here?
          </Text>
          <TextLink label="Create an account" onPress={() => navigation.replace("SignUp")} testID="signin-to-signup" />
        </View>
      ) : null}
    </AuthFrame>
  );
}

export function SignUpScreen({ navigation }: RootScreen<"SignUp">) {
  const { signUp } = useSession();
  const meta = useMeta().data;
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    username: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const closed = meta?.registration === "CLOSED" || meta?.registration === "INVITE_ONLY";

  async function submit() {
    const local: Record<string, string> = {};
    if (!form.displayName.trim()) local.displayName = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) local.email = "Enter a valid email address.";
    if (!USERNAME.test(form.username.trim())) local.username = "3 to 40 letters, digits or hyphens, starting and ending with a letter or digit.";
    if (form.password.length < 10) local.password = "Use at least 10 characters.";
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    setError(null);
    try {
      const r = await signUp({
        displayName: form.displayName.trim(),
        email: form.email.trim().toLowerCase(),
        username: form.username.trim().toLowerCase(),
        password: form.password,
      });
      if (!r.ok && "verificationRequired" in r) navigation.replace("CheckEmail", { email: r.email });
    } catch (e) {
      if (isApiError(e) && Object.keys(e.fieldErrors).length) setErrors(e.fieldErrors);
      else setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  if (closed) {
    return (
      <AuthFrame
        title="Sign-ups are closed"
        lead={
          meta?.registration === "INVITE_ONLY"
            ? "Accounts on this server are created by invitation. Ask its admin for one."
            : "This server is not taking new sign-ups right now."
        }
        onBack={() => navigation.goBack()}
      >
        <Button label="Sign in instead" variant="outline" block onPress={() => navigation.replace("SignIn")} />
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Create your account" lead="Your chats, projects and images, on every device." onBack={() => navigation.goBack()}>
      <Field
        label="Name"
        value={form.displayName}
        onChangeText={set("displayName")}
        autoComplete="name"
        textContentType="name"
        error={errors.displayName}
        testID="signup-name"
      />
      <Field
        label="Email"
        value={form.email}
        onChangeText={set("email")}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        error={errors.email}
        testID="signup-email"
      />
      <Field
        label="Username"
        value={form.username}
        onChangeText={set("username")}
        autoCapitalize="none"
        autoCorrect={false}
        hint="Letters, digits and hyphens."
        error={errors.username}
        testID="signup-username"
      />
      <Field
        label="Password"
        value={form.password}
        onChangeText={set("password")}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint="At least 10 characters."
        error={errors.password}
        testID="signup-password"
      />
      {error ? (
        <Text tone="danger" variant="small" testID="signup-error">
          {error}
        </Text>
      ) : null}
      <Button label="Create account" size="lg" block loading={busy} onPress={submit} style={{ marginTop: space[4] }} testID="signup-submit" />
      <View style={styles.switchRow}>
        <Text variant="small" tone="muted">
          Already have an account?
        </Text>
        <TextLink label="Sign in" onPress={() => navigation.replace("SignIn")} />
      </View>
    </AuthFrame>
  );
}

export function CheckEmailScreen({ navigation, route }: RootScreen<"CheckEmail">) {
  const { api } = useSession();
  const [sent, setSent] = useState(false);
  return (
    <AuthFrame
      title="Check your email"
      lead={`We sent a link to ${route.params.email}. Open it to verify your address, then sign in here.`}
      onBack={() => navigation.goBack()}
    >
      <Button label="I've verified, sign in" size="lg" block onPress={() => navigation.replace("SignIn")} testID="check-email-signin" />
      <Button
        label={sent ? "Sent again" : "Send the link again"}
        variant="ghost"
        block
        disabled={sent}
        onPress={() =>
          api.auth
            .resendVerification(route.params.email)
            .then(() => setSent(true))
            .catch(() => setSent(true))
        }
        style={{ marginTop: space[2] }}
      />
    </AuthFrame>
  );
}

export function ForgotPasswordScreen({ navigation }: RootScreen<"ForgotPassword">) {
  const { api } = useSession();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <AuthFrame
      title="Reset your password"
      lead={
        done ? "If an account uses that address, a reset link is on its way. Open it on this phone or a computer." : "We will email you a link to choose a new password."
      }
      onBack={() => navigation.goBack()}
    >
      {done ? (
        <Button label="Back to sign in" size="lg" block onPress={() => navigation.replace("SignIn")} />
      ) : (
        <>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <Button
            label="Send link"
            size="lg"
            block
            loading={busy}
            disabled={!email}
            onPress={async () => {
              setBusy(true);
              // The API answers the same either way, so this never reveals whether an account exists.
              await api.auth.forgotPassword(email.trim().toLowerCase()).catch(() => undefined);
              setBusy(false);
              setDone(true);
            }}
          />
        </>
      )}
    </AuthFrame>
  );
}

/**
 * Opened by an `openchat://verify-email?token=` link. Verifying signs in, so it waits for a
 * tap: a link someone else sent must not silently sign this phone into their account.
 */
export function VerifyEmailScreen({ navigation, route }: RootScreen<"VerifyEmail">) {
  const { verifyEmail } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await verifyEmail(route.params.token);
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title={error ? "This link did not work" : "Verify your email"}
      lead={error ?? "This confirms the address you signed up with and signs you in on this phone. Only continue if you asked for this link."}
      onBack={() => navigation.replace("Welcome")}
    >
      {error ? (
        <Button label="Sign in" variant="outline" block onPress={() => navigation.replace("SignIn")} />
      ) : (
        <Button label="Verify and sign in" size="lg" block loading={busy} onPress={() => { confirm(); }} testID="verify-confirm" />
      )}
    </AuthFrame>
  );
}

/** The first screen: the server's name and the two ways in, with the server shown and changeable. */
export function WelcomeScreen({ navigation }: RootScreen<"Welcome">) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { server } = useSession();
  const meta = useMeta();
  const host = server.replace(/^https?:\/\//, "").replace(/\/api$/, "");
  const canSignUp = meta.data?.registration === "OPEN";
  return (
    <View
      style={[
        styles.fill,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + space[16],
          paddingBottom: insets.bottom + space[6],
        },
      ]}
      testID="welcome"
    >
      <View style={styles.welcomeBody}>
        <Text variant="hero">{meta.data?.appName ?? "Open AI Chat"}</Text>
        <Text tone="muted" style={{ marginTop: space[3] }}>
          {meta.data?.tagline || "A private AI assistant: any model, web search with sources, files, images and memory."}
        </Text>
        {meta.isError && !meta.data ? (
          <Text tone="danger" variant="small" style={{ marginTop: space[4] }} testID="welcome-unreachable">
            The server could not be reached. Check your connection
            {config.allowCustomServer ? " or change the server" : ""}.
          </Text>
        ) : null}
      </View>
      <View style={styles.welcomeActions}>
        <Button label="Sign in" size="lg" block onPress={() => navigation.navigate("SignIn")} testID="welcome-signin" />
        {canSignUp ? <Button label="Create an account" size="lg" variant="outline" block onPress={() => navigation.navigate("SignUp")} testID="welcome-signup" /> : null}
        {config.allowCustomServer ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Server: ${host}. Change`}
            onPress={() => navigation.navigate("Server")}
            style={styles.serverRow}
            hitSlop={8}
            testID="welcome-server"
          >
            <Server size={15} color={colors.mutedForeground} />
            <Text variant="small" tone="muted" numberOfLines={1}>
              {host}
            </Text>
            <Text variant="smallStrong" tone="link">
              Change
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Point the app at another euron-open-ai-chat server; accepted only once its /api/meta answers. */
export function ServerScreen({ navigation }: RootScreen<"Server">) {
  const { server, setServer } = useSession();
  const [value, setValue] = useState(server.replace(/\/api$/, ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const api = normalizeServer(value);
    if (!api) {
      setError("Enter the server's address, like chat.example.com. Plain http works only for local addresses.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await probeServer(api);
      await setServer(api);
      navigation.goBack();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Your server" lead="The address of the Open AI Chat server you use. Your company or community gives you this." onBack={() => navigation.goBack()}>
      <Field
        label="Server address"
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        textContentType="URL"
        placeholder="chat.example.com"
        returnKeyType="go"
        onSubmitEditing={submit}
        testID="server-input"
      />
      {error ? (
        <Text tone="danger" variant="small" testID="server-error">
          {error}
        </Text>
      ) : null}
      <Button label="Connect" size="lg" block loading={busy} disabled={!value.trim()} onPress={submit} style={{ marginTop: space[4] }} testID="server-submit" />
      {value.trim() !== config.defaultApiBaseUrl.replace(/\/api$/, "") ? (
        <Button
          label="Use the default server"
          variant="ghost"
          block
          onPress={() => setValue(config.defaultApiBaseUrl.replace(/\/api$/, ""))}
          style={{ marginTop: space[2] }}
        />
      ) : null}
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  side: { width: 40 },
  fill: { flex: 1 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space[1],
    height: 52,
  },
  body: { flex: 1, paddingHorizontal: space[5], paddingTop: space[6] },
  switchRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space[6],
  },
  welcomeBody: { flex: 1, paddingHorizontal: space[6] },
  welcomeActions: { paddingHorizontal: space[5], gap: space[3] },
  serverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: space[3],
  },
});
