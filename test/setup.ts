/**
 * Mocks for every native module the app links, so screens and hooks render in Node.
 * Keep them minimal: tests assert behaviour through these, not native internals.
 */
jest.mock("react-native-config", () => ({ __esModule: true, default: { API_BASE_URL: "http://api.test/api", ALLOW_CUSTOM_SERVER: "true", APP_SCHEME: "openchat" } }));
jest.mock("@react-native-community/netinfo", () => require("@react-native-community/netinfo/jest/netinfo-mock.js"));
jest.mock("react-native-device-info", () => require("react-native-device-info/jest/react-native-device-info-mock.js"));

jest.mock("react-native-mmkv", () => {
  const stores = new Map<string, Map<string, unknown>>();
  return {
    createMMKV: ({ id = "default" }: { id?: string } = {}) => {
      if (!stores.has(id)) stores.set(id, new Map());
      const m = stores.get(id)!;
      return {
        set: (k: string, v: unknown) => m.set(k, v),
        getString: (k: string) => (typeof m.get(k) === "string" ? (m.get(k) as string) : undefined),
        getNumber: (k: string) => (typeof m.get(k) === "number" ? (m.get(k) as number) : undefined),
        getBoolean: (k: string) => (typeof m.get(k) === "boolean" ? (m.get(k) as boolean) : undefined),
        contains: (k: string) => m.has(k),
        remove: (k: string) => m.delete(k),
        clearAll: () => m.clear(),
      };
    },
  };
});

jest.mock("react-native-keychain", () => {
  const vault = new Map<string, { username: string; password: string }>();
  return {
    ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AccessibleAfterFirstUnlockThisDeviceOnly" },
    setGenericPassword: jest.fn(async (username: string, password: string, o?: { service?: string }) => {
      vault.set(o?.service ?? "default", { username, password });
      return { service: o?.service, storage: "mock" };
    }),
    getGenericPassword: jest.fn(async (o?: { service?: string }) => vault.get(o?.service ?? "default") ?? false),
    resetGenericPassword: jest.fn(async (o?: { service?: string }) => vault.delete(o?.service ?? "default")),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { __esModule: true, WebView: (p: object) => React.createElement(View, { testID: "webview", ...p }), default: (p: object) => React.createElement(View, p) };
});
jest.mock("react-native-blob-util", () => ({
  __esModule: true,
  default: {
    fs: {
      dirs: { DocumentDir: "/docs", CacheDir: "/cache" },
      exists: jest.fn(async () => false),
      unlink: jest.fn(async () => undefined),
      mkdir: jest.fn(async () => undefined),
      ls: jest.fn(async () => []),
      stat: jest.fn(async () => ({ size: 0 })),
      writeFile: jest.fn(async () => undefined),
      readFile: jest.fn(async () => ""),
    },
    config: () => ({ fetch: jest.fn(async () => ({ path: () => "/cache/file", info: () => ({ status: 200 }) })) }),
    fetch: jest.fn(async () => ({ info: () => ({ status: 200 }), path: () => "/cache/file" })),
    wrap: (p: string) => `RNFetchBlob-file://${p}`,
  },
}));
jest.mock("@react-native-firebase/app", () => ({
  __esModule: true,
  getApp: jest.fn(() => {
    throw new Error("no firebase in tests");
  }),
  getApps: jest.fn(() => []),
}));
jest.mock("@react-native-firebase/messaging", () => ({
  __esModule: true,
  getMessaging: jest.fn(),
  getToken: jest.fn(async () => "push-token"),
  onMessage: jest.fn(() => () => undefined),
  onTokenRefresh: jest.fn(() => () => undefined),
  requestPermission: jest.fn(async () => 1),
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2, DENIED: 0 },
}));
jest.mock("react-native-inappbrowser-reborn", () => ({
  __esModule: true,
  InAppBrowser: {
    isAvailable: jest.fn(async () => true),
    openAuth: jest.fn(async () => ({ type: "cancel" })),
    open: jest.fn(async () => ({ type: "cancel" })),
    close: jest.fn(),
  },
  default: { isAvailable: jest.fn(async () => true), openAuth: jest.fn(async () => ({ type: "cancel" })) },
}));
jest.mock("@react-native-documents/picker", () => ({
  __esModule: true,
  pick: jest.fn(async () => []),
  keepLocalCopy: jest.fn(async () => []),
  types: { images: "public.image", pdf: "com.adobe.pdf", doc: "com.microsoft.word.doc", docx: "org.openxmlformats.wordprocessingml.document", xls: "com.microsoft.excel.xls", xlsx: "org.openxmlformats.spreadsheetml.sheet", csv: "public.comma-separated-values-text", plainText: "public.plain-text", allFiles: "public.item" },
  isErrorWithCode: () => false,
  errorCodes: { OPERATION_CANCELED: "OPERATION_CANCELED" },
}));
jest.mock("react-native-share", () => ({ __esModule: true, default: { open: jest.fn(async () => ({ success: true })) } }));
jest.mock("react-native-nitro-sound", () => {
  const sound = {
    startRecorder: jest.fn(async () => "file:///cache/rec.m4a"),
    stopRecorder: jest.fn(async () => "file:///cache/rec.m4a"),
    startPlayer: jest.fn(async () => "ok"),
    stopPlayer: jest.fn(async () => "ok"),
    setSubscriptionDuration: jest.fn(),
    addRecordBackListener: jest.fn(),
    removeRecordBackListener: jest.fn(),
    addPlaybackEndListener: jest.fn(),
    removePlaybackEndListener: jest.fn(),
  };
  return { __esModule: true, createSound: () => sound, default: sound, OutputFormatAndroidType: { MPEG_4: 2 }, AudioEncoderAndroidType: { AAC: 3 } };
});
jest.mock("react-native-image-picker", () => ({ __esModule: true, launchCamera: jest.fn(async () => ({ didCancel: true })), launchImageLibrary: jest.fn(async () => ({ didCancel: true })) }));
jest.mock("@react-native-camera-roll/camera-roll", () => ({ __esModule: true, CameraRoll: { saveAsset: jest.fn(async () => ({})) } }));
jest.mock("react-native-keyboard-controller", () => require("react-native-keyboard-controller/jest"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
require("react-native-gesture-handler/jestSetup");
jest.mock("@react-native-clipboard/clipboard", () => ({ __esModule: true, default: { setString: jest.fn(), getString: jest.fn(async () => "") } }));

// React only checks act() wrapping when this is set; Testing Library's async render and
// findBy* queries wrap their own updates.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
