document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const usuario = e.target.usuario.value;
    const password = e.target.password.value;

    if (usuario === "EdwinClx" && password === "123456") {
        // Redirección correcta (mismo nivel HTML)
        window.location.href = "inicio.html";
    } else {
        alert("Usuario o contraseña incorrectos");
    }
});
