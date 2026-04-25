import { NextApiRequest, NextApiResponse } from "next";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!)),
  });
}
const db = admin.firestore();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: "Missing email" });

  const snap = await db.collection("subscriptions").doc(email).get();
  if (!snap.exists) return res.json({ active: false });

  const data = snap.data();
  // Calcula vencimento (30 dias após createdAt)
  const createdAt = data?.createdAt?.toDate ? data.createdAt.toDate() : new Date(data?.createdAt);
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(createdAt.getDate() + 30);

  const active = data?.status === "active" && expiresAt > new Date();

  res.json({
    active,
    expiresAt: expiresAt.toISOString(),
    plan: data?.plan || null,
  });
}


