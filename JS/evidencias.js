const form = document.getElementById("uploadForm");
const statusEl = document.getElementById("status");
const filesBody = document.getElementById("filesBody");

const viewerFrame = document.getElementById("viewerFrame");
const viewerName = document.getElementById("viewerName");

function isPreviewableByUrl(url) {
  const u = (url || "").toLowerCase();
  return (
    u.endsWith(".pdf") ||
    u.endsWith(".png") ||
    u.endsWith(".jpg") ||
    u.endsWith(".jpeg") ||
    u.endsWith(".webp") ||
    u.endsWith(".gif")
  );
}

function setPreview(file) {
  const name = file.filename || "Archivo";
  const url = file.secure_url;

  viewerName.textContent = name;

  if (url && isPreviewableByUrl(url)) {
    viewerFrame.style.display = "block";
    viewerFrame.src = url;
  } else {
    // No se puede previsualizar en iframe -> abrir en nueva pestaña
    viewerFrame.style.display = "none";
    viewerFrame.src = "about:blank";
    if (url) window.open(url, "_blank");
  }
}

async function moverARespaldo(file) {
  const seguro = confirm(
    `¿Estás seguro?\n\nEl archivo se moverá a RESPALDO y ya no lo verás aquí:\n\n${file.filename}`
  );
  if (!seguro) return;

  // limpiar visor
  viewerFrame.src = "about:blank";
  viewerName.textContent = "Ningún archivo seleccionado";

  statusEl.textContent = "Moviendo a RESPALDO...";

  try {
    const res = await fetch("/api/move-to-respaldo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_id: file.public_id }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert("No se pudo mover: " + (data.error || "Error"));
      console.log("Detalle move:", data);
      statusEl.textContent = "";
      return;
    }

    statusEl.textContent = "Listo. Archivo movido a RESPALDO.";
    cargarLista();
  } catch (err) {
    alert("Error de conexión con el servidor");
    statusEl.textContent = "";
  }
}

async function cargarLista() {
  filesBody.innerHTML = `<tr><td colspan="2" class="muted">Cargando...</td></tr>`;

  try {
    const res = await fetch("/api/files");
    const data = await res.json().catch(() => ({}));
    const files = Array.isArray(data.files) ? data.files : [];

    if (files.length === 0) {
      filesBody.innerHTML = `<tr><td colspan="2" class="muted">No hay archivos aún.</td></tr>`;
      return;
    }

    filesBody.innerHTML = "";

    files.forEach((file) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = file.filename || "Archivo";

      const tdActions = document.createElement("td");
      tdActions.className = "actions-cell";

      const btnVer = document.createElement("button");
      btnVer.type = "button";
      btnVer.className = "btn-small";
      btnVer.textContent = "Ver";
      btnVer.onclick = () => setPreview(file);

      const aDown = document.createElement("a");
      aDown.className = "btn-small outline";
      aDown.textContent = "Abrir";
      aDown.href = file.secure_url;
      aDown.target = "_blank";
      aDown.rel = "noopener";

      const btnMove = document.createElement("button");
      btnMove.type = "button";
      btnMove.className = "btn-small danger";
      btnMove.textContent = "Eliminar";
      btnMove.onclick = () => moverARespaldo(file);

      tdActions.append(btnVer, aDown, btnMove);
      tr.append(tdName, tdActions);
      tr.appendChild(tdActions);
      filesBody.appendChild(tr);
    });
  } catch (e) {
    filesBody.innerHTML = `<tr><td colspan="2" class="muted">No se pudo cargar la lista.</td></tr>`;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const input = document.getElementById("files");
  if (!input.files || input.files.length === 0) return;

  const fd = new FormData();
  for (const file of input.files) fd.append("files", file);

  statusEl.textContent = "Subiendo...";

  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      statusEl.textContent = "Error: " + (data.error || "No se pudo subir");
      console.log("Detalle upload:", data);
      return;
    }

    statusEl.textContent = "Listo. Archivos guardados en la nube.";
    input.value = "";
    cargarLista();
  } catch (err) {
    statusEl.textContent = "Error de conexión con el servidor.";
  }
});

cargarLista();
