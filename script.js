
const camara = document.getElementById("camara");
const boton = document.getElementById("iniciar");
const estado = document.getElementById("estado");

boton.addEventListener("click", async function() {
    try {
        const video = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user"
            },
            audio: false
        });

        camara.srcObject = video;
        await camara.play();

        estado.textContent = "Camara activada correctamente";
        boton.textContent = "Camara funcionando";
        boton.disabled = true;

    } catch (error) {
        estado.textContent = "No se pudo activar la camara";
        console.error(error);
    }
});
