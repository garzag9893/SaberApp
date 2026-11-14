# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Público general hispanohablante (México como mercado principal) que quiere ordenar su día sin usar tres apps distintas: agenda, dinero y hábitos. Lo abre varias veces al día, sobre todo en el celular, para ver qué sigue y anotar algo en segundos.

## Product Purpose

LifeOS junta en un solo lugar la agenda, el dinero, la salud y los hábitos de una persona, alrededor de un reloj de 24 horas. Al abrirla se entiende cómo va el día de un vistazo, y cualquier cosa se anota escribiéndola como se diría en voz alta.

Éxito: que la persona la use a diario como su único lugar para organizarse, y que confíe en ella porque sus datos son suyos.

## Positioning

- **Todo en un solo lugar**: agenda, dinero y hábitos se ven juntos y alrededor del reloj del día, no en secciones aisladas.
- **Escribir como hablo**: una sola barra entiende "Dentista mañana 4pm", "Comida $180" o "Gym cada lunes 7am", en español de México.
- **Mis datos son míos**: todo se guarda en el dispositivo y funciona sin conexión; la nube es opcional y no hace falta crear una cuenta para usarla.

## Operating Context

- App web instalable (PWA): se usa desde el navegador o instalada en el celular y la computadora, con y sin conexión.
- Uso breve y frecuente: revisar el día por la mañana, anotar al momento, marcar hábitos por la noche.
- Sincronización opcional con Supabase, con inicio de sesión por persona.

## Capabilities and Constraints

- Funciones actuales: agenda (repetición, hora de fin, choques, vista semanal, búsqueda, recordatorios), finanzas (por mes, presupuestos, categorías propias, gastos fijos, tendencia), salud y hábitos (agua, sueño, energía, rachas, calendario de constancia), bienvenida, respaldo JSON y CSV, tema claro y oscuro.
- Stack existente: React + Vite + Tailwind, datos en localStorage, pruebas con Vitest y Playwright.
- Idioma y formato: español de México (textos, fechas, moneda en pesos).
- Debe ser ligera y rápida en teléfonos sencillos.

### Modelo de ingresos (decidido: mixto)

Se activa **después de publicar la app y tener usuarios reales**, no antes.

- **Gratis con anuncios limitados**: toda la funcionalidad está disponible gratis. Los anuncios cumplen estas condiciones:
  - Son **sin personalizar**: sin cookies de rastreo ni perfilado.
  - Aparecen en **pocos lugares fijos**, por ejemplo al final del Resumen; **nunca** mientras alguien anota, en la bienvenida, en formularios ni en avisos.
  - No reciben ningún dato de la app (tareas, montos, hábitos, nombre).
  - Sin conexión no se muestran ni dejan huecos.
- **Plan Plus de pago**: quita los anuncios y suma funciones de valor (por ejemplo sincronización cifrada entre dispositivos, respaldo automático y reportes). Precio y funciones exactas por decidir.
- **Requisitos antes de mostrar anuncios**: dominio propio, aprobación de la red de anuncios, aviso de privacidad conforme a la LFPDPPP y aviso de cookies cuando aplique.
- Los anuncios no pueden romper el contraste, la navegación con teclado ni la velocidad en celulares; se cargan después del contenido.

### Decisiones abiertas

- **Cómo destacar frente a otras apps** (además de las automatizaciones): hay propuestas en discusión; ninguna está confirmada.
- **Plan Plus**: precio, funciones incluidas y forma de pago (por ejemplo Mercado Pago o Stripe).
- **Red de anuncios**: cuál usar (por ejemplo Google AdSense en modo sin personalizar, o un patrocinador directo).

## Brand Commitments

- Nombre: LifeOS.
- Identidad "Bitácora del día" y el reloj del día como elemento distintivo (ver DESIGN.md).
- Voz: español de México claro y directo; los botones dicen lo que hacen.

## Evidence on Hand

- La app funcional, el kit de marca generado desde ella (`brand/`) y la imagen para compartir (`public/og-image.png`).
- **No existen todavía**: usuarios reales, testimonios, métricas de uso, precios ni reseñas. Los datos de la app y del kit son de ejemplo; no se deben presentar como reales.

## Product Principles

1. **Un vistazo basta**: lo importante del día se entiende sin navegar.
2. **Anotar no cuesta**: capturar algo nunca debe tomar más de unos segundos.
3. **Los datos son de la persona**: funciona sin cuenta ni conexión; sus datos nunca se envían sin que lo active y **nunca se usan para anuncios**.
4. **Para todos los teléfonos**: rápida y usable en equipos sencillos.
5. **Accesible por defecto**: nadie queda fuera por su vista, su forma de navegar o su equipo.

## Accessibility & Inclusion

- Contraste WCAG AA en ambos temas (comprobado por `src/lib/tokens.test.js`).
- Uso completo con teclado y lector de pantalla; todos los controles tienen nombre (comprobado en las pruebas de navegador).
- Colores de gráficas validados para daltonismo; el color nunca es la única señal.
- Respeta "reducir movimiento".
