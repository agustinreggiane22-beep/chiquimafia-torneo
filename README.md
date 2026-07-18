# CHIQUIMAFIA TORNEO

Sitio estático listo para GitHub Pages. Lee siete hojas CSV publicadas desde Google Sheets, reconoce su función por los encabezados y conserva una copia local como respaldo.

## Publicar

1. Subir el contenido de esta carpeta a un repositorio de GitHub.
2. En **Settings → Pages**, elegir **Deploy from a branch**.
3. Seleccionar la rama principal y la carpeta raíz.

## Escudo oficial

Copiar el PNG transparente oficial como `assets/escudo.png`. Mientras ese archivo no exista, la web muestra un escudo alternativo limpio para que nunca quede una imagen rota.

## Fuentes detectadas

- `1656137437`: clasificación.
- `868657404`: partidos y equipos Blanco/Negro.
- `871809491`: estadísticas por jugador.
- `432034466`: puntos por fecha.
- `376531473`: historial por fechas.
- `1519685756`: lista de jugadores.
- `990740373`: cálculos derivados del archivo original.

La cantidad de fechas de fase regular se modifica en `js/config.js`.

## Declaración y aprobación de goles

La web incluye el flujo completo:

1. El jugador elige una fecha, su equipo y su nombre.
2. Declara sus goles.
3. La solicitud queda pendiente.
4. El administrador entra en **Admin** y acepta o rechaza.
5. Solo los goles aprobados aparecen en el ranking.

En el mismo envío, cada jugador vota el MVP del partido. No puede votarse a sí mismo y solo puede presentar una declaración por fecha. Los votos se contabilizan después de aprobar la declaración y el administrador ve el recuento separado por fecha.

Apps Script verifica la convocatoria directamente en la hoja de partidos: tanto quien vota como el candidato elegido deben figurar entre `Jugador 1` y `Jugador 16` en esa fecha. Un envío manipulado fuera de la web también será rechazado.

Sin configurar un servidor, el sistema funciona en modo de prueba y guarda las solicitudes únicamente en el navegador actual. Para compartirlas entre todos los celulares:

1. Abrir la planilla del torneo y entrar en **Extensiones → Apps Script**.
2. Copiar el contenido de `google-apps-script/Code.gs`.
3. En **Configuración del proyecto → Propiedades de la secuencia de comandos**, crear `ADMIN_PIN` con el PIN elegido.
4. Implementar como **Aplicación web**, ejecutada por el propietario y accesible para cualquiera.
5. Copiar su URL en `goalsApiUrl` dentro de `js/config.js`.

El PIN inicial para el modo de prueba local es `2026`. En producción, manda el PIN guardado en Apps Script y no el valor visible en la web.
