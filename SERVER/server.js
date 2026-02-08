const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 3000;

// ====== Config OAuth (por variables de entorno) ======
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback";

// Folder ID de Google Drive (la carpeta donde guardar evidencias)
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || "";

// Token (lo generas una vez local, luego lo pegas en Render)
const GOOGLE_TOKEN_JSON = process.env.GOOGLE_TOKEN_JSON || ""; // string JSON

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

function ensureConfigured() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return { ok: false, msg: "Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI" };
  }
  if (!DRIVE_FOLDER_ID) {
    return { ok: false, msg: "Falta DRIVE_FOLDER_ID (ID de carpeta de Google Drive)" };
  }
  return { ok: true };
}

function ensureAuthed() {
  if (!GOOGLE_TOKEN_JSON) return false;
  try {
    const token = JSON.parse(GOOGLE_TOKEN_JSON);
    oauth2Client.setCredentials(token);
    return true;
  } catch {
    return false;
  }
}

const drive = google.drive({ version: "v3", auth: oauth2Client });

// ====== Static folders desde la raíz ======
const rootDir = path.join(__dirname, "..");
app.use("/CSS", express.static(path.join(rootDir, "CSS")));
app.use("/JS", express.static(path.join(rootDir, "JS")));
app.use("/HTML", express.static(path.join(rootDir, "HTML")));
app.use("/RECURSOS", express.static(path.join(rootDir, "RECURSOS"))); // por si aún usas logos ahí

app.get("/", (req, res) => res.redirect("/HTML/login.html"));

// ====== OAuth: iniciar login ======
app.get("/auth/google", (req, res) => {
  const cfg = ensureConfigured();
  if (!cfg.ok) return res.status(500).send(cfg.msg);

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
  });
  res.redirect(url);
});

// ====== OAuth: callback (aquí Google regresa con code) ======
app.get("/oauth2callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send("Falta code");

    const { tokens } = await oauth2Client.getToken(code);
    // IMPORTANTE: aquí se imprime el token para que lo copies y lo metas a Render
    console.log("=== COPIA ESTE TOKEN Y GUARDALO EN GOOGLE_TOKEN_JSON ===");
    console.log(JSON.stringify(tokens));
    console.log("=== FIN TOKEN ===");

    res.send(
      "Autorización lista. Revisa la consola/terminal del servidor, copia el TOKEN y pégalo en Render como GOOGLE_TOKEN_JSON."
    );
  } catch (e) {
    res.status(500).send("Error en OAuth: " + (e?.message || "desconocido"));
  }
});

// ====== Multer temporal (en memoria) ======
const upload = multer({ storage: multer.memoryStorage() });

// ====== API: subir a Drive ======
app.post("/api/upload", upload.array("files"), async (req, res) => {
  const cfg = ensureConfigured();
  if (!cfg.ok) return res.status(500).json({ error: cfg.msg });

  if (!ensureAuthed()) {
    return res.status(401).json({ error: "No autorizado. Entra a /auth/google primero." });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No se recibieron archivos" });
  }

  try {
    const saved = [];

    for (const file of req.files) {
      const response = await drive.files.create({
        requestBody: {
          name: file.originalname,
          parents: [DRIVE_FOLDER_ID],
        },
        media: {
          mimeType: file.mimetype,
          body: require("stream").Readable.from(file.buffer),
        },
        fields: "id,name,webViewLink",
      });

      saved.push(response.data);
    }

    res.json({ ok: true, saved });
  } catch (e) {
    res.status(500).json({ error: "Error subiendo a Drive", message: e?.message });
  }
});

// ====== API: listar Drive ======
app.get("/api/files", async (req, res) => {
  const cfg = ensureConfigured();
  if (!cfg.ok) return res.status(500).json({ error: cfg.msg });

  if (!ensureAuthed()) {
    return res.status(401).json({ error: "No autorizado. Entra a /auth/google primero." });
  }

  try {
    const r = await drive.files.list({
      q: `'${DRIVE_FOLDER_ID}' in parents and trashed=false`,
      fields: "files(id,name,webViewLink,createdTime)",
      orderBy: "createdTime desc",
    });

    res.json({ files: r.data.files || [] });
  } catch (e) {
    res.status(500).json({ error: "Error listando Drive", message: e?.message });
  }
});

// ====== “Eliminar” = mover a papelera de Drive (trashed=true) ======
app.post("/api/move-to-respaldo/:fileId", async (req, res) => {
  const cfg = ensureConfigured();
  if (!cfg.ok) return res.status(500).json({ error: cfg.msg });

  if (!ensureAuthed()) {
    return res.status(401).json({ error: "No autorizado. Entra a /auth/google primero." });
  }

  const fileId = req.params.fileId;

  try {
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "No se pudo mover a papelera", message: e?.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor listo: http://localhost:${PORT}`);
  console.log(`OAuth iniciar: http://localhost:${PORT}/auth/google`);
});
