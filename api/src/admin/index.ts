import { config } from '../compartido/config.js';
import { crearAppAdmin } from './app.js';

const puerto = config.puerto(3001);
crearAppAdmin().listen(puerto, () => {
  console.log(`Administración en http://localhost:${puerto}/api (documentación en /api/docs)`);
});
