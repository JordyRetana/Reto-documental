const QUESTIONS = window.QUESTIONS;
const topicColors = window.topicColors;

const state = {
  deck: [],
  index: 0,
  score: 0,
  streak: 0,
  answered: 0,
  correct: 0,
  lives: 5,
  missed: [],
  locked: false,
  hintVisible: false
};

const $ = (id) => document.getElementById(id);

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function initSelectors() {
  const topics = ["Todos los temas", ...new Set(QUESTIONS.map(q => q.t))];
  $("moduleSelect").innerHTML = topics.map(t => `<option value="${t}">${t}</option>`).join("");
  renderModules();
}

function renderModules() {
  const counts = QUESTIONS.reduce((acc, q) => {
    acc[q.t] = (acc[q.t] || 0) + 1;
    return acc;
  }, {});
  $("moduleList").innerHTML = Object.entries(counts).map(([topic, count]) => `
    <li class="module">
      <span class="dot" style="background:${topicColors[topic]}"></span>
      <span>${topic}</span>
      <small>${count}</small>
    </li>
  `).join("");
}

function buildDeck(source = QUESTIONS) {
  const topic = $("moduleSelect").value || "Todos los temas";
  const desired = $("lengthSelect").value;
  let pool = topic === "Todos los temas" ? source : source.filter(q => q.t === topic);
  pool = shuffle(pool);
  if (desired !== "all") pool = pool.slice(0, Math.min(Number(desired), pool.length));
  state.deck = pool;
  state.index = 0;
  state.score = 0;
  state.streak = 0;
  state.answered = 0;
  state.correct = 0;
  state.lives = 5;
  state.missed = [];
  state.locked = false;
  state.hintVisible = false;
  $("summary").classList.remove("show");
  $("playArea").classList.remove("hidden");
  $("playHeader").classList.remove("hidden");
  updateStats();
  renderQuestion();
}

function updateStats() {
  $("score").textContent = state.score;
  $("streak").textContent = state.streak;
  $("accuracy").textContent = state.answered ? `${Math.round((state.correct / state.answered) * 100)}%` : "0%";
  $("lives").textContent = state.lives;
  $("missedList").innerHTML = state.missed.length
    ? state.missed.slice(-8).reverse().map(q => `<li><strong>${q.t}</strong><br>${q.q}</li>`).join("")
    : `<li>Todavia no hay preguntas falladas.</li>`;
  const progress = state.deck.length ? (state.index / state.deck.length) * 100 : 0;
  $("progressBar").style.width = `${progress}%`;
  $("routePath").style.strokeDashoffset = 260 - (260 * progress / 100);
}

function renderQuestion() {
  if (!state.deck.length) {
    showSummary("No hay preguntas para este filtro.", "Cambia el tema o elige otra cantidad.");
    return;
  }

  if (state.index >= state.deck.length || state.lives <= 0) {
    const title = state.lives <= 0 ? "Se acabaron las vidas" : "Ronda completada";
    const pct = state.answered ? Math.round((state.correct / state.answered) * 100) : 0;
    const text = pct >= 85
      ? "Muy buen dominio. Tu siguiente paso es repasar las falladas para cerrar detalles finos."
      : pct >= 65
        ? "Vas bien. Hay conceptos que ya estan firmes y otros que piden una segunda vuelta."
        : "Conviene repasar por modulos, especialmente las preguntas falladas.";
    showSummary(title, text);
    return;
  }

  state.locked = false;
  state.hintVisible = false;
  const q = state.deck[state.index];
  $("counter").textContent = `Pregunta ${state.index + 1} de ${state.deck.length}`;
  $("modeLabel").textContent = $("moduleSelect").value;
  $("topicBadge").textContent = q.t;
  $("topicBadge").style.borderColor = topicColors[q.t];
  $("difficultyBadge").textContent = q.d;
  $("questionText").textContent = q.q;
  $("feedback").className = "feedback";
  $("feedback").textContent = "";
  $("nextBtn").classList.add("hidden");
  $("explainBtn").classList.remove("hidden");

  $("options").innerHTML = q.o.map((option, i) => `
    <button class="option" data-index="${i}">
      <span class="letter">${String.fromCharCode(65 + i)}</span>
      <span>${option}</span>
    </button>
  `).join("");

  document.querySelectorAll(".option").forEach(btn => {
    btn.addEventListener("click", () => answer(Number(btn.dataset.index)));
  });
  updateStats();
}

