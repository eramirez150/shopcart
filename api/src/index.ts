import { crearApp } from './app.js';
import { config } from './config.js';

crearApp().listen(config.puerto, () => {
  console.log(`API en http://localhost:${config.puerto}/api (documentación en /api/docs)`);
});
