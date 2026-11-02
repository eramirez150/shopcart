// Busca una foto de referencia por producto en Amazon y arma la semilla con esas direcciones.
//
//   node fotos-amazon.mjs capturar   Corrida única: visita una página de búsqueda por producto
//                                    y guarda en fotos.json las direcciones de las fotos.
//   node fotos-amazon.mjs semilla    Genera database/02_semillas/002_fotos_reales.sql a partir
//                                    de fotos.json. No visita ningún sitio.
//
// Límites de la captura: máximo 30 páginas públicas, una a la vez, con 4 a 8 segundos de pausa.
// Sin cuenta, sin proxies y sin disfrazar el navegador. Ante un CAPTCHA o un bloqueo la corrida
// termina de inmediato con lo capturado: no se reintenta ni se intenta resolver.
// Solo se guardan direcciones de imágenes; los títulos y las descripciones no se copian.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ARCHIVO_FOTOS = new URL('./fotos.json', import.meta.url);
const ARCHIVO_SEMILLA = new URL('../database/02_semillas/002_fotos_reales.sql', import.meta.url);
const MAXIMO_PAGINAS = 30;
const CANDIDATAS_POR_PAGINA = 6;
const HOST_PERMITIDO = 'm.media-amazon.com';

// Nombre exacto del producto en la semilla y término de búsqueda, en inglés porque da mejores
// resultados. Cubren las secciones Novedades y Precios bajos del inicio y al menos dos productos
// de cada categoría.
const PRODUCTOS = [
  ['Almohada', 'memory foam bed pillow'],
  ['Audífonos inalámbricos', 'wireless earbuds with charging case'],
  ['Balón de fútbol', 'size 5 soccer ball'],
  ['Batería externa', '10000mah portable power bank'],
  ['Bicicleta de montaña', '29 inch mountain bike'],
  ['Bloques de construcción', 'building blocks set 500 pieces'],
  ['Bocina portátil', 'portable waterproof bluetooth speaker'],
  ['Botas de trabajo', 'steel toe work boots men'],
  ['Botella deportiva', '750ml sports water bottle'],
  ['Cámara de seguridad', 'indoor wifi security camera'],
  ['Cámara web', '1080p webcam with microphone'],
  ['Camisa formal', 'men long sleeve dress shirt'],
  ['Cargador rápido USB-C', '20w usb c wall charger'],
  ['Carro a control remoto', 'remote control off road car'],
  ['Cuerda para saltar', 'jump rope with counter'],
  ['Disco SSD externo', 'portable external ssd 1tb'],
  ['Escoba y recogedor', 'broom and dustpan set'],
  ['Gorra', 'adjustable baseball cap'],
  ['Laptop 14 pulgadas', '14 inch laptop'],
  ['Licuadora', 'countertop blender glass jar'],
  ['Memoria USB', 'usb 3.0 flash drive 64gb'],
  ['Monitor 24 pulgadas', '24 inch ips monitor'],
  ['Mouse inalámbrico', 'wireless optical mouse'],
  ['Playera básica', 'men basic cotton t-shirt'],
  ['Reloj inteligente', 'smart watch heart rate monitor'],
  ['Rompecabezas 1000 piezas', '1000 piece jigsaw puzzle landscape'],
  ['Sartén antiadherente', 'nonstick frying pan'],
  ['Tabla para picar', 'bamboo cutting board'],
  ['Tapete de yoga', 'non slip yoga mat'],
  ['Tenis para correr', 'men running shoes'],
];

function guardar(datos) {
  writeFileSync(ARCHIVO_FOTOS, `${JSON.stringify(datos, null, 2)}\n`);
}

// Devuelve el motivo del bloqueo o null si la página es utilizable.
async function motivoDeBloqueo(respuesta, pagina) {
  const estado = respuesta?.status() ?? 0;
  if (estado === 0 || estado >= 400) return `HTTP ${estado}`;
  if (pagina.url().includes('/errors/validateCaptcha')) return 'redirección a validateCaptcha';
  if (await pagina.locator('form[action*="validateCaptcha"], #captchacharacters').count()) return 'formulario CAPTCHA';
  // El texto solo cuenta sin resultados: el título de un producto podría contener estas frases.
  if (await pagina.locator('[data-component-type="s-search-result"]').count()) return null;
  const texto = `${await pagina.title()} ${await pagina.locator('body').innerText()}`;
  const aviso = /enter the characters|robot check|not a robot|continue shopping|type the characters/i.exec(texto);
  return aviso ? `texto "${aviso[0]}"` : 'página sin resultados';
}

