
import {
    FilesetResolver,
    GestureRecognizer
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const $ = id => document.getElementById(id);

const gestos = [
    { nombre: "Puño cerrado", emoji: "✊", codigo: "Closed_Fist",
      descripcion: "Cierra la mano formando un puño." },
    { nombre: "Palma abierta", emoji: "✋", codigo: "Open_Palm",
      descripcion: "Extiende los dedos y muestra la palma." },
    { nombre: "Pulgar arriba", emoji: "👍", codigo: "Thumb_Up",
      descripcion: "Levanta el pulgar." },
    { nombre: "Pulgar abajo", emoji: "👎", codigo: "Thumb_Down",
      descripcion: "Dirige el pulgar hacia abajo." },
    { nombre: "Señal de paz", emoji: "✌️", codigo: "Victory",
      descripcion: "Levanta el índice y el dedo medio." },
    { nombre: "Señalar arriba", emoji: "☝️", codigo: "Pointing_Up",
      descripcion: "Levanta el dedo índice." }
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
let gestoAnterior = "";
let repeticiones = 0;
let audio = null;
let raf = null;
let esperaReto = null;
let puntuacionRetos = [];

const DURACION_RETO = 6000;
const DURACION_PARTIDA = 60000;

function sonido(frecuencia) {
    try {
        if (!audio) audio = new AudioContext();
        if (audio.state === "suspended") audio.resume();

        const oscilador = audio.createOscillator();
        const volumen = audio.createGain();

        oscilador.frequency.value = frecuencia;
        volumen.gain.value = 0.10;
        oscilador.connect(volumen);
        volumen.connect(audio.destination);
        oscilador.start();
        oscilador.stop(audio.currentTime + 0.14);
    } catch (error) {
        console.log("Audio no disponible", error);
    }
}

async function prepararReconocedor() {
    if (reconocedor) return;

    $("mensaje").textContent = "Cargando el reconocedor de gestos...";

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
    if (camaraActiva) return;

    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Abre el juego con HTTPS o desde localhost.");
    }

    const flujo = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 }
        }
    });

    $("camara").srcObject = flujo;
    await $("camara").play();

    camaraActiva = true;
    $("camaraVacia").hidden = true;
    $("estadoCamara").textContent = "ACTIVA";
}

function dibujarSecuencia() {
    $("listaGestos").innerHTML = "";

    gestos.forEach((gesto, i) => {
        const tarjeta = document.createElement("div");
        tarjeta.className = "gesto-mini";
        tarjeta.id = "mini-" + i;

        const emoji = document.createElement("div");
        emoji.className = "mini-emoji";
        emoji.textContent = gesto.emoji;

        const titulo = document.createElement("strong");
        titulo.textContent = gesto.nombre;

        const estado = document.createElement("small");
        estado.id = "mini-estado-" + i;
        estado.textContent = "Pendiente";

        tarjeta.append(emoji, titulo, estado);
        $("listaGestos").appendChild(tarjeta);
    });
}

function mostrarReto() {
    const gesto = gestos[indice];

    $("nombreGesto").textContent = gesto.nombre;
    $("emojiGesto").textContent = gesto.emoji;
    $("tituloGesto").textContent = gesto.nombre;
    $("descripcion").textContent = gesto.descripcion;
    $("numeroReto").textContent = indice + "/6";
    $("insigniaReto").textContent = "RETO " + (indice + 1);
    $("resultado").textContent = "Realiza el gesto antes de 6 segundos.";
    $("cuentaRegresiva").textContent = "6.0 s";
    $("barraTiempo").style.width = "100%";
    $("mensaje").textContent = "Coloca la mano frente a la cámara.";

    document.querySelectorAll(".gesto-mini").forEach((el, i) => {
        el.classList.toggle("actual", i === indice);
    });

    gestoAnterior = "";
    repeticiones = 0;
    ultimoVideo = -1;
}

