import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(bodyParser.json());

  // Firebase Admin
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(


      )
    });
  }

  const db = admin.firestore();

  // =========================
  // WEBHOOK YAMPI
  // =========================
  app.post("/api/yampi-webhook", async (req, res) => {
    try {
      const event = req.body.event;

      if (event !== "Pedido pago") {
        return res.status(200).send("ignored");
      }

      const email = req.body.customer?.email;
      const productName = req.body.order_items?.[0]?.name;

      let plan = "monthly";

      if (productName?.toLowerCase().includes("anual")) {
        plan = "yearly";
      }

      await db.collection("subscriptions").doc(email).set({
        email,
        plan,
        status: "active",
        createdAt: new Date()
      });

      console.log("Assinatura salva:", email, plan);

      res.status(200).send("ok");
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).send("error");
    }
  });

  // =========================
  // SUA API EXISTENTE
  // =========================

  // API Proxy for Vagalume
  app.get("/api/vagalume/search", async (req, res) => {
    const { q } = req.query;
    const query = (q as string || "").trim();
    
    let artistParam = "";
    let songParam = "";
    const separators = [" - ", " – ", " — ", " by ", " de "];
    
    for (const sep of separators) {
      if (query.includes(sep)) {
        const parts = query.split(sep).map(s => s.trim());
        if (sep === " by " || sep === " de ") {
          [songParam, artistParam] = parts;
        } else {
          [artistParam, songParam] = parts;
        }
        break;
      }
    }

    const endpoints = [];
    
    if (artistParam && songParam) {
      endpoints.push(`https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artistParam)}&mus=${encodeURIComponent(songParam)}&apikey=6670601bde9753e4945b783bdf36c9d1`);
      endpoints.push(`https://www.vagalume.com.br/api/search.php?art=${encodeURIComponent(artistParam)}&mus=${encodeURIComponent(songParam)}`);
    }
    
    endpoints.push(`https://api.vagalume.com.br/search.php?q=${encodeURIComponent(query)}&apikey=6670601bde9753e4945b783bdf36c9d1`);
    endpoints.push(`https://www.vagalume.com.br/api/search.php?q=${encodeURIComponent(query)}`);

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json"
          }
        });
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data && data.type !== 'notfound') {
            return res.json(data);
          }
        }
      } catch (error) {
        console.error(`Proxy error Vagalume search (${url}):`, error);
      }
    }
    res.status(404).json({ error: "Música não encontrada", type: "notfound" });
  });

  // =========================
  // VITE / BUILD
  // =========================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });


  app.get("/api/check-subscription", async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res.json({ active: false });
    }

    const doc = await db.collection("subscriptions").doc(email).get();

    if (!doc.exists) {
      return res.json({ active: false });
    }

    const data = doc.data();

    res.json({
      active: data?.status === "active",
      plan: data?.plan
    });
  } catch (error) {
    res.status(500).json({ active: false });
  }
});


}

startServer();