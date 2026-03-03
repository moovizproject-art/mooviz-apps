/**
 * Mooviz — React Native Entry Point
 * Registers the root component for bare React Native (non-Expo).
 */
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
