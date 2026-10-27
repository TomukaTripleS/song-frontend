const API_URL = "http://127.0.0.1:8000/api/songs/";
const list = document.querySelector("#songs");
const status = document.querySelector("#status");
const reloadButton = document.querySelector("#reload");

async function loadSongs() {
  reloadButton.disabled = true;
  status.textContent = "Завантаження…";
  list.replaceChildren();

  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Не вдалося отримати пісні.");
    }

    for (const song of data) {
      const item = document.createElement("li");
      const title = document.createElement("h2");
      title.textContent = song.title;
      const info = document.createElement("p");
      info.textContent = `${song.artist_name} · ${song.genre}`;
      const link = document.createElement("a");
      // Дозволяємо лише звичайні вебпосилання.
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
    status.textContent = data.length ? `Пісень у каталозі: ${data.length}` : "Пісень поки немає. Додайте їх через API або Postman.";
  } catch (error) {
    status.textContent = `Помилка: ${error.message} Перевірте, чи запущено бекенд на порту 8000.`;
  } finally {
    reloadButton.disabled = false;
  }
}

reloadButton.addEventListener("click", loadSongs);
loadSongs();
