/**
 * Display math. KaTeX renders the TeX to MathML on the phone (no network, no fonts to
 * bundle) and a small WebView shows it: WebKit on iOS and Chrome on Android draw MathML
 * natively. The WebView runs no remote content, blocks navigation and reports its height
 * so the block sizes to the formula. TeX that does not parse is shown as code.
 */
import katex from "katex";
import { memo, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "../../../ui/theme/ThemeProvider";
import { space } from "../../../ui/theme/tokens";
import { CodeBlock } from "./CodeBlock";

const HEIGHT_SCRIPT = "window.ReactNativeWebView.postMessage(String(Math.ceil(document.body.scrollHeight)));true;";

/** Exported for tests. Null when the TeX does not parse. */
export function mathHtml(tex: string, color: string): string | null {
  try {
    const mathml = katex.renderToString(tex, {
      output: "mathml",
      displayMode: true,
      throwOnError: true,
    });
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>html,body{margin:0;padding:0;background:transparent;color:${color};font-size:18px;overflow-x:auto}math{display:block;padding:4px 0}</style></head><body>${mathml}</body></html>`;
  } catch {
    return null;
  }
}

export const MathBlock = memo(function MathBlockImpl({ tex }: { tex: string }) {
  const { colors } = useTheme();
  const [height, setHeight] = useState(48);
  const html = useMemo(() => mathHtml(tex, colors.foreground), [tex, colors.foreground]);
  if (!html) return <CodeBlock code={tex} lang="tex" />;
  return (
    <View style={[styles.wrap, { height }]} accessible accessibilityLabel={`Formula: ${tex}`} testID="math-block">
      <WebView
        originWhitelist={["about:blank"]}
        source={{ html }}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        injectedJavaScript={HEIGHT_SCRIPT}
        onMessage={(e) => {
          const h = Number(e.nativeEvent.data);
          if (h > 0 && Math.abs(h - height) > 1) setHeight(Math.min(h, 600));
        }}
        onShouldStartLoadWithRequest={(r) => r.url === "about:blank"}
        setSupportMultipleWindows={false}
        allowFileAccess={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginVertical: space[2] },
  web: { backgroundColor: "transparent" },
});
