const API_URL = "http://127.0.0.1:8000/api/";
const SESSION_KEY = "song-session";
const list = document.querySelector("#songs");
const catalogStatus = document.querySelector("#catalog-status");
const reloadButton = document.querySelector("#reload");
const message = document.querySelector("#message");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const songForm = document.querySelector("#song-form");
const loginLink = document.querySelector("#login-link");
const registerLink = document.querySelector("#register-link");
const logoutButton = document.querySelector("#logout");
const userName = document.querySelector("#user-name");
const pages = document.querySelectorAll("main > section");

let session = null;
let user = null;

try {
  const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY));
  if (typeof stored?.access === "string" && typeof stored?.refresh === "string") {
    session = stored;
  }
} catch {
  // A blocked storage or invalid saved session should still allow guest access.
}

function saveSession(tokens) {
  session = tokens;
  if (!tokens) user = null;
  try {
    if (tokens) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(tokens));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // The session remains usable on this page if browser storage is blocked.
  }
}

async function request(path, {method = "GET", body, access} = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (access) headers.Authorization = `Bearer ${access}`;

  let response;
  try {
    response = await fetch(API_URL + path, {method, headers, body: JSON.stringify(body)});
  } catch {
    throw new Error("Не вдалося з’єднатися з API. Перевірте, чи запущено бекенд на порту 8000.");
  }
  const data = await response.json();
  if (!response.ok) {
    const details = Object.entries(data.error?.details ?? {})
      .map(([field, errors]) => `${field}: ${[].concat(errors).join(" ")}`);
    const error = new Error(details.join(" ") || data.error?.message || `Помилка HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function authorizedRequest(path, options = {}) {
  const current = session;
  try {
    return await request(path, {...options, access: current.access});
  } catch (error) {
    if (error.status !== 401 || session !== current) throw error;
  }

  try {
    const {access} = await request("token/refresh/", {
      method: "POST",
      body: {refresh: current.refresh},
    });
    if (session !== current) throw new Error("Сеанс завершено.");
    saveSession({...current, access});
  } catch (error) {
    if (session === current && (error.status === 400 || error.status === 401)) {
      saveSession(null);
      showPage();
      throw new Error("Сеанс завершився. Увійдіть знову.");
    }
    throw error;
  }
  return request(path, {...options, access: session.access});
}

function returnToAdd() {
  const query = location.hash.split("?")[1];
  return new URLSearchParams(query).get("next") === "add";
}

function showPage() {
  let page = location.hash.slice(1).split("?")[0] || "catalog";
  if (page === "add" && !user) {
    location.replace("#login?next=add");
    return;
  }
  if (user && (page === "login" || page === "register")) {
    location.replace("#catalog");
    return;
  }
  if (!Array.from(pages).some(section => section.id === page)) page = "catalog";
  for (const section of pages) section.hidden = section.id !== page;

  loginLink.hidden = Boolean(user);
  registerLink.hidden = Boolean(user);
  logoutButton.hidden = !user;
  userName.hidden = !user;
  userName.textContent = user ? user.first_name || user.username : "";
  const next = returnToAdd() ? "?next=add" : "";
  loginLink.href = "#login" + next;
  registerLink.href = "#register" + next;

  if (page === "catalog") loadSongs();
  if (page === "add") loadArtists();
}

async function loadSongs() {
  reloadButton.disabled = true;
  catalogStatus.textContent = "Завантаження…";

  try {
    const data = await request("songs/");
    list.replaceChildren();

    for (const song of data) {
      const item = document.createElement("li");
      const title = document.createElement("h2");
      title.textContent = song.title;
      const info = document.createElement("p");
      info.textContent = `${song.artist_name} · ${song.genre}`;
      const link = document.createElement("a");
      const url = new URL(song.listen_url);
      if (url.protocol === "http:" || url.protocol === "https:") {
        link.href = url.href;
        link.textContent = "Слухати";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      item.append(title, info, link);
      if (song.featured_date) {
        const date = document.createElement("p");
        date.textContent = `Дата рекомендації: ${song.featured_date}`;
        item.append(date);
      }
      list.append(item);
    }
    catalogStatus.textContent = data.length ? `Пісень у каталозі: ${data.length}` : "Пісень поки немає.";
  } catch (error) {
    catalogStatus.textContent = error.message;
  } finally {
    reloadButton.disabled = false;
  }
}

async function loadArtists() {
  const select = songForm.elements.artist;
  const button = songForm.querySelector("button");
  const status = document.querySelector("#artist-status");
  select.replaceChildren();
  button.disabled = true;
  status.textContent = "Завантаження виконавців…";
  try {
    const artists = await request("artists/");
    select.replaceChildren(...artists.map(artist => new Option(artist.name, artist.id)));
    button.disabled = artists.length === 0;
    status.textContent = artists.length ? "" : "Спочатку додайте виконавця через API.";
  } catch (error) {
    status.textContent = error.message;
  }
}

function handleSubmit(form, submit) {
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector("button");
    if (button.disabled) return;
    button.disabled = true;
    message.textContent = "";
    try {
      await submit(Object.fromEntries(new FormData(form)));
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

handleSubmit(registerForm, async data => {
  const account = await request("register/", {method: "POST", body: data});
  registerForm.reset();
  loginForm.elements.username.value = account.username;
  message.textContent = "Акаунт створено. Увійдіть.";
  location.replace(returnToAdd() ? "#login?next=add" : "#login");
});

handleSubmit(loginForm, async data => {
  const tokens = await request("token/", {method: "POST", body: data});
  user = await request("me/", {access: tokens.access});
  saveSession(tokens);
  loginForm.reset();
  location.replace(returnToAdd() ? "#add" : "#catalog");
});

handleSubmit(songForm, async data => {
  await authorizedRequest("songs/", {method: "POST", body: {...data, artist: Number(data.artist)}});
  songForm.reset();
  message.textContent = "Пісню додано.";
  location.hash = "catalog";
});

logoutButton.addEventListener("click", () => {
  saveSession(null);
  songForm.reset();
  message.textContent = "Ви вийшли з акаунта.";
  location.replace("#catalog");
  showPage();
});

document.querySelector("nav").addEventListener("click", event => {
  if (event.target.closest("a")) message.textContent = "";
});
reloadButton.addEventListener("click", loadSongs);

async function start() {
  if (session) {
    try {
      user = await authorizedRequest("me/");
    } catch (error) {
      message.textContent = error.message;
    }
  }
  window.addEventListener("hashchange", showPage);
  showPage();
}

start();
