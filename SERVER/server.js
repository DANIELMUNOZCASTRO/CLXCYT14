const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;


// raíz del proyecto (un nivel arriba de /server)
const rootDir = path.join(__dirname, "..");

// carpetas
const recursosDir = path.join(rootDir, "RECURSOS");
const respaldoDir = path.join(rootDir, "RESPALDO");

// crear carpetas si no existen
if (!fs.existsSync(recursosDir)) fs.mkdirSync(recursosDir, { recursive: true });
if (!fs.existsSync(respaldoDir)) fs.mkdirSync(respaldoDir, { recursive: true });

// Multer -> guarda en RECURSOS
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, recursosDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.\-()\s]/g, "_");
    cb(null, Date.now() + "_" + safeName);
  },
});
const upload = multer({ storage });

// Static folders
app.use("/CSS", express.static(path.join(rootDir, "CSS")));
app.use("/JS", express.static(path.join(rootDir, "JS")));
app.use("/RECURSOS", express.static(path.join(rootDir, "RECURSOS")));
app.use("/HTML", express.static(path.join(rootDir, "HTML")));

// Home
app.get("/", (req, res) => res.redirect("/HTML/login.html"));

// Upload
app.post("/api/upload", upload.array("files"), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No se recibieron archivos" });
  }
  res.json({ ok: true, saved: req.files.map((f) => f.filename) });
});

// Listar SOLO RECURSOS (lo que el usuario ve)
app.get("/api/files", (req, res) => {
  fs.readdir(recursosDir, (err, files) => {
    if (err) return res.status(500).json({ error: "No se pudo leer RECURSOS" });
    const filtrados = files.filter((f) => !f.toLowerCase().includes("logo_"));
    res.json({ files: filtrados });
  });
});

// ✅ MOVER A RESPALDO (en vez de eliminar)
app.post("/api/move-to-respaldo/:filename", (req, res) => {
  const raw = req.params.filename;
  const filename = path.basename(decodeURIComponent(raw));

  const fromPath = path.join(recursosDir, filename);
  const toPath = path.join(respaldoDir, filename);

  if (!fs.existsSync(fromPath)) {
    return res.status(404).json({
      error: "Archivo no encontrado en RECURSOS",
      filename,
      fromPath
    });
  }

  // Si ya existe en respaldo, renombra para no sobreescribir
  let finalToPath = toPath;
  if (fs.existsSync(finalToPath)) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    finalToPath = path.join(respaldoDir, `${base}_respaldo_${Date.now()}${ext}`);
  }

  fs.rename(fromPath, finalToPath, (err) => {
    if (err) {
      return res.status(500).json({
        error: "No se pudo mover a RESPALDO",
        code: err.code,
        message: err.message
      });
    }
    res.json({ ok: true, movedTo: finalToPath });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor listo: http://localhost:${PORT}`);
});
