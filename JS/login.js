document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const usuario = e.target.usuario.value.trim();
  const password = e.target.password.value.trim();

  if (usuario === "EdwinClx" && password === "123456") {
    window.location.href = "/HTML/inicio.html";
  } else {
    alert("Usuario o contraseña incorrectos");
  }
});