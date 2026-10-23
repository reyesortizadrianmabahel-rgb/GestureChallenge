
import {
    FilesetResolver,
    GestureRecognizer
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const camara = document.getElementById("camara");
const botonIniciar = document.getElementById("iniciar");
const botonReiniciar = document.getElementById("reiniciar");
const botonJugarDeNuevo = document.getElementById("jugarDeNuevo");

const puntosTexto = document.getElementById("puntos");
const tiempoTotalTexto = document.getElementById("tiempoTotal");
const numeroRetoTexto = document.getElementById("numeroReto");
const nombreGesto = document.getElementById("nombreGesto");
const descripcion = document.getElementById("descripcion");
const emojiGesto = document.getElementById("emojiGesto");
const tituloGesto = document.getElementById("tituloGesto");
const resultado = document.getElementById("resultado");
const posicion = document.getElementById("posicion");
const estado = document.getElementById("estado");
const mensaje = document.getElementById("mensaje");
const estadoCamara = document.getElementById("estadoCamara");
const barraTiempo = document.getElementById("barraTiempo");
const cuentaRegresiva = document.getElementById("cuentaRegresiva");
const resumen = document.getElementById("resumen");
const resultadoFinal = document.getElementById("resultadoFinal");
const botonAnterior = document.getElementById("anterior");
const botonSiguiente = document.getElementById("siguiente");

// Seis gestos que reconoce el modelo de MediaPipe.
const gestos = [
    {
        nombre: "Puño cerrado",
        emoji: "✊",
        codigo: "Closed_Fist",
        descripcion: "Cierra la mano formando un puño."
    },
    {
        nombre: "Palma abierta",
        emoji: "✋",
        codigo: "Open_Palm",
        descripcion: "Extiende todos los dedos."
    },
    {
        nombre: "Pulgar arriba",
        emoji: "👍",
        codigo: "Thumb_Up",
        descripcion: "Levanta el pulgar."
    },
    {
        nombre: "Pulgar abajo",
        emoji: "👎",
        codigo: "Thumb_Down",
        descripcion: "Dirige el pulgar hacia abajo."
    },
    {
        nombre: "Señal de paz",
        emoji: "✌️",
        codigo: "Victory",
        descripcion: "Levanta los dedos índice y medio."
    },
    {
        nombre: "Señalar arriba",
        emoji: "☝️",
        codigo: "Pointing_Up",
        descripcion: "Levanta únicamente el índice."
    }
];

let reconocedor = null;
let camaraActiva = false;
let jugando = false;
let preparando = false;
let indice = 0;
let puntos = 0;
let tiempoInicio = 0;
let finReto = 0;
let finPartida = 0;
let ultimoVideo = -1;
let gestoEstable = "";
let repeticiones = 0;
let ultimoTiempoReconocido = 0;
let bucleActivo = false;
let audio = null;
let temporizador = null;

const DURACION_RETO = 6000;
const DURACION_PARTIDA = 60000;

function sonido(frecuencia) {
    try {
        if (!audio) {
            audio = new AudioContext();
        }

        if (audio.state === "suspended") {
            audio.resume();
        }

        const oscilador = audio.createOscillator();
        const volumen = audio.createGain();

        oscilador.frequency.value = frecuencia;
        volumen.gain.value = 0.12;

        oscilador.connect(volumen);
        volumen.connect(audio.destination);

        oscilador.start();
        oscilador.stop(audio.currentTime + 0.12);
    } catch (error) {
        console.log("No se pudo reproducir el sonido.");
    }
}

async function prepararReconocedor() {
    if (reconocedor) {
        return;
    }

    estado.textContent = "Cargando reconocimiento de gestos...";
    mensaje.textContent = "Espera mientras se carga el modelo.";

    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    reconocedor = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task"
        },
        runningMode: "VIDEO",
        numHands: 1
    });
}

async function activarCamara() {
    if (camaraActiva) {
        return;
    }

    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {
        throw new Error("La cámara requiere HTTPS o localhost.");
    }

    const flujo = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 }
        }
    });

    camara.srcObject = flujo;
    await camara.play();

    camaraActiva = true;
    estadoCamara.textContent = "Cámara activa";
}

