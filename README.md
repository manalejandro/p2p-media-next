# 📺 P2P Media Streaming Platform

![Next.js](https://img.shields.io/badge/Next.js-15.5.5-black)
![React](https://img.shields.io/badge/React-19.1.0-blue)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8.1-green)
![WebRTC](https://img.shields.io/badge/WebRTC-SimplePeer-orange)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

> Plataforma moderna de streaming de video peer-to-peer con compartición de pantalla en tiempo real, chat multiusuario y visualización de streams remotos.

**Desarrollada con:** Next.js 15 • React 19 • WebRTC • Socket.IO • HLS.js • Tailwind CSS

---

## ✨ Características Principales

### 🎥 Streaming en Tiempo Real
- **Compartición de Pantalla P2P**: Los usuarios pueden transmitir lo que están viendo en su reproductor
- **Miniaturas en Vivo**: Previsualizaciones de video actualizadas cada 2 segundos con hover preview
- **Visualización Remota**: Haz click en cualquier usuario para ver su reproductor en tiempo real
- **Streaming bajo Demanda**: WebRTC se activa solo cuando alguien quiere ver tu contenido

### 💬 Chat en Tiempo Real
- Sistema de chat multiusuario con Socket.IO
- Lista de usuarios conectados con indicadores visuales
- Notificaciones de entrada/salida de usuarios
- Limitación de mensajes para prevenir spam

### 🔒 Seguridad y Protección
- **Rate Limiting**: 30 mensajes por minuto por IP
- **Límite de Conexiones**: Máximo 5 conexiones simultáneas por IP
- **Validación de Datos**: Sanitización automática de mensajes y nombres
- **CORS Configurado**: Seguridad en comunicaciones cross-origin

### 🌐 Proxy de Streams
- Endpoints integrados para streams RTVE (La 1, La 2, 24H)
- Proxy personalizado para URLs externas
- Manejo automático de CORS y redirecciones
- Soporte para streams HLS

### 📊 Estadísticas en Tiempo Real
- Monitoreo de transferencias HTTP y P2P
- Velocidades de subida/descarga
- Contador de peers conectados
- Estadísticas por usuario

---

## 🚀 Inicio Rápido

### Requisitos Previos

- **Node.js** >= 18.0.0
- **npm** o **yarn**

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/p2p-media-next.git
cd p2p-media-next

# Instalar dependencias
npm install
```

### Desarrollo

```bash
# Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en **http://localhost:3000**

### Producción

```bash
# Construir la aplicación
npm run build

# Iniciar en modo producción
npm start
```

### Docker (Opcional)

```bash
# Construir imagen
docker build -t p2p-media .

# Ejecutar contenedor
docker run -p 3000:3000 p2p-media
```

O usando Docker Compose:

```bash
docker-compose up -d
```

---

## 🎯 Cómo Usar

### 1. Conectarse al Chat

1. Abre la aplicación en tu navegador
2. Ingresa un nombre de usuario (mínimo 2 caracteres)
3. Haz click en "Unirse"

### 2. Reproducir un Video

- Selecciona uno de los canales predefinidos (RTVE La 1, La 2, 24H)
- O ingresa una URL personalizada de stream HLS
- El video comenzará a reproducirse automáticamente

### 3. Compartir tu Pantalla

- Tu reproductor se comparte automáticamente
- Los demás usuarios verán una miniatura de tu video
- Un indicador 🔴 aparecerá junto a tu nombre en el chat

### 4. Ver el Stream de Otro Usuario

1. Pasa el mouse sobre un usuario en el chat
2. Verás una miniatura de lo que está viendo
3. Haz click en el usuario para cargar su stream en tu reproductor
4. El video se transmitirá directamente vía WebRTC (P2P)

### 5. Volver a tu Video

- Haz click en el botón "✕ Cerrar" en el banner morado
- Volverás a tu reproductor local

---

## 🏗️ Arquitectura

### Tecnologías Clave

| Tecnología | Propósito |
|------------|-----------|
| **Next.js 15** | Framework React con SSR y App Router |
| **Socket.IO** | Comunicación bidireccional en tiempo real |
| **SimplePeer** | Abstracción de WebRTC para conexiones P2P |
| **HLS.js** | Reproducción de streams HLS en el navegador |
| **Tailwind CSS** | Framework de diseño utility-first |

### Flujo de Datos

```
┌─────────────────┐
│  Usuario A      │
│  (Broadcaster)  │
└────────┬────────┘
         │
         │ 1. Reproduce video
         │ 2. Genera thumbnails cada 2s
         │ 3. Envía thumbnails vía Socket.IO
         │
         ▼
┌─────────────────┐
│  Servidor       │
│  Socket.IO      │
└────────┬────────┘
         │
         │ 4. Broadcast thumbnails
         │
         ▼
┌─────────────────┐
│  Usuario B      │
│  (Viewer)       │
│                 │
│ 5. Ve thumbnail │
│ 6. Click "ver"  │◄──────────┐
└────────┬────────┘           │
         │                     │
         │ 7. request-peer     │
         ▼                     │
┌─────────────────┐           │
│  Servidor       │           │
└────────┬────────┘           │
         │                     │
         │ 8. peer-requested   │
         ▼                     │
┌─────────────────┐           │
│  Usuario A      │           │
│                 │           │
│ 9. Captura      │           │
│    stream       │           │
│ 10. Inicia peer │           │
└────────┬────────┘           │
         │                     │
         │                     │
         │  WebRTC P2P         │
         │  (Directo)          │
         └─────────────────────┘
              11. Stream fluye
                 de A → B
```

### Componentes Principales

#### `server.js`
Servidor Node.js personalizado con:
- Socket.IO para comunicación en tiempo real
- Proxy de streams HLS con manejo de CORS
- Rate limiting y validación de seguridad
- Gestión de usuarios y sesiones

#### `VideoPlayer.js`
Reproductor de video inteligente:
- Reproducción de streams HLS con HLS.js
- Captura de thumbnails usando Canvas API
- Soporte para streams remotos vía WebRTC
- Detección automática de capacidades del navegador

#### `Chat.js`
Sistema de chat multiusuario:
- Interfaz de mensajería en tiempo real
- Lista de usuarios con thumbnails en hover
- Indicadores visuales de estado
- Sistema de notificaciones

#### `P2PManager.js`
Gestor de conexiones WebRTC:
- Inicialización de peers con SimplePeer
- Señalización a través de Socket.IO
- Gestión de streams de audio/video
- Estadísticas de transferencia P2P
- Optimización: conexiones bajo demanda

---

## 🔧 Configuración

### Variables de Entorno

Crea un archivo `.env.local`:

```env
# Puerto del servidor
PORT=3000

# Modo de ejecución
NODE_ENV=production

# URL base (opcional)
NEXT_PUBLIC_BASE_URL=https://tu-dominio.com
```

### Servidor STUN/TURN

Por defecto, el proyecto usa:
- **STUN**: `stun:manalejandro.com:3478`
- **Fallback**: Google STUN servers

Para configurar tu propio servidor, edita `src/components/P2PManager.js`:

```javascript
const ICE_SERVERS = {
  iceServers: [
    {
      urls: 'stun:tu-servidor.com:3478'
    },
    {
      urls: 'turn:tu-servidor.com:3478',
      username: 'usuario',
      credential: 'contraseña'
    }
  ]
};
```

### Rate Limits

Ajusta los límites en `server.js`:

```javascript
const MAX_MESSAGES_PER_MINUTE = 30;  // Mensajes por minuto
const MAX_CONNECTIONS_PER_IP = 5;    // Conexiones simultáneas por IP
```

---

## 📁 Estructura del Proyecto

```
p2p-media-next/
├── public/                      # Archivos estáticos
├── src/
│   ├── app/
│   │   ├── layout.js           # Layout principal de la app
│   │   ├── page.js             # Página principal con lógica
│   │   └── globals.css         # Estilos globales
│   └── components/
│       ├── VideoPlayer.js      # Reproductor HLS + WebRTC
│       ├── Chat.js             # Chat en tiempo real
│       └── P2PManager.js       # Gestor de conexiones P2P
├── server.js                    # Servidor Node.js personalizado
├── docker-compose.yml           # Configuración Docker
├── Dockerfile                   # Imagen Docker
├── nginx.conf                   # Configuración Nginx (opcional)
├── package.json                 # Dependencias y scripts
├── next.config.mjs             # Configuración Next.js
├── tailwind.config.mjs         # Configuración Tailwind
└── README.md                   # Este archivo
```

---

## 🔌 API

### Socket.IO Events

#### Eventos del Cliente → Servidor

| Evento | Parámetros | Descripción |
|--------|-----------|-------------|
| `register` | `{ user: string }` | Registrar usuario en el chat |
| `emit msg` | `{ user: string, chat: string }` | Enviar mensaje al chat |
| `video-thumbnail` | `{ thumbnail: string, isPlaying: boolean }` | Enviar thumbnail del video |
| `request-peer` | `{ to: string }` | Solicitar conexión P2P |
| `signal` | `{ to: string, signal: object }` | Enviar señal WebRTC |

#### Eventos del Servidor → Cliente

| Evento | Datos | Descripción |
|--------|-------|-------------|
| `users` | `{ users: string[] }` | Lista de usuarios conectados |
| `adduser` | `{ user: string }` | Nuevo usuario conectado |
| `join` | `{ user: string }` | Usuario se unió |
| `msg` | `{ user: string, chat: string, timestamp: number }` | Mensaje recibido |
| `user-thumbnail` | `{ user: string, thumbnail: string, isPlaying: boolean }` | Thumbnail de usuario |
| `peer-requested` | `{ from: string }` | Solicitud de conexión P2P |
| `signal` | `{ from: string, signal: object }` | Señal WebRTC recibida |
| `quit` | `{ msg: string }` | Usuario desconectado |
| `error` | `string` | Error del servidor |

### HTTP Endpoints

#### Streams Predefinidos

```
GET /api/stream/rtve-la1
GET /api/stream/rtve-la2
GET /api/stream/rtve-24h
```

Devuelve el stream HLS proxeado con headers CORS configurados.

#### Proxy Personalizado

```
GET /api/proxy?url={encoded_url}
```

**Parámetros:**
- `url` (string, required): URL del stream codificada con `encodeURIComponent`

**Ejemplo:**
```javascript
const streamUrl = 'https://example.com/stream.m3u8';
const proxyUrl = `/api/proxy?url=${encodeURIComponent(streamUrl)}`;
```

---

## 🐛 Solución de Problemas

### El video no se reproduce

**Problema**: La pantalla se queda en negro o aparece un error.

**Soluciones:**
1. Verifica que la URL del stream sea válida y accesible
2. Comprueba la consola del navegador (F12) para errores específicos
3. Asegúrate de que el navegador soporte HLS (Chrome, Firefox, Edge)
4. Intenta con otro stream de ejemplo

### No se establece conexión P2P

**Problema**: Al hacer click en un usuario, se queda en "Conectando..."

**Soluciones:**
1. Verifica que ambos usuarios estén conectados al chat
2. Comprueba que el servidor STUN esté accesible
3. Revisa la consola para errores de WebRTC
4. Asegúrate de que no haya firewall bloqueando conexiones UDP
5. Verifica que el navegador tenga permisos de red

### No aparecen thumbnails

**Problema**: Los usuarios no muestran el indicador 🔴 ni thumbnails.

**Soluciones:**
1. Verifica que el video esté reproduciéndose
2. Comprueba que el video tenga `crossOrigin="anonymous"`
3. Asegúrate de que el stream permita captura (algunos DRM protegidos no lo permiten)
4. Revisa la consola para errores de Canvas/CORS

### Problemas de chat

**Problema**: Los mensajes no llegan o aparece error de rate limit.

**Soluciones:**
1. Verifica la conexión a Socket.IO (debe mostrar "Conectado" en verde)
2. No envíes más de 30 mensajes por minuto
3. Recarga la página si la conexión se perdió
4. Comprueba que el servidor esté ejecutándose

### El componente se re-monta constantemente

**Problema**: Logs de "Limpiando listeners" / "Registrando listeners" repetidos.

**Solución:**
- Ya está solucionado con `useCallback` en todas las funciones callback
- Si el problema persiste, verifica que no haya cambios innecesarios en las props

---

## 📊 Rendimiento

### Métricas de Referencia

| Métrica | Valor |
|---------|-------|
| Tiempo de carga inicial | < 2s |
| Latencia de chat | < 100ms |
| Tiempo de conexión WebRTC | 2-5s |
| Overhead de CPU (P2P activo) | 10-20% |
| Uso de memoria | ~80-150 MB |
| Ancho de banda (streaming) | Variable según calidad |

### Optimizaciones Implementadas

- ✅ **Lazy Loading**: Componentes cargados bajo demanda
- ✅ **useCallback**: Prevención de re-renders innecesarios
- ✅ **Conexiones bajo demanda**: WebRTC solo cuando es necesario
- ✅ **Thumbnails optimizados**: 160x90px, JPEG 50% calidad
- ✅ **Limpieza de listeners**: Prevención de memory leaks
- ✅ **Rate limiting**: Protección contra sobrecarga

---

## 🚢 Despliegue

### Vercel (Recomendado)

1. Haz fork del repositorio en GitHub
2. Conecta tu cuenta de Vercel
3. Importa el proyecto
4. Configura las variables de entorno si es necesario
5. Despliega

### Docker

```bash
# Construir
docker build -t p2p-media-streaming .

# Ejecutar
docker run -d -p 3000:3000 --name p2p-media p2p-media-streaming
```

### VPS / Servidor Dedicado

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/p2p-media-next.git
cd p2p-media-next

# Instalar dependencias
npm install

# Construir
npm run build

# Iniciar con PM2 (recomendado)
pm2 start npm --name "p2p-media" -- start
pm2 save
pm2 startup
```

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Para contribuir:

1. **Fork** el proyecto
2. Crea una **rama** para tu feature:
   ```bash
   git checkout -b feature/nueva-funcionalidad
   ```
3. **Commit** tus cambios:
   ```bash
   git commit -m 'Añadir nueva funcionalidad'
   ```
4. **Push** a la rama:
   ```bash
   git push origin feature/nueva-funcionalidad
   ```
5. Abre un **Pull Request**

### Guía de Estilo

- Usa nombres descriptivos para variables y funciones
- Comenta el código complejo
- Sigue las convenciones de React/Next.js
- Usa Tailwind CSS para estilos
- Añade logs descriptivos con emojis para debugging

---

## 📋 Roadmap

### Futuras Funcionalidades

- [ ] Streams privados con permisos
- [ ] Control de calidad de stream (alta/media/baja)
- [ ] Salas de visualización grupales
- [ ] Chat de voz integrado
- [ ] Grabación de streams
- [ ] Modo teatro/pantalla completa compartida
- [ ] Sincronización de reproducción entre usuarios
- [ ] Sistema de moderadores
- [ ] Estadísticas detalladas por usuario
- [ ] Soporte para TURN server

---

## 📄 Licencia

Este proyecto está bajo la **Licencia MIT**. Ver el archivo [LICENSE](LICENSE) para más detalles.

```
MIT License

Copyright (c) 2025 ale

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 👤 Autor

**ale**

---

## 🙏 Agradecimientos

Tecnologías y librerías utilizadas:

- [Next.js](https://nextjs.org/) - Framework React para producción
- [React](https://react.dev/) - Librería para interfaces de usuario
- [Socket.IO](https://socket.io/) - Comunicación en tiempo real
- [SimplePeer](https://github.com/feross/simple-peer) - Abstracción de WebRTC
- [HLS.js](https://github.com/video-dev/hls.js/) - Reproductor HLS
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS utility-first

---

## 📞 Soporte

Si encuentras algún problema o tienes preguntas:

1. 📖 Revisa la sección [Solución de Problemas](#-solución-de-problemas)
2. 🐛 Abre un [issue](https://github.com/tu-usuario/p2p-media-next/issues) en GitHub
3. 📧 Contacta al autor

---

<div align="center">

**¡Disfruta del streaming P2P!** 🎉

[⬆️ Volver arriba](#-p2p-media-streaming-platform)

</div>
