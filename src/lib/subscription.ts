import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function getSubscription(email: string) {
  const ref = doc(db, 'subscriptions', email);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}
