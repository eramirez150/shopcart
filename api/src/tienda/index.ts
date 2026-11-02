import { config } from '../compartido/config.js';
import { crearAppTienda } from './app.js';

const puerto = config.puerto(3000);
crearAppTienda().listen(puerto, () => {
  console.log(`Tienda en http://localhost:${puerto}/api (documentación en /api/docs)`);
});
