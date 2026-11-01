import { crearApp } from './app.js';
import { config } from './compartido/config.js';

crearApp().listen(config.puerto, () => {
  console.log(`API en http://localhost:${config.puerto}/api (documentación en /api/docs)`);
});
