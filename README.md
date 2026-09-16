# VoxLab Voice Studio

VoxLab is a premium Android voice studio built with Expo and React Native. The free MVP uses Android microphone recording plus local voice-shaping controls for pitch lift, feminine formant, brightness, noise gate, headphone monitoring, presets, playback, and local session handling.

## Current processing scope

The app is intentionally local-first and does not upload audio. The current UI and control model are ready for a native DSP or neural voice-conversion engine, but this free build does not claim 100% indistinguishable neural conversion without a dedicated model. Pitch/formant controls are exposed as the conversion layer contract so a native DSP module can be added without redesigning the product.

## Run locally

```bash
npm install
npx expo start
```

## Build an installable APK

The repository includes an EAS preview profile that produces an APK:

```bash
npx eas build --platform android --profile preview
```

An Expo/EAS login is required to execute the remote build. This session did not have a configured APK workflow action or EAS credential, so the project is build-ready but no APK artifact was generated here.
