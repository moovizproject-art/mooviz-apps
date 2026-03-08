/**
 * Mooviz — React Native Entry Point
 * Registers the root component for bare React Native (non-Expo).
 */
import { AppRegistry, Text, TextInput, LogBox } from 'react-native';

// Prevent Hermes from crashing (EXC_BREAKPOINT) on unhandled promise rejections.
// Native Firebase errors can have properties that crash Hermes during Error.stack construction.
const originalHandler = global.ErrorUtils?.getGlobalHandler();
global.ErrorUtils?.setGlobalHandler((error, isFatal) => {
  // Log but don't let Hermes try to construct a stack trace on native error objects
  console.error('[GlobalErrorHandler]', isFatal ? 'FATAL' : 'ERROR', error?.message || error);
  if (originalHandler) originalHandler(error, isFatal);
});

import App from './App';
import { name as appName } from './app.json';

// Cap system font scaling at 1.2x to prevent layout breakage on devices
// with enlarged fonts, while still respecting accessibility needs.
if (Text.defaultProps == null) Text.defaultProps = {};
Text.defaultProps.maxFontSizeMultiplier = 1.2;

if (TextInput.defaultProps == null) TextInput.defaultProps = {};
TextInput.defaultProps.maxFontSizeMultiplier = 1.2;

AppRegistry.registerComponent(appName, () => App);
