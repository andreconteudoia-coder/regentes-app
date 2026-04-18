import { NextApiRequest, NextApiResponse } from "next";
import admin from "firebase-admin";

// Inicialize o Firebase Admin apenas uma vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!)),
  });
}
const db = admin.firestore();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const event = req.body.event;

    if (event !== "Pedido pago" && event !== "Pedido pago") {
      return res.status(200).send("ignored");
    }

  const email = req.body.resource?.customer?.data?.email;
  const productName = req.body.resource?.items?.data?.[0]?.product;

    let plan = "monthly";
    if (productName?.toLowerCase().includes("anual")) {
      plan = "yearly";
    }

    await db.collection("subscriptions").doc(email).set({
      email,
      plan,
      status: "active",
      createdAt: new Date(),
    });

    res.status(200).send("ok");
  } catch (error) {
    res.status(500).send("error");
  }
}
