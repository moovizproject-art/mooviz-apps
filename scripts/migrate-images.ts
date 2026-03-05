#!/usr/bin/env ts-node
/**
 * Image Migration Script
 * Downloads images from Glide storage URLs and uploads to Firebase Storage.
 *
 * Usage: npx ts-node scripts/migrate-images.ts [--dry-run]
 */

import * as admin from 'firebase-admin';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket: 'mooviz-app-9b766.appspot.com',
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

async function migrateImages(dryRun: boolean): Promise<void> {
  console.log('=== Image Migration ===\n');

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
      const isGlideUrl = data.profilePhotoURL.includes('glide-prod') ||
                          data.profilePhotoURL.includes('pexels') ||
                          data.profilePhotoURL.includes('storage.googleapis.com');

      if (isGlideUrl) {
        const tmpPath = path.join(tmpDir, `profile_${uid}.jpg`);
        const storagePath = `profiles/${uid}/profile.jpg`;

        if (dryRun) {
          console.log(`  [DRY] Would migrate profile photo for ${data.email}`);
          migrated++;
        } else {
          try {
            await downloadFile(data.profilePhotoURL, tmpPath);
            await bucket.upload(tmpPath, {
              destination: storagePath,
              metadata: { contentType: 'image/jpeg' },
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
      const tmpPath = path.join(tmpDir, `kyc_${uid}.jpg`);
      const storagePath = `kyc/${uid}/license.jpg`;

      if (dryRun) {
        console.log(`  [DRY] Would migrate KYC doc for ${data.email}`);
        migrated++;
      } else {
        try {
          await downloadFile(data.kycDocumentURL, tmpPath);
          await bucket.upload(tmpPath, {
            destination: storagePath,
            metadata: { contentType: 'image/jpeg' },
          });

          await doc.ref.update({ kycDocumentURL: storagePath });
          fs.unlinkSync(tmpPath);
          migrated++;
          console.log(`  [OK] KYC doc: ${data.email}`);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`  [ERR] KYC doc ${data.email}: ${message}`);
          errors++;
        }
      }
    }
  }

  // Migrate delivery item photos
  const deliveries = await db.collection('deliveries')
    .where('migratedFrom', '==', 'glide')
    .get();

  for (const doc of deliveries.docs) {
    const data = doc.data();
    const photoURL = data.item?.photoURL as string | undefined;

    if (photoURL && photoURL.startsWith('http') && photoURL.includes('storage.googleapis.com')) {
      const tmpPath = path.join(tmpDir, `item_${doc.id}.jpg`);
      const storagePath = `deliveries/${doc.id}/item.jpg`;

      if (dryRun) {
        console.log(`  [DRY] Would migrate item photo for delivery ${doc.id}`);
        migrated++;
      } else {
        try {
          await downloadFile(photoURL, tmpPath);
          await bucket.upload(tmpPath, {
            destination: storagePath,
            metadata: { contentType: 'image/jpeg' },
          });

          await doc.ref.update({ 'item.photoURL': storagePath });
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

  // Cleanup
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`\nImages: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
}

const dryRun = process.argv.includes('--dry-run');
migrateImages(dryRun).then(() => {
  console.log('\nImage migration complete!');
  process.exit(0);
}).catch((error) => {
  console.error('Image migration failed:', error);
  process.exit(1);
});