function mostrarGesto() {
    const gesto = gestos[indice];

    nombreGesto.textContent = gesto.nombre;
    emojiGesto.textContent = gesto.emoji;
    tituloGesto.textContent = gesto.nombre;
    descripcion.textContent = gesto.descripcion;
    posicion.textContent = "RETO " + (indice + 1) + " DE " + gestos.length;
    numeroRetoTexto.textContent = (indice + 1) + "/" + gestos.length;

    resultado.textContent = "Realiza el gesto antes de 6 segundos.";
    estado.textContent = "¡Haz el gesto!";
    cuentaRegresiva.textContent = "6 segundos";
    barraTiempo.style.width = "100%";
    barraTiempo.style.background = "#27dba0";

    gestoEstable = "";
    repeticiones = 0;
    ultimoTiempoReconocido = 0;
    ultimoVideo = -1;
}

function comenzarReto() {
    tiempoInicio = performance.now();
    finReto = tiempoInicio + DURACION_RETO;
    mostrarGesto();
}

function iniciarPartida() {
    if (jugando || preparando) {
        return;
    }

    preparando = true;
    botonIniciar.disabled = true;

    (async function() {
        try {
            await activarCamara();
            await prepararReconocedor();

            puntos = 0;
            indice = 0;
            jugando = true;
            preparando = false;

            resumen.hidden = true;
            botonIniciar.hidden = true;
            botonReiniciar.hidden = true;
            puntosTexto.textContent = "0";

            finPartida = performance.now() + DURACION_PARTIDA;

            comenzarReto();

            if (!bucleActivo) {
                bucleActivo = true;
                requestAnimationFrame(actualizar);
            }

            mensaje.textContent = "¡Adelante! Mantén la mano visible.";
            sonido(700);

        } catch (error) {
            preparando = false;
            botonIniciar.disabled = false;
            estado.textContent = "No se pudo iniciar";
            mensaje.textContent = error.message ||
                "Revisa el permiso de cámara y tu conexión a Internet.";
            console.error(error);
        }
    })();
}

function actualizar() {
    const ahora = performance.now();

    if (jugando) {
        if (ahora >= finPartida) {
            terminarPartida();
        } else {
            actualizarRelojPartida(ahora);
            reconocerGesto(ahora);

            if (jugando && ahora >= finReto) {
                fallarReto();
            }
        }
    }

    if (jugando) {
        requestAnimationFrame(actualizar);
    } else {
        bucleActivo = false;
    }
}

function actualizarRelojPartida(ahora) {
    const segundos = Math.max(
        0,
        Math.ceil((finPartida - ahora) / 1000)
    );

    tiempoTotalTexto.textContent = segundos + " s";
}

function reconocerGesto(ahora) {
    if (!reconocedor || camara.readyState < 2) {
        return;
    }

    if (camara.currentTime === ultimoVideo) {
        return;
    }

    ultimoVideo = camara.currentTime;

    try {
        const deteccion = reconocedor.recognizeForVideo(
            camara,
            ahora
        );

        if (!deteccion.gestures || deteccion.gestures.length === 0) {
            gestoEstable = "";
            repeticiones = 0;
            return;
        }

        const mejor = deteccion.gestures[0][0];

        if (!mejor || mejor.categoryName === "None" ||
            mejor.score < 0.65) {
            gestoEstable = "";
            repeticiones = 0;
            return;
        }

        const codigo = mejor.categoryName;

        if (codigo === gestoEstable) {
            repeticiones++;
        } else {
            gestoEstable = codigo;
            repeticiones = 1;
        }

        // Exigimos varias detecciones consecutivas para evitar
        // que una clasificación momentánea dé puntos por error.
        if (repeticiones >= 3 &&
            ahora - ultimoTiempoReconocido > 500) {
            ultimoTiempoReconocido = ahora;
            comprobarGesto(codigo, ahora);
        }

    } catch (error) {
        console.error("Error al reconocer la mano:", error);
    }
}