async function iniciarJuego() {
    if (jugando || preparando) return;

    preparando = true;
    $("iniciar").disabled = true;

    try {
        await activarCamara();
        await prepararReconocedor();

        indice = 0;
        puntos = 0;
        puntuacionRetos = [];
        jugando = true;
        preparando = false;

        $("puntos").textContent = "0";
        $("numeroReto").textContent = "0/6";
        $("tiempoTotal").innerHTML = '60<span class="unidad"> s</span>';
        $("resumen").hidden = true;
        $("iniciar").hidden = true;
        $("reiniciar").hidden = false;

        finPartida = performance.now() + DURACION_PARTIDA;
        comenzarReto();
        sonido(700);
        raf = requestAnimationFrame(actualizar);

    } catch (error) {
        preparando = false;
        $("iniciar").disabled = false;
        $("mensaje").textContent =
            error.message || "No se pudo iniciar. Revisa la cámara y la conexión.";
        console.error(error);
    }
}

function comenzarReto() {
    tiempoInicio = performance.now();
    finReto = tiempoInicio + DURACION_RETO;
    mostrarReto();
}

function actualizar() {
    if (!jugando) {
        raf = null;
        return;
    }

    const ahora = performance.now();

    if (ahora >= finPartida) {
        terminarJuego();
        return;
    }

    const restantePartida = Math.ceil((finPartida - ahora) / 1000);
    $("tiempoTotal").innerHTML =
        restantePartida + '<span class="unidad"> s</span>';

    const restanteReto = Math.max(0, finReto - ahora);
    $("cuentaRegresiva").textContent =
        (restanteReto / 1000).toFixed(1) + " s";

    $("barraTiempo").style.width =
        (restanteReto / DURACION_RETO * 100) + "%";

    $("barraTiempo").style.background =
        restanteReto < 2000 ? "#ff7676" : "#45e0bd";

    reconocer(ahora);

    if (jugando && ahora >= finReto) {
        fallarReto();
    }

    if (jugando) raf = requestAnimationFrame(actualizar);
    else raf = null;
}

function reconocer(ahora) {
    const video = $("camara");

    if (!reconocedor || video.readyState < 2 ||
        video.currentTime === ultimoVideo) return;

    ultimoVideo = video.currentTime;

    try {
        const salida = reconocedor.recognizeForVideo(video, ahora);
        const lista = salida.gestures?.[0];

        if (!lista?.length || lista[0].score < 0.65 ||
            lista[0].categoryName === "None") {
            gestoAnterior = "";
            repeticiones = 0;
            return;
        }

        const codigo = lista[0].categoryName;

        if (codigo === gestoAnterior) {
            repeticiones++;
        } else {
            gestoAnterior = codigo;
            repeticiones = 1;
        }

        if (repeticiones >= 3) comprobarGesto(codigo, ahora);
    } catch (error) {
        console.error("Error al reconocer el gesto", error);
    }
}

function comprobarGesto(codigo, ahora) {
    if (!jugando || codigo !== gestos[indice].codigo) return;

    const tardanza = Math.min(6, (ahora - tiempoInicio) / 1000);
    const ganado = Math.max(10, Math.round(100 * (1 - tardanza / 7)));

    puntos += ganado;
    puntuacionRetos[indice] = ganado;
    $("puntos").textContent = puntos;
    $("resultado").textContent =
        "¡Correcto! " + tardanza.toFixed(2) +
        " segundos. +" + ganado + " puntos.";
    $("insigniaReto").textContent = "¡ACIERTO!";
    $("mensaje").textContent = "¡Bien hecho! Preparando el siguiente reto.";

    $("mini-" + indice).classList.add("completado");
    $("mini-estado-" + indice).textContent =
        tardanza.toFixed(2) + " s · +" + ganado;

    sonido(950);
    pasarAlSiguiente();
}

