#!/usr/bin/env ts-node
/**
 * Image Migration Script
 * Downloads images from Glide storage URLs and uploads to Firebase Storage.
 *
 * Usage: npx ts-node scripts/migrate-images.ts [--dry-run]
 *
 * Environment:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json
 *   FIREBASE_STORAGE_BUCKET=mooviz-app-9b766.appspot.com (or mooviz-prod.firebasestorage.app)
 */

import * as admin from 'firebase-admin';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'mooviz-app-9b766.appspot.com';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket,
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect with no location header'));
          return;
        }
        downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

function detectContentType(filePath: string): string {
  try {
    const buffer = fs.readFileSync(filePath, { flag: 'r' });
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
    if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif';
    if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'image/webp';
  } catch {
    // fallback
  }
  if (filePath.includes('.png')) return 'image/png';
  if (filePath.includes('.gif')) return 'image/gif';
  if (filePath.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function migrateImages(dryRun: boolean): Promise<void> {
  console.log('=== Image Migration ===');
  console.log(`  Storage bucket: ${storageBucket}\n`);

  // Get all migrated users with profile photos or KYC docs
  const users = await db.collection('users')
    .where('migratedFrom', '==', 'glide')
    .get();

  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  const tmpDir = path.join(os.tmpdir(), 'mooviz-migration');

  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  for (const doc of users.docs) {
    const data = doc.data();
    const uid = doc.id;

    // Migrate profile photo
    if (data.profilePhotoURL && data.profilePhotoURL.startsWith('http')) {
      // Only migrate external URLs (not already in Firebase Storage)
      const isExternalUrl = !data.profilePhotoURL.includes('firebasestorage.googleapis.com') &&
                            !data.profilePhotoURL.includes(`storage.googleapis.com/${bucket.name}`);

      if (isExternalUrl) {
        const tmpPath = path.join(tmpDir, `profile_${uid}.jpg`);
        const storagePath = `users/${uid}/profile.jpg`;

        if (dryRun) {
          console.log(`  [DRY] Would migrate profile photo for ${data.email}`);
          migrated++;
        } else {
          try {
            await downloadFile(data.profilePhotoURL, tmpPath);
            const contentType = detectContentType(tmpPath);
            await bucket.upload(tmpPath, {
              destination: storagePath,
              metadata: { contentType },
            });

            const [url] = await bucket.file(storagePath).getSignedUrl({
              action: 'read',
              expires: '2030-01-01',
            });

            await doc.ref.update({ profilePhotoURL: url });
            fs.unlinkSync(tmpPath);
            migrated++;
            console.log(`  [OK] Profile photo: ${data.email}`);
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.log(`  [ERR] Profile photo ${data.email}: ${message}`);
            errors++;
          }
        }
      } else {
        skipped++;
      }
    }

    // Migrate KYC document
    if (data.kycDocumentURL && data.kycDocumentURL.startsWith('http')) {
      const isExternalKyc = !data.kycDocumentURL.includes('firebasestorage.googleapis.com') &&
                            !data.kycDocumentURL.includes(`storage.googleapis.com/${bucket.name}`);

      if (isExternalKyc) {
        const tmpPath = path.join(tmpDir, `kyc_${uid}.jpg`);
        const storagePath = `kyc/${uid}/license.jpg`;

        if (dryRun) {
          console.log(`  [DRY] Would migrate KYC doc for ${data.email}`);
          migrated++;
        } else {
          try {
            await downloadFile(data.kycDocumentURL, tmpPath);
            const contentType = detectContentType(tmpPath);
            await bucket.upload(tmpPath, {
              destination: storagePath,
              metadata: { contentType },
            });

            const [url] = await bucket.file(storagePath).getSignedUrl({
              action: 'read',
              expires: '2030-01-01',
            });

            await doc.ref.update({ kycDocumentURL: url });
            fs.unlinkSync(tmpPath);
            migrated++;
            console.log(`  [OK] KYC doc: ${data.email}`);
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.log(`  [ERR] KYC doc ${data.email}: ${message}`);
            errors++;
          }
        }
      } else {
        skipped++;
      }
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }

  // Migrate delivery item photos
  const deliveries = await db.collection('deliveries')
    .where('migratedFrom', '==', 'glide')
    .get();

  for (const doc of deliveries.docs) {
    const data = doc.data();
    const photoURL = data.item?.photoURL as string | undefined;

    if (photoURL && photoURL.startsWith('http')) {
      const isExternal = !photoURL.includes('firebasestorage.googleapis.com') &&
                         !photoURL.includes(`storage.googleapis.com/${bucket.name}`);

      if (isExternal) {
        const tmpPath = path.join(tmpDir, `item_${doc.id}.jpg`);
        const storagePath = `deliveries/${data.senderId || doc.id}/item_${doc.id}.jpg`;

        if (dryRun) {
          console.log(`  [DRY] Would migrate item photo for delivery ${doc.id}`);
          migrated++;
        } else {
          try {
            await downloadFile(photoURL, tmpPath);
            const contentType = detectContentType(tmpPath);
            await bucket.upload(tmpPath, {
              destination: storagePath,
              metadata: { contentType },
            });

            const [url] = await bucket.file(storagePath).getSignedUrl({
              action: 'read',
              expires: '2030-01-01',
            });

            await doc.ref.update({ 'item.photoURL': url });
            fs.unlinkSync(tmpPath);
            migrated++;
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.log(`  [ERR] Item photo ${doc.id}: ${message}`);
            errors++;
          }
        }
      }
    }
  }

  // Cleanup
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`\nImages: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
}

const dryRun = process.argv.includes('--dry-run');
console.log('==========================================');
console.log('  MOOVIZ — Image Migration Script');
console.log('==========================================');
migrateImages(dryRun).then(() => {
  console.log('\n✅ Image migration complete!');
  process.exit(0);
}).catch((error) => {
  console.error('Image migration failed:', error);
  process.exit(1);
});
