// import dotenv from 'dotenv';
// dotenv.config();

import App from "./App.svelte";

const app = new App({
  target: document.body,
  intro: true,
});

export default app;
