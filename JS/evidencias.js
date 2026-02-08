const form = document.getElementById("uploadForm");
const statusEl = document.getElementById("status");
const filesBody = document.getElementById("filesBody");

const viewerFrame = document.getElementById("viewerFrame");
const viewerName = document.getElementById("viewerName");

function isPreviewable(filename){
  const f = filename.toLowerCase();
  return (
    f.endsWith(".pdf") ||
    f.endsWith(".png") ||
    f.endsWith(".jpg") ||
    f.endsWith(".jpeg") ||
    f.endsWith(".webp") ||
    f.endsWith(".gif")
  );
}

function setPreview(filename){
  viewerName.textContent = filename;
  const url = `/RECURSOS/${encodeURIComponent(filename)}`;

  if (isPreviewable(filename)) {
    viewerFrame.style.display = "block";
    viewerFrame.src = url;
  } else {
    viewerFrame.style.display = "none";
    viewerFrame.src = "about:blank";
    window.open(url, "_blank");
  }
}

async function moverARespaldo(filename){
  const seguro = confirm(`¿Estás seguro?\n\nEl archivo se moverá a RESPALDO y ya no lo verás aquí:\n\n${filename}`);
  if (!seguro) return;

  // libera visor
  viewerFrame.src = "about:blank";
  viewerName.textContent = "Ningún archivo seleccionado";

  statusEl.textContent = "Moviendo a RESPALDO...";

  try {
    const res = await fetch(`/api/move-to-respaldo/${encodeURIComponent(filename)}`, {
      method: "POST"
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
    const data = await res.json();
    const files = Array.isArray(data.files) ? data.files : [];

    if (files.length === 0) {
      filesBody.innerHTML = `<tr><td colspan="2" class="muted">No hay archivos aún.</td></tr>`;
      return;
    }

    filesBody.innerHTML = "";
    files.forEach((f) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = f;

      const tdActions = document.createElement("td");
      tdActions.className = "actions-cell";

      const btnVer = document.createElement("button");
      btnVer.type = "button";
      btnVer.className = "btn-small";
      btnVer.textContent = "Ver";
      btnVer.onclick = () => setPreview(f);

      const aDown = document.createElement("a");
      aDown.className = "btn-small outline";
      aDown.textContent = "Descargar";
      aDown.href = `/RECURSOS/${encodeURIComponent(f)}`;
      aDown.setAttribute("download", f);

      const btnMove = document.createElement("button");
      btnMove.type = "button";
      btnMove.className = "btn-small danger";
      btnMove.textContent = "Eliminar";
      btnMove.onclick = () => moverARespaldo(f);

      tdActions.append(btnVer, aDown, btnMove);
      tr.append(tdName, tdActions);
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
      return;
    }

    statusEl.textContent = "Listo. Archivos guardados en RECURSOS.";
    input.value = "";
    cargarLista();
  } catch (err) {
    statusEl.textContent = "Error de conexión con el servidor.";
  }
});

cargarLista();
