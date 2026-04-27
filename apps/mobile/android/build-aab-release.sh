#!/usr/bin/env bash
# Build a Play Store-ready AAB with 16KB page size compliance.
#
# Usage (from apps/mobile/android/):
#   ./build-aab-release.sh
#
# Output: app/build/outputs/bundle/release/mooviz-<version>-play.aab
#
# Why the post-build pipeline is needed:
#   Play Store generates APKs from the AAB via bundletool and checks 16KB
#   alignment on those generated APKs. Three things must be true:
#     1. BundleConfig.pb has ALIGNMENT_16K  ← AGP 8.6.1 writes this automatically
#     2. All .so ELF PT_LOAD segments have p_align >= 16384  ← Gradle task does this
#     3. .so files are ZIP_STORED (uncompressed) in the AAB  ← step 3 below

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

KEYSTORE="/Users/devninja/projects/MoovizProject/keystores/mooviz-release.keystore"
KEY_ALIAS="mooviz-release"
STORE_PASS="Mooviz2026Release"
KEY_PASS="Mooviz2026Release"

AAB_RAW="app/build/outputs/bundle/release/app-release.aab"
AAB_UNCOMP="app/build/outputs/bundle/release/app-release-uncompressed.aab"

# ── Step 1: Clean build (includes ELF patch via patch16KbAlignment Gradle task) ──
echo "→ Step 1: Clean + bundleRelease"
./gradlew clean bundleRelease

# ── Step 2: Verify ELF alignment ──
echo ""
echo "→ Step 2: Verify ELF 16KB alignment"
python3 check_16kb.py "$AAB_RAW"

# ── Step 3: Uncompress .so files in AAB ──
echo ""
echo "→ Step 3: Uncompress .so files (ZIP_STORED)"
python3 fix_aab_playstore_16kb.py "$AAB_RAW" "$AAB_UNCOMP"

# ── Step 4: Re-sign (uncompressing strips the AGP signature) ──
echo ""
echo "→ Step 4: Re-sign with jarsigner"
jarsigner -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore "$KEYSTORE" \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" \
  "$AAB_UNCOMP" \
  "$KEY_ALIAS"

# ── Step 5: Final verification ──
echo ""
echo "→ Step 5: Final checks"
jarsigner -verify "$AAB_UNCOMP"
python3 check_16kb.py "$AAB_UNCOMP"
python3 - <<'PYEOF'
import zipfile, sys
aab = "app/build/outputs/bundle/release/app-release-uncompressed.aab"
with zipfile.ZipFile(aab) as z:
    so = [i for i in z.infolist() if i.filename.endswith('.so')]
    bad = [i for i in so if i.compress_type != 0]
    print(f"ZIP_STORED: {len(so)-len(bad)}/{len(so)} .so files")
    if bad:
        print(f"FAIL: {len(bad)} still compressed")
        sys.exit(1)
    print("All .so uncompressed ✓")
PYEOF

# ── Step 6: Versioned output file ──
VERSION=$(grep -m1 'versionName' app/build.gradle | grep -oE '"[^"]+"' | tr -d '"')
VERSION_CODE=$(grep -m1 'versionCode' app/build.gradle | grep -oE '[0-9]+')
OUTPUT="app/build/outputs/bundle/release/mooviz-${VERSION}-${VERSION_CODE}-play.aab"
cp "$AAB_UNCOMP" "$OUTPUT"

echo ""
echo "✅ Done: $OUTPUT"
ls -lh "$OUTPUT"
