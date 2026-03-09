#!/usr/bin/env node
/**
 * Set profile photos for demo users.
 * Usage: node scripts/set-avatars.js <email> <password>
 *
 * Run once per user:
 *   node scripts/set-avatars.js tamir.konor@gmail.com <pass>
 *   node scripts/set-avatars.js tamir@kal.solutions <pass>
 */
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, updateDoc } = require('firebase/firestore');

const app = initializeApp({
  apiKey: 'AIzaSyDpjIi8CHvmQyqareSSVVhHeYVqQvbfza0',
  authDomain: 'mooviz-app-9b766.firebaseapp.com',
  projectId: 'mooviz-app-9b766',
});
const auth = getAuth(app);
const db = getFirestore(app);

const AVATARS = {
  'tamir.konor@gmail.com': 'https://randomuser.me/api/portraits/men/32.jpg',
  'tamir@kal.solutions': 'https://randomuser.me/api/portraits/men/75.jpg',
};

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.log('Usage: node scripts/set-avatars.js <email> <password>');
    console.log('Supported emails:', Object.keys(AVATARS).join(', '));
    process.exit(1);
  }

  const photoURL = AVATARS[email];
  if (!photoURL) {
    console.error(`No avatar configured for ${email}`);
    process.exit(1);
  }

  const cred = await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as ${email} (uid: ${cred.user.uid})`);

  await updateDoc(doc(db, 'users', cred.user.uid), { profilePhotoURL: photoURL });
  console.log(`Set profilePhotoURL → ${photoURL}`);

  process.exit(0);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
