/**
 * The cat page's entry point.
 *
 * Same failure path as the bear's: a WebGL context can fail to create on a
 * locked-down device or when the GPU is out of memory, and without a handler
 * the user gets a blank rectangle with no explanation. Every failure surfaces
 * as readable text instead.
 */

import "./cat.css";
import { startCatPage } from "../cat-page";

const host = document.getElementById("stage");
const boot = document.getElementById("boot");

function showFailure(message: string): void {
  if (!boot) return;
  boot.classList.remove("is-gone");
  boot.hidden = false;
  boot.innerHTML = "";

  const mark = document.createElement("div");
  mark.className = "boot__cat";
  mark.setAttribute("aria-hidden", "true");

  const title = document.createElement("p");
  title.textContent = "แมวยังตื่นไม่ได้";

  const detail = document.createElement("p");
  detail.className = "boot__detail";
  detail.textContent = message;

  boot.append(mark, title, detail);
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
    );
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
    startCatPage(host);
  } catch (error) {
    console.error("[cat] failed to start", error);
    showFailure("เกิดข้อผิดพลาดขณะเตรียมฉาก");
    return;
  }

  // Fade the boot layer only after the first frame, so the cat never appears
  // against a half-painted page.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      boot?.classList.add("is-gone");
      // Removed after the transition rather than immediately, or the fade is
      // skipped entirely.
      window.setTimeout(() => boot?.setAttribute("hidden", ""), 300);
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot3d, { once: true });
} else {
  boot3d();
}