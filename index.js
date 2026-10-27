/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Raised inside react-native-drawer-layout and react-native-keyboard-controller (Reanimated
// hooks given dependency arrays), not by app code; harmless on native.
LogBox.ignoreLogs(['[Reanimated] Dependencies should only be used on the web']);

AppRegistry.registerComponent(appName, () => App);
