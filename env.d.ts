/** The keys read from .env by react-native-config (see .env.example). */
declare module "react-native-config" {
  export interface NativeConfig {
    API_BASE_URL?: string;
    APP_SCHEME?: string;
    ALLOW_CUSTOM_SERVER?: string;
  }
  export const Config: NativeConfig;
  export default Config;
}