function answer(choice) {
  if (state.locked) return;
  state.locked = true;
  const q = state.deck[state.index];
  const isCorrect = choice === q.a;
  state.answered++;

  document.querySelectorAll(".option").forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.a) btn.classList.add("correct");
    if (i === choice && !isCorrect) btn.classList.add("wrong");
  });

  if (isCorrect) {
    state.correct++;
    state.streak++;
    state.score += 100 + Math.min(state.streak * 15, 150);
  } else {
    state.streak = 0;
    state.lives--;
    state.missed.push(q);
  }

  const fb = $("feedback");
  fb.className = `feedback show ${isCorrect ? "good" : "bad"}`;
  fb.innerHTML = `<strong>${isCorrect ? "Correcto." : "Revisalo."}</strong> ${q.e}`;
  $("nextBtn").classList.remove("hidden");
  $("explainBtn").classList.add("hidden");
  state.index++;
  updateStats();
}

function getHint(q) {
  if (q.h) return q.h;

  const topicHints = {
    "Analisis documental": "Distingue entre representar contenido para recuperarlo y tareas externas como comprar, decorar o conservar fisicamente el documento.",
    "Indizacion": "Busca la opcion que hable de representar materias con terminos. Si aparece ambiguedad, piensa en ruido o silencio documental.",
    "Resumenes documentales": "Recuerda los criterios: brevedad reduce terminos, exhaustividad evita omisiones sustanciales, objetividad evita opiniones e independencia permite entenderlo solo.",
    "Tipos de resumen": "Compara extension y detalle: indicativo es breve, informativo incluye metodo/resultados/conclusiones, analitico es mucho mas detallado.",
    "Lenguajes documentales": "La clave es el control terminologico: normalizar palabras cuesta al indizar, pero mejora la busqueda del usuario.",
    "Tesauros": "Lee las siglas como relaciones: USE remite al preferente, UP recoge variantes, TG sube a lo general, TE baja a lo especifico y TR asocia.",
    "Registros bibliograficos": "Identifica si el dato describe persona, materia, genero, resumen, idioma o enlace. En MARC, el numero del campo suele indicar esa funcion."
  };

  return topicHints[q.t] || "Elimina primero las opciones que pertenecen a otro proceso documental; luego compara la palabra clave de la pregunta con la funcion del concepto.";
}

function showHint() {
  if (state.hintVisible) return;
  state.hintVisible = true;
  const q = state.deck[state.index];
  const fb = $("feedback");
  fb.className = "feedback show";
  fb.innerHTML = `<strong>Pista util:</strong> ${getHint(q)}`;
}

function showSummary(title, text) {
  $("playArea").classList.add("hidden");
  $("playHeader").classList.add("hidden");
  $("summary").classList.add("show");
  $("summaryTitle").textContent = title;
  $("summaryText").textContent = text;
  $("finalScore").textContent = state.score;
  $("finalAccuracy").textContent = state.answered ? `${Math.round((state.correct / state.answered) * 100)}%` : "0%";
  $("finalMissed").textContent = state.missed.length;
  $("progressBar").style.width = "100%";
}

function reviewMissed() {
  if (!state.missed.length) {
    showSummary("No hay falladas todavia", "Juega una ronda primero; cuando falles alguna, aparece aqui para repasarla.");
    return;
  }
  const missed = [...state.missed];
  $("moduleSelect").value = "Todos los temas";
  state.deck = shuffle(missed);
  state.index = 0;
  state.score = 0;
  state.streak = 0;
  state.answered = 0;
  state.correct = 0;
  state.lives = 5;
  state.missed = [];
  $("summary").classList.remove("show");
  $("playArea").classList.remove("hidden");
  $("playHeader").classList.remove("hidden");
  renderQuestion();
}

$("nextBtn").addEventListener("click", renderQuestion);
$("explainBtn").addEventListener("click", showHint);
$("restartBtn").addEventListener("click", () => buildDeck());
$("againBtn").addEventListener("click", () => buildDeck());
$("shuffleBtn").addEventListener("click", () => buildDeck());
$("reviewBtn").addEventListener("click", reviewMissed);
$("summaryReviewBtn").addEventListener("click", reviewMissed);
$("moduleSelect").addEventListener("change", () => buildDeck());
$("lengthSelect").addEventListener("change", () => buildDeck());

initSelectors();
buildDeck();
  
