/**
 * The content card: wordmark, one line of description, and the interaction
 * hints.
 *
 * The hints are real DOM text, not a canvas overlay, for two reasons: a
 * screen reader can read them, and they stay selectable and legible at any
 * zoom level where a 3D label would be an unreadable smear.
 */

const HINTS = ["แตะหัว", "ลากท้อง", "คลิกพื้น"];

export function createWordmark(): HTMLElement {
  const el = document.createElement("div");
  el.className = "wordmark";
  el.innerHTML = `
    <span class="wordmark__mark" aria-hidden="true">thd</span>
    <span class="wordmark__dot" aria-hidden="true"></span>
  `;
  return el;
}

export function createCard(): HTMLElement {
  const card = document.createElement("section");
  card.className = "card";

  const title = document.createElement("h1");
  title.className = "card__title";
  title.textContent = "ตุ๊กตาหมี";

  const body = document.createElement("p");
  body.className = "card__body";
  body.textContent = "ฉาก 3D เล่นได้ทุกอุปกรณ์ ลองแตะดูสิ";

  const hints = document.createElement("ul");
  hints.className = "card__hints";
  hints.setAttribute("aria-label", "วิธีเล่น");
  for (const hint of HINTS) {
    const li = document.createElement("li");
    li.className = "card__hint";
    li.textContent = hint;
    hints.appendChild(li);
  }

  card.append(title, body, hints);
  return card;
}
