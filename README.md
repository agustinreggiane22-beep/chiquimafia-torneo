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

La fase regular está configurada en 18 fechas. Administración permite anular cargas aprobadas, archivar y reiniciar datos web de una temporada y registrar resultados de cuartos, semifinales y final. El reinicio conserva un respaldo en la pestaña `Archivo Web`; la clasificación principal original continúa administrándose desde las hojas históricas del torneo.

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


## Desarrollo y comprobaciones

El sitio no necesita instalación ni compilación. Desde la raíz del repositorio, ejecutar
`python3 -m http.server 8000 --bind 127.0.0.1`.

Las pruebas de reutilización de datos se ejecutan con
`node --test tests/*.test.cjs`.
Con Playwright y Chromium disponibles, y el servidor local en marcha, ejecutar
`node tests/page-behavior.cjs` para comprobar los rankings, la próxima fecha y las
actualizaciones de administración. Esta prueba intercepta Apps Script con datos
simulados y no escribe en la planilla real.

La carga inicial reutiliza las listas de la respuesta de Apps Script durante
30 segundos. Las consultas repetidas comparten la misma solicitud y guardar un
cambio invalida esa copia. Recargar la página siempre consulta el estado del torneo.
Los rankings actuales incluyen únicamente a los jugadores activos; los invitados
se conservan en las convocatorias y los registros de cada partido. La sección
Fechas completa (partidos a disputar, fechas jugadas y todas las fechas) aparece
encima de Clasificación. Inicio conserva el último resultado y su resumen
original de próximo partido. Si aún no se guardó un próximo partido, la fecha de la tarjeta
pequeña se estima a partir del último partido y se identifica como estimada.

La consulta inicial permite hasta 45 segundos para una respuesta lenta de Apps
Script. El panel de error muestra el mensaje concreto de la carga fallida.

La carga consulta primero JSON con credenciales de Google omitidas. Si esa ruta
no funciona, utiliza JSONP con el tiempo restante del mismo limite de 45 segundos.

El generador permite cargar equipos guardados o generar equipos nuevos y exportar una imagen con fondo negro y rojo. El día se toma de la fecha guardada (incluidos los timestamps ISO de Apps Script); día, horario y lugar son editables antes de la vista previa o descarga. Horario y lugar se conservan por número de fecha en localStorage del dispositivo, con 18:00 y El Más Grande como valores iniciales. No se guardan en la hoja compartida. El fondo se carga únicamente al preparar la imagen.

La exportación prepara un File PNG con URL temporal blob para descargarlo desde un enlace real, abrirlo o guardar la vista previa como imagen. Compartir usa Web Share solo desde un clic del usuario sobre un archivo ya preparado; cancelar no inicia otra descarga. La disponibilidad de WhatsApp y del diálogo nativo depende del navegador/dispositivo.

El Admin usa un solo editor de equipos para fase regular y playoffs: fecha y día comunes, modo parejo/manual, carga guardada, una sola publicación y eliminación confirmada dentro de “Eliminar partido”. Cambiar de modo conserva los equipos, incluidos invitados y equipos de más de ocho jugadores cargados. El número inicial propone el primer partido pendiente o la siguiente fecha si no quedan pendientes. Las imágenes usan el mismo editor y un solo botón visible de descarga. Marcador del partido y avance del cuadro de playoffs son operaciones distintas y mantienen formularios independientes con textos aclaratorios; cierre y recuperación de temporadas se agrupan en un desplegable.
