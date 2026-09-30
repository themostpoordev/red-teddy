/**
 * Entry point.
 *
 * The failure path matters more than it looks. A WebGL context can fail to
 * create on a locked-down device, on a machine out of GPU memory, or when
 * too many other tabs hold contexts. Without a handler the user gets a blank
 * cream rectangle with no explanation — the boot text would simply stay put
 * with no indication of why. So every failure surfaces as readable text.
 */

import "./styles.css";
import { createApp } from "../app";

const host = document.getElementById("stage");
const boot = document.getElementById("boot");

function showFailure(message: string): void {
  if (!boot) return;
  boot.classList.remove("is-gone");
  boot.hidden = false;
  boot.innerHTML = "";

  const bear = document.createElement("div");
  bear.className = "boot__bear";
  bear.setAttribute("aria-hidden", "true");
  bear.textContent = "🐻";

  const head = document.createElement("p");
  head.textContent = "หมียังตื่นไม่ได้";

  const detail = document.createElement("p");
  detail.className = "boot__detail";
  detail.textContent = message;

  boot.append(bear, head, detail);
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function boot3d(): void {
  if (!host) {
    showFailure("ไม่พบพื้นที่แสดงผล");
    return;
  }
  if (!supportsWebGL()) {
    showFailure("เบราว์เซอร์นี้ไม่รองรับ 3D ลองเปิดการเร่งด้วยฮาร์ดแวร์");
    return;
  }

  try {
    createApp(host);
  } catch (error) {
    console.error("[thd] failed to start", error);
    showFailure("เกิดข้อผิดพลาดขณะเตรียมฉาก");
    return;
  }

  // Fade the boot layer out only after the first frame is on screen, so the
  // bear never appears against a half-painted page.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      boot?.classList.add("is-gone");
      // Remove after the transition rather than immediately, otherwise the
      // fade is skipped entirely.
      window.setTimeout(() => boot?.setAttribute("hidden", ""), 300);
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot3d, { once: true });
} else {
  boot3d();
}
