/**
 * Menu entry.
 *
 * Mounts the Svelte app. It shares a build with the teddy page but not a
 * bundle — nothing here pulls in three.js, so the menu costs a few KB.
 */

import "../menu.css";
import { mount } from "svelte";
import Menu from "./Menu.svelte";

const host = document.getElementById("menu");

if (host) {
  mount(Menu, { target: host });
}