function fallarReto() {
    if (!jugando) return;

    $("resultado").textContent = "Tiempo agotado. +0 puntos.";
    $("insigniaReto").textContent = "TIEMPO";
    $("mini-estado-" + indice).textContent = "No completado";
    $("mensaje").textContent = "No pasa nada, vamos al siguiente reto.";
    sonido(230);
    pasarAlSiguiente();
}

function pasarAlSiguiente() {
    if (!jugando) return;

    // Evita aceptar detecciones del reto anterior durante la pausa.
    jugando = false;

    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;

    indice++;
    $("numeroReto").textContent = Math.min(indice, 6) + "/6";

    if (indice >= gestos.length) {
        terminarJuego();
        return;
    }

    esperaReto = setTimeout(() => {
        esperaReto = null;
        if ($("resumen").hidden) {
            comenzarReto();
            jugando = true;
            raf = requestAnimationFrame(actualizar);
        }
    }, 900);
}

function terminarJuego() {
    jugando = false;
    preparando = false;

    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;

    clearTimeout(esperaReto);
    esperaReto = null;

    $("resumen").hidden = false;
    $("resultadoFinal").textContent =
        puntos + " puntos · " + puntuacionRetos.filter(
            valor => valor !== undefined
        ).length + " de 6 retos completados";

    $("mensaje").textContent = "Partida finalizada. ¡Gracias por jugar!";
    $("insigniaReto").textContent = "FINAL";
    $("cuentaRegresiva").textContent = "Fin";
    $("barraTiempo").style.width = "0%";
    $("iniciar").hidden = true;
    $("reiniciar").hidden = false;

    sonido(600);
    apagarCamara();
}

function apagarCamara() {
    const video = $("camara");

    if (video.srcObject) {
        video.srcObject.getTracks().forEach(pista => pista.stop());
        video.srcObject = null;
    }

    camaraActiva = false;
    $("camaraVacia").hidden = false;
    $("estadoCamara").textContent = "APAGADA";
}

function reiniciarJuego() {
    jugando = false;
    preparando = false;

    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;

    clearTimeout(esperaReto);
    esperaReto = null;

    apagarCamara();

    indice = 0;
    puntos = 0;
    puntuacionRetos = [];

    $("puntos").textContent = "0";
    $("numeroReto").textContent = "0/6";
    $("tiempoTotal").innerHTML = '60<span class="unidad"> s</span>';
    $("resumen").hidden = true;
    $("iniciar").hidden = false;
    $("iniciar").disabled = false;
    $("reiniciar").hidden = true;
    $("mensaje").textContent = "Presiona iniciar para jugar.";
    $("nombreGesto").textContent = "Prepara tu mano";
    $("emojiGesto").textContent = "✋";
    $("tituloGesto").textContent = "¡Prepárate!";
    $("descripcion").textContent = "Presiona iniciar para comenzar.";
    $("resultado").textContent = "Aquí aparecerá tu resultado.";
    $("cuentaRegresiva").textContent = "6.0 s";
    $("barraTiempo").style.width = "100%";
    $("insigniaReto").textContent = "LISTO";

    dibujarSecuencia();
}

function cambiarModo(aprendizaje) {
    if (jugando || preparando) {
        $("mensaje").textContent =
            "Termina o reinicia la partida antes de cambiar de modo.";
        return;
    }

    $("panelJuego").hidden = aprendizaje;
    $("panelAprendizaje").hidden = !aprendizaje;
    $("modoJuego").classList.toggle("activa", !aprendizaje);
    $("modoAprendizaje").classList.toggle("activa", aprendizaje);
}

$("iniciar").addEventListener("click", iniciarJuego);
$("reiniciar").addEventListener("click", reiniciarJuego);
$("jugarDeNuevo").addEventListener("click", reiniciarJuego);
$("modoJuego").addEventListener("click", () => cambiarModo(false));
$("modoAprendizaje").addEventListener("click", () => cambiarModo(true));

dibujarSecuencia();