// De cada resultado toma la imagen de 2x, que alcanza para la vista de detalle.
async function fotosDeResultados(pagina) {
  const imagenes = await pagina.$$eval('[data-component-type="s-search-result"]:not(.AdHolder) img.s-image', (nodos) =>
    nodos.map((n) => ({ src: n.src, srcset: n.getAttribute('srcset') ?? '' })),
  );
  const direcciones = imagenes.map(({ src, srcset }) => /(\S+) 2x/.exec(srcset)?.[1] ?? src);
  return [...new Set(direcciones)].filter((d) => new URL(d).hostname === HOST_PERMITIDO).slice(0, CANDIDATAS_POR_PAGINA);
}

async function capturar() {
  if (existsSync(ARCHIVO_FOTOS)) {
    console.error('fotos.json ya existe: la captura se ejecuta una sola vez. Use "semilla".');
    process.exit(1);
  }
  const datos = { fecha: new Date().toISOString(), paginas: 0, bloqueo: null, productos: [] };
  const navegador = await chromium.launch({ executablePath: CHROME, headless: true });
  const pagina = await navegador.newPage({ viewport: { width: 1280, height: 900 }, locale: 'es-GT' });
  try {
    for (const [producto, termino] of PRODUCTOS.slice(0, MAXIMO_PAGINAS)) {
      if (datos.paginas > 0) await pagina.waitForTimeout(4000 + Math.random() * 4000);
      datos.paginas += 1;
      const direccion = `https://www.amazon.com/s?k=${encodeURIComponent(termino)}`;
      const respuesta = await pagina.goto(direccion, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pagina.waitForTimeout(1200);
      const motivo = await motivoDeBloqueo(respuesta, pagina);
      if (motivo) {
        datos.bloqueo = { pagina: datos.paginas, producto, motivo };
        break;
      }
      const candidatas = await fotosDeResultados(pagina);
      console.log(`${datos.paginas}/${PRODUCTOS.length} ${producto}: ${candidatas.length} fotos`);
      if (candidatas.length > 0) datos.productos.push({ producto, termino, imagen: candidatas[0], candidatas });
      guardar(datos);
    }
  } catch (error) {
    datos.bloqueo = { pagina: datos.paginas, motivo: error.message.split('\n')[0] };
  } finally {
    guardar(datos);
    await navegador.close();
  }
  console.log(`Páginas: ${datos.paginas}. Productos: ${datos.productos.length}. Bloqueo: ${JSON.stringify(datos.bloqueo)}`);
}

// Los productos sin foto elegida (imagen null) quedan sin imagen y la tienda muestra su respaldo.
function generarSemilla() {
  const { productos } = JSON.parse(readFileSync(ARCHIVO_FOTOS, 'utf8'));
  const elegidos = productos.filter((p) => p.imagen);
  const texto = (valor) => `N'${valor.replaceAll("'", "''")}'`;
  for (const { producto, imagen } of elegidos) {
    if (new URL(imagen).hostname !== HOST_PERMITIDO) throw new Error(`Host no permitido: ${producto}`);
  }
  const filas = elegidos.map((p) => `    (${texto(p.producto)}, ${texto(p.imagen)})`).join(',\n');
  const sql = `-- Generado por scraper/fotos-amazon.mjs a partir de scraper/fotos.json. No editar a mano.
-- Cambia la imagen de muestra de picsum.photos por una foto de referencia alojada por la
-- tienda de origen. Los productos sin foto que corresponda quedan sin imagen, así no muestran
-- una que no es suya. Solo toca las filas de picsum.photos: se puede ejecutar varias veces.

UPDATE i
SET Url = f.Url
FROM dbo.ProductoImagenes i
JOIN dbo.Productos p ON p.IDProducto = i.IDProducto
JOIN (VALUES
${filas}
) AS f (Producto, Url) ON f.Producto = p.Nombre
WHERE i.Url LIKE N'https://picsum.photos/%';
GO

DELETE FROM dbo.ProductoImagenes
WHERE Url LIKE N'https://picsum.photos/%';
GO
`;
  writeFileSync(ARCHIVO_SEMILLA, sql);
  console.log(`Semilla generada con ${elegidos.length} fotos.`);
}

const comando = process.argv[2];
if (comando === 'capturar') await capturar();
else if (comando === 'semilla') generarSemilla();
else console.error('Uso: node fotos-amazon.mjs capturar | semilla');
