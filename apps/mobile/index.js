/**
 * Mooviz — React Native Entry Point
 * Registers the root component for bare React Native (non-Expo).
 */
import { AppRegistry, Text, TextInput } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Cap system font scaling at 1.2x to prevent layout breakage on devices
// with enlarged fonts, while still respecting accessibility needs.
if (Text.defaultProps == null) Text.defaultProps = {};
Text.defaultProps.maxFontSizeMultiplier = 1.2;

if (TextInput.defaultProps == null) TextInput.defaultProps = {};
TextInput.defaultProps.maxFontSizeMultiplier = 1.2;

AppRegistry.registerComponent(appName, () => App);
