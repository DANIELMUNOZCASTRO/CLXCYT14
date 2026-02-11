const express = require("express");
const multer = require("multer");
const path = require("path");
const { Readable } = require("stream");
const cloudinary = require("cloudinary").v2;

const app = express();
const PORT = process.env.PORT || 3000;

// Cloudinary usa CLOUDINARY_URL (Render Environment)
console.log("CLOUDINARY_URL set:", !!process.env.CLOUDINARY_URL);
cloudinary.config({ secure: true });

// Static desde raíz del repo
const rootDir = path.join(__dirname, "..");
app.use("/CSS", express.static(path.join(rootDir, "CSS")));
app.use("/JS", express.static(path.join(rootDir, "JS")));
app.use("/HTML", express.static(path.join(rootDir, "HTML")));
app.use("/RECURSOS", express.static(path.join(rootDir, "RECURSOS"))); // logos

app.get("/", (req, res) => res.redirect("/HTML/login.html"));

// Multer en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Carpetas en Cloudinary
const FOLDER_RECURSOS = "CELEX/RECURSOS";
const FOLDER_RESPALDO = "CELEX/RESPALDO";

// Subida con nombre original + extensión
function uploadBufferToCloudinary({ buffer, filename }) {
  return new Promise((resolve, reject) => {
    const original = filename || "archivo";

    const ext = path.extname(original).toLowerCase().replace(".", ""); // pdf, jpg...
    const base = path
      .basename(original, path.extname(original))
      .replace(/[^\w\-()\s.]/g, "_")
      .trim()
      .replace(/\s+/g, "_");

    const safeBase = base || "archivo";
    const publicId = `${FOLDER_RECURSOS}/${Date.now()}_${safeBase}`; // evita colisiones

    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,        // fuerza nombre
        resource_type: "raw",
        format: ext || undefined,   // mantiene extensión
        overwrite: false,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    Readable.from(buffer).pipe(stream);
  });
}

// SUBIR
app.post("/api/upload", upload.array("files"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No se recibieron archivos" });
    }

    const saved = [];
    for (const f of req.files) {
      const r = await uploadBufferToCloudinary({
        buffer: f.buffer,
        filename: f.originalname,
      });

      saved.push({
        public_id: r.public_id,
        secure_url: r.secure_url,
        original_filename: f.originalname,
        format: path.extname(f.originalname).replace(".", "").toLowerCase(),
      });
    }

    res.json({ ok: true, saved });
  } catch (e) {
    console.error("UPLOAD ERROR:", e);
    res.status(500).json({ error: "Error subiendo a Cloudinary", message: e.message });
  }
});

// LISTAR
app.get("/api/files", async (req, res) => {
  try {
    const r = await cloudinary.search
      .expression(`folder:${FOLDER_RECURSOS} AND resource_type:raw`)
      .sort_by("created_at", "desc")
      .max_results(100)
      .execute();

    const files = (r.resources || []).map((x) => ({
      public_id: x.public_id,
      filename: `${x.original_filename || x.filename || x.public_id.split("/").pop()}.${x.format || ""}`.replace(/\.$/, ""),
      secure_url: x.secure_url,
      created_at: x.created_at,
      bytes: x.bytes,
    }));

    res.json({ files });
  } catch (e) {
    console.error("FILES ERROR:", e);
    res.status(500).json({ error: "Error listando Cloudinary", message: e.message });
  }
});

// “ELIMINAR” = mover a RESPALDO (rename)
app.post("/api/move-to-respaldo", express.json(), async (req, res) => {
  try {
    const { public_id } = req.body || {};
    if (!public_id) return res.status(400).json({ error: "Falta public_id" });

    const filename = public_id.split("/").pop();
    const toPublicId = `${FOLDER_RESPALDO}/${filename}`;

    const out = await cloudinary.uploader.rename(public_id, toPublicId, {
      resource_type: "raw",
      overwrite: false,
    });

    res.json({ ok: true, moved_to: out.public_id });
  } catch (e) {
    console.error("MOVE ERROR:", e);
    res.status(500).json({ error: "No se pudo mover a RESPALDO", message: e.message });
  }
});

app.listen(PORT, () => console.log(`Servidor listo: http://localhost:${PORT}`));