function comprobarGesto(codigo, ahora) {
    if (!jugando) {
        return;
    }

    const gestoCorrecto = gestos[indice];

    if (codigo === gestoCorrecto.codigo) {
        const tiempoTardado = Math.min(
            6,
            (ahora - tiempoInicio) / 1000
        );

        const puntosGanados = Math.max(
            10,
            Math.round(100 * (1 - tiempoTardado / 7))
        );

        puntos += puntosGanados;
        puntosTexto.textContent = puntos;

        resultado.textContent =
            "¡Correcto! Tardaste " +
            tiempoTardado.toFixed(2) +
            " segundos. +" + puntosGanados + " puntos.";

        estado.textContent = "¡GESTO CORRECTO!";
        mensaje.textContent = "¡Muy bien, sigue con el siguiente!";
        sonido(950);

        indice++;

        if (indice >= gestos.length) {
            terminarPartida();
        } else {
            avanzarReto();
        }
    } else {
        mensaje.textContent = "Gesto detectado, pero no es el solicitado.";
    }
}

function fallarReto() {
    if (!jugando) {
        return;
    }

    resultado.textContent = "Se acabó el tiempo. +0 puntos.";
    estado.textContent = "¡Tiempo agotado!";
    mensaje.textContent = "Vamos al siguiente gesto.";
    sonido(220);

    indice++;

    if (indice >= gestos.length) {
        terminarPartida();
    } else {
        avanzarReto();
    }
}

function avanzarReto() {
    // Pausa breve para separar las detecciones entre retos.
    jugando = false;

    setTimeout(function() {
        if (!preparando && indice < gestos.length &&
            resumen.hidden) {
            comenzarReto();
            jugando = true;

            if (!bucleActivo) {
                bucleActivo = true;
                requestAnimationFrame(actualizar);
            }
        }
    }, 800);
}

function terminarPartida() {
    jugando = false;
    preparando = false;

    clearInterval(temporizador);

    estado.textContent = "Partida terminada";
    cuentaRegresiva.textContent = "¡Fin!";
    barraTiempo.style.width = "0%";

    resumen.hidden = false;
    resultadoFinal.textContent =
        "Obtuviste " + puntos + " puntos de un máximo aproximado de 600.";

    botonReiniciar.hidden = true;
    botonJugarDeNuevo.hidden = false;
    botonIniciar.hidden = true;

    mensaje.textContent = "¡Gracias por jugar!";
    sonido(600);

    // Liberar la cámara al terminar.
    if (camara.srcObject) {
        camara.srcObject.getTracks().forEach(function(pista) {
            pista.stop();
        });

        camara.srcObject = null;
        camaraActiva = false;
        estadoCamara.textContent = "Cámara apagada";
    }
}

function reiniciarJuego() {
    jugando = false;
    preparando = false;

    if (camara.srcObject) {
        camara.srcObject.getTracks().forEach(function(pista) {
            pista.stop();
        });

        camara.srcObject = null;
    }

    camaraActiva = false;
    puntos = 0;
    indice = 0;

    puntosTexto.textContent = "0";
    tiempoTotalTexto.textContent = "60 s";
    numeroRetoTexto.textContent = "0/6";

    resumen.hidden = true;
    botonIniciar.hidden = false;
    botonIniciar.disabled = false;
    botonReiniciar.hidden = true;
    botonJugarDeNuevo.hidden = true;

    estado.textContent = "¿Listo para jugar?";
    nombreGesto.textContent = "✋ Prepara tu mano";
    descripcion.textContent = "Presiona iniciar para comenzar.";
    emojiGesto.textContent = "✊";
    tituloGesto.textContent = "Puño cerrado";
    resultado.textContent = "Aquí aparecerá tu resultado.";
    posicion.textContent = "RETO 1 DE 6";
    cuentaRegresiva.textContent = "6 segundos";
    barraTiempo.style.width = "100%";
    estadoCamara.textContent = "Cámara apagada";
    mensaje.textContent = "Presiona iniciar para jugar.";

    bucleActivo = false;
}

botonIniciar.addEventListener("click", iniciarPartida);
botonReiniciar.addEventListener("click", reiniciarJuego);
botonJugarDeNuevo.addEventListener("click", reiniciarJuego);

// Las flechas sirven para consultar los gestos antes de jugar.
botonAnterior.addEventListener("click", function() {
    if (jugando || preparando) return;
    indice = (indice - 1 + gestos.length) % gestos.length;
    mostrarGesto();
});

botonSiguiente.addEventListener("click", function() {
    if (jugando || preparando) return;
    indice = (indice + 1) % gestos.length;
    mostrarGesto();
});
