import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Proxy for Vagalume
  app.get("/api/vagalume/search", async (req, res) => {
    const { q } = req.query;
    const query = (q as string || "").trim();
    
    // Try to split if it looks like "Artist - Song" or "Song by Artist"
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
    
    // If we have artist and song, try direct lyrics fetch first as it's more reliable
    if (artistParam && songParam) {
      endpoints.push(`https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artistParam)}&mus=${encodeURIComponent(songParam)}&apikey=6670601bde9753e4945b783bdf36c9d1`);
      endpoints.push(`https://www.vagalume.com.br/api/search.php?art=${encodeURIComponent(artistParam)}&mus=${encodeURIComponent(songParam)}`);
    }
    
    // Then try general search
    endpoints.push(`https://api.vagalume.com.br/search.php?q=${encodeURIComponent(query)}&apikey=6670601bde9753e4945b783bdf36c9d1`);
    endpoints.push(`https://www.vagalume.com.br/api/search.php?q=${encodeURIComponent(query)}`);

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "application/json"
          }
        });
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          // Vagalume sometimes returns 200 with {type: 'notfound'}
          if (data && data.type !== 'notfound') {
            return res.json(data);
          }
        } else {
          const text = await response.text();
          try {
            const data = JSON.parse(text);
            if (data && data.type !== 'notfound') {
              return res.json(data);
            }
          } catch (e) {
            console.error(`Vagalume search returned non-JSON for ${url}:`, text.substring(0, 100));
          }
        }
      } catch (error) {
        console.error(`Proxy error Vagalume search (${url}):`, error);
      }
    }
    res.status(404).json({ error: "Música não encontrada no Vagalume", type: "notfound" });
  });

  app.get("/api/vagalume/artmus", async (req, res) => {
    const { q, limit } = req.query;
    const query = (q as string || "").trim();
    const endpoints = [
      `https://api.vagalume.com.br/search.artmus?q=${encodeURIComponent(query)}&limit=${limit || 5}`,
      `https://www.vagalume.com.br/api/search.artmus?q=${encodeURIComponent(query)}&limit=${limit || 5}`
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "application/json"
          }
        });
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data && !data.error) {
            return res.json(data);
          }
        } else {
          const text = await response.text();
          try {
            const data = JSON.parse(text);
            if (data && !data.error) {
              return res.json(data);
            }
          } catch (e) {
            console.error(`Vagalume artmus returned non-JSON for ${url}:`, text.substring(0, 100));
          }
        }
      } catch (error) {
        console.error(`Proxy error Vagalume artmus (${url}):`, error);
      }
    }
    res.status(404).json({ error: "Nenhum artista ou música encontrado no Vagalume", type: "notfound" });
  });

  app.get("/api/vagalume/lyrics", async (req, res) => {
    const { art, mus } = req.query;
    const artist = (art as string || "").trim();
    const song = (mus as string || "").trim();
    
    const endpoints = [
      `https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artist)}&mus=${encodeURIComponent(song)}&apikey=6670601bde9753e4945b783bdf36c9d1`,
      `https://www.vagalume.com.br/api/search.php?art=${encodeURIComponent(artist)}&mus=${encodeURIComponent(song)}`
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "application/json"
          }
        });
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data && data.type !== 'notfound') {
            return res.json(data);
          }
        } else {
          const text = await response.text();
          try {
            const data = JSON.parse(text);
            if (data && data.type !== 'notfound') {
              return res.json(data);
            }
          } catch (e) {
            console.error(`Vagalume lyrics returned non-JSON for ${url}:`, text.substring(0, 100));
          }
        }
      } catch (error) {
        console.error(`Proxy error Vagalume lyrics (${url}):`, error);
      }
    }
    res.status(404).json({ error: "Letra não encontrada no Vagalume", type: "notfound" });
  });

  // Proxy for LRCLIB
  app.get("/api/lrclib", async (req, res) => {
    const { artist, title } = req.query;
    try {
      const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist as string || "")}&track_name=${encodeURIComponent(title as string || "")}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "MaestraCoral/1.0.0 (https://maestracoral.app)"
        }
      });
      if (!response.ok) {
        return res.status(response.status).json({ error: "Lyrics not found on LRCLIB" });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy error LRCLIB:", error);
      res.status(500).json({ error: "Failed to fetch from LRCLIB" });
    }
  });

  // Proxy for LRCLIB Search
  app.get("/api/lrclib/search", async (req, res) => {
    const { q } = req.query;
    try {
      const url = `https://lrclib.net/api/search?q=${encodeURIComponent(q as string || "")}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "MaestraCoral/1.0.0 (https://maestracoral.app)"
        }
      });
      if (!response.ok) {
        return res.status(response.status).json({ error: "Search failed on LRCLIB" });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy error LRCLIB search:", error);
      res.status(500).json({ error: "Failed to search on LRCLIB" });
    }
  });

  // Proxy for Lyrics.ovh
  app.get("/api/lyrics-ovh/suggest", async (req, res) => {
    const { q } = req.query;
    try {
      const url = `https://api.lyrics.ovh/suggest/${encodeURIComponent(q as string || "")}`;
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: "Suggestions not found" });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy error Lyrics.ovh suggest:", error);
      res.status(500).json({ error: "Failed to fetch suggestions from Lyrics.ovh" });
    }
  });

  app.get("/api/lyrics-ovh/:artist/:title", async (req, res) => {
    const { artist, title } = req.params;
    try {
      const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: "Lyrics not found" });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy error Lyrics.ovh:", error);
      res.status(500).json({ error: "Failed to fetch from Lyrics.ovh" });
    }
  });

  // Vite middleware for development
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
}

startServer();
