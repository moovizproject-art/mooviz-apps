#!/usr/bin/env node
/**
 * Quick script to update demo user avatar URLs in Firestore.
 * Usage: node scripts/update-demo-avatars.js
 */
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyDpjIi8CHvmQyqareSSVVhHeYVqQvbfza0',
  authDomain: 'mooviz-app-9b766.firebaseapp.com',
  projectId: 'mooviz-app-9b766',
  storageBucket: 'mooviz-app-9b766.firebasestorage.app',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const AVATARS = {
  'tamir.konor@gmail.com': 'https://randomuser.me/api/portraits/men/32.jpg',
  'tamir@kal.solutions': 'https://randomuser.me/api/portraits/men/75.jpg',
};

async function main() {
  const email = process.argv[2] || 'tamir.konor@gmail.com';
  const password = process.argv[3];
  if (!password) {
    console.error('Usage: node scripts/update-demo-avatars.js <email> <password>');
    process.exit(1);
  }

  const cred = await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as ${email} (${cred.user.uid})`);

  const avatarUrl = AVATARS[email];
  if (avatarUrl) {
    await updateDoc(doc(db, 'users', cred.user.uid), { profilePhotoURL: avatarUrl });
    console.log(`Updated avatar for ${email}: ${avatarUrl}`);
  }

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
