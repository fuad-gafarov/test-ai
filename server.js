'use strict';

const { createApp } = require('./src/app');

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
const app = createApp();

app.listen(PORT, () => {
  console.log(`Todo list app running at http://localhost:${PORT}`);
});
