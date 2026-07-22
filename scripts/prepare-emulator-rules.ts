import { mkdir, readFile, writeFile } from 'node:fs/promises';

const source = await readFile('firestore.rules', 'utf8');
const emulatorRules = source.replace(
  /request\.auth\.uid == "[^"]+"/,
  'request.auth.uid == "YOUR_FIREBASE_OWNER_UID"',
);
await mkdir('.firebase', { recursive: true });
await writeFile('.firebase/firestore.test.rules', emulatorRules, 'utf8');
