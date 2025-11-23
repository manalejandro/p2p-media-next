const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const https = require('https');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Configuración de streams disponibles
const STREAM_SOURCES = {
  'rtve-la1': 'https://ztnr.rtve.es/ztnr/1688877.m3u8',
  'rtve-la2': 'https://ztnr.rtve.es/ztnr/3987218.m3u8',
  'rtve-24h': 'https://rtvelivestream.rtve.es/rtvesec/24h/24h_main_dvr_720.m3u8'
};

// Rate limiting por IP
const rateLimits = new Map();
const MAX_MESSAGES_PER_MINUTE = 30;
const MAX_CONNECTIONS_PER_IP = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  const userLimit = rateLimits.get(ip) || { count: 0, resetTime: now + 60000 };
  
  if (now > userLimit.resetTime) {
    userLimit.count = 0;
    userLimit.resetTime = now + 60000;
  }
  
  userLimit.count++;
  rateLimits.set(ip, userLimit);
  
  return userLimit.count <= MAX_MESSAGES_PER_MINUTE;
}

// Validación de datos
function sanitizeMessage(msg) {
  if (typeof msg !== 'string') return '';
  // Limitar longitud del mensaje
  msg = msg.substring(0, 500);
  // Eliminar caracteres peligrosos
  return msg.replace(/[<>]/g, '');
}

function sanitizeUsername(username) {
  if (typeof username !== 'string') return '';
  // Limitar longitud del nombre de usuario
  username = username.substring(0, 30);
  // Solo permitir caracteres alfanuméricos, espacios, guiones y guiones bajos
  return username.replace(/[^a-zA-Z0-9 _-]/g, '');
}

// Función para hacer proxy de streams con soporte para redirecciones
function proxyStream(sourceUrl, req, res, redirectCount = 0) {
  const MAX_REDIRECTS = 5;
  
  if (redirectCount > MAX_REDIRECTS) {
    console.error('Demasiadas redirecciones para:', sourceUrl);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error: Demasiadas redirecciones');
    return;
  }

  const urlParts = new URL(sourceUrl);
  const isHttps = urlParts.protocol === 'https:';
  const httpModule = isHttps ? https : require('http');
  
  // Construir headers que parezcan de un navegador real
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Accept-Encoding': 'identity',  // No solicitar compresión para evitar problemas
    'Connection': 'keep-alive',
    'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'DNT': '1'
  };

  // Para RTVE, agregar headers específicos y muy importante el Referer
  if (urlParts.hostname.includes('rtve.es')) {
    headers['Origin'] = 'https://www.rtve.es';
    headers['Referer'] = 'https://www.rtve.es/play/videos/directo/la-1/';
  }
  
  const options = {
    hostname: urlParts.hostname,
    port: isHttps ? 443 : 80,
    path: urlParts.pathname + urlParts.search,
    method: 'GET',
    headers: headers
  };

  const proxyReq = httpModule.request(options, (proxyRes) => {
    // Manejar redirecciones (301, 302, 303, 307, 308)
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      const redirectUrl = new URL(proxyRes.headers.location, sourceUrl).href;
      
      // Consumir completamente la respuesta antes de redirigir
      proxyRes.resume();
      
      // Llamar recursivamente para seguir la redirección
      proxyStream(redirectUrl, req, res, redirectCount + 1);
      return;
    }

    // Si no es un 200, devolver error
    if (proxyRes.statusCode !== 200) {
      console.error(`Error de stream: ${proxyRes.statusCode} para ${sourceUrl}`);
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(`Error: Stream devolvió código ${proxyRes.statusCode}`);
      return;
    }

    // Copiar headers de la respuesta para código 200
    const responseHeaders = {
      'Content-Type': proxyRes.headers['content-type'] || 'application/vnd.apple.mpegurl',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': proxyRes.headers['cache-control'] || 'no-cache',
      'Connection': 'keep-alive'
    };

    // Si es un archivo .m3u8, procesar el contenido para actualizar las URLs
    if (sourceUrl.endsWith('.m3u8') || proxyRes.headers['content-type']?.includes('mpegurl')) {
      let data = '';
      proxyRes.setEncoding('utf8');
      
      proxyRes.on('data', (chunk) => {
        data += chunk;
      });

      proxyRes.on('end', () => {
        try {
          const baseUrl = sourceUrl.substring(0, sourceUrl.lastIndexOf('/') + 1);
          
          const lines = data.split('\n').map(line => {
            line = line.trim();
            // Si la línea es una URL (no es comentario ni está vacía)
            if (line && !line.startsWith('#')) {
              let fullUrl;
              
              // Si es una URL absoluta, usarla directamente
              if (line.startsWith('http')) {
                fullUrl = line;
              } else {
                // Si es relativa, construir la URL completa
                fullUrl = baseUrl + line;
              }
              
              // Solo proxear otros .m3u8, los .ts van directo (sin proxy)
              if (fullUrl.endsWith('.m3u8')) {
                const protocol = req.headers['x-forwarded-proto'] || 'http';
                const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
                const proxyBaseUrl = `${protocol}://${host}/api/proxy?url=`;
                return proxyBaseUrl + encodeURIComponent(fullUrl);
              } else {
                // Los .ts van directo al origen, sin proxy
                return fullUrl;
              }
            }
            return line;
          });
          
          res.writeHead(200, responseHeaders);
          res.end(lines.join('\n'));
        } catch (err) {
          console.error('Error procesando playlist:', err);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error al procesar el playlist');
        }
      });
    } else {
      // Para archivos .ts (nunca deberían llegar aquí si la config es correcta)
      res.writeHead(200, responseHeaders);
      proxyRes.pipe(res);
    }
  });

  proxyReq.on('error', (err) => {
    console.error('Error en proxy:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      });
      res.end('Error al obtener el stream');
    }
  });

  proxyReq.setTimeout(30000, () => {
    console.error('Timeout en proxy:', sourceUrl);
    proxyReq.destroy();
    if (!res.headersSent) {
      res.writeHead(504, { 
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      });
      res.end('Timeout al obtener el stream');
    }
  });

  proxyReq.end();
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname, query } = parsedUrl;

    // Endpoint para streams proxy
    if (pathname.startsWith('/api/stream/')) {
      const streamId = pathname.replace('/api/stream/', '');
      
      if (STREAM_SOURCES[streamId]) {
        proxyStream(STREAM_SOURCES[streamId], req, res);
        return;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Stream no encontrado');
        return;
      }
    }

    // Endpoint para proxy de URL personalizada
    if (pathname === '/api/proxy' && query.url) {
      try {
        const targetUrl = decodeURIComponent(query.url);
        
        // Validar que sea una URL HTTPS válida
        if (!targetUrl.startsWith('https://') && !targetUrl.startsWith('http://')) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('URL inválida');
          return;
        }

        proxyStream(targetUrl, req, res);
        return;
      } catch (err) {
        console.error('Error al procesar URL:', err);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('URL inválida');
        return;
      }
    }

    // Manejar solicitudes normales de Next.js
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    // Limitar tamaño de mensajes
    maxHttpBufferSize: 1e6, // 1MB
    // Configurar timeouts
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Almacenar usuarios conectados
  const connectedUsers = new Map();
  const ipConnections = new Map();
  const userThumbnails = new Map();

  io.on('connection', (socket) => {
    const clientIp = socket.handshake.address;
    
    // Verificar límite de conexiones por IP
    const currentConnections = ipConnections.get(clientIp) || 0;
    if (currentConnections >= MAX_CONNECTIONS_PER_IP) {
      socket.disconnect(true);
      return;
    }
    
    ipConnections.set(clientIp, currentConnections + 1);

    // Registro de usuario
    socket.on('register', (data) => {
      try {
        if (!data || !data.user) {
          socket.emit('error', 'Datos de registro inválidos');
          return;
        }

        const username = sanitizeUsername(data.user);
        if (!username || username.length < 2) {
          socket.emit('error', 'Nombre de usuario inválido');
          return;
        }

        // Verificar si el usuario ya existe
        const existingUser = Array.from(connectedUsers.values()).find(u => u.username === username);
        if (existingUser) {
          socket.emit('rejoin', { user: username });
          return;
        }

        // Registrar usuario
        connectedUsers.set(socket.id, { username, ip: clientIp });
        socket.username = username;

        // Enviar lista de usuarios al nuevo usuario
        const usersList = Array.from(connectedUsers.values()).map(u => u.username);
        socket.emit('users', { users: usersList });

        // Notificar a otros usuarios
        socket.broadcast.emit('adduser', { user: username });
        io.emit('join', { user: username });

      } catch (error) {
        console.error('Error en registro:', error);
        socket.emit('error', 'Error al registrar usuario');
      }
    });

    // Test de conexión para debugging
    socket.on('test-connection-request', (data) => {
      socket.emit('test-connection');
    });

    // Mensajes de chat
    socket.on('emit msg', (data) => {
      try {
        if (!socket.username) {
          socket.emit('error', 'Usuario no registrado');
          return;
        }

        // Rate limiting
        if (!checkRateLimit(clientIp)) {
          socket.emit('error', 'Demasiados mensajes, espera un momento');
          return;
        }

        if (!data || !data.chat) {
          return;
        }

        const message = sanitizeMessage(data.chat);
        if (!message || message.trim().length === 0) {
          return;
        }

        // Broadcast del mensaje
        socket.broadcast.emit('msg', {
          user: socket.username,
          chat: message,
          timestamp: Date.now()
        });

      } catch (error) {
        console.error('Error al enviar mensaje:', error);
      }
    });

    // Señalización WebRTC para P2P
    socket.on('signal', (data) => {
      try {
        if (!socket.username) return;

        if (!data || !data.to || !data.signal) {
          return;
        }

        // Encontrar el socket del destinatario
        const targetSocket = Array.from(io.sockets.sockets.values())
          .find(s => s.username === data.to);

        if (targetSocket) {
          targetSocket.emit('signal', {
            from: socket.username,
            signal: data.signal
          });
        }
      } catch (error) {
        console.error('Error en señalización:', error);
      }
    });

    // Solicitar peer
    socket.on('request-peer', (data) => {
      try {
        if (!socket.username || !data || !data.to) {
          return;
        }

        const targetSocket = Array.from(io.sockets.sockets.values())
          .find(s => s.username === data.to);

        if (targetSocket) {
          targetSocket.emit('peer-requested', {
            from: socket.username
          });
        } else {
          const allUsers = Array.from(connectedUsers.values()).map(u => u.username);
          
          socket.emit('peer-not-found', {
            user: data.to,
            message: `El usuario ${data.to} no está conectado`
          });
        }
      } catch (error) {
        console.error('Error al solicitar peer:', error);
      }
    });

    // Solicitar ver stream de usuario
    socket.on('request-watch', (data) => {
      try {
        if (!socket.username) return;

        if (!data || !data.target) return;

        const targetSocket = Array.from(io.sockets.sockets.values())
          .find(s => s.username === data.target);

        if (targetSocket) {
          // Notificar al target que alguien quiere ver su stream
          targetSocket.emit('request-watch', {
            from: socket.username
          });
        }
      } catch (error) {
        console.error('Error al solicitar watch:', error);
      }
    });

    // Recibir thumbnail de video del usuario
    socket.on('video-thumbnail', (data) => {
      try {
        if (!socket.username) return;

        // Broadcast del thumbnail a todos los demás usuarios
        socket.broadcast.emit('user-thumbnail', {
          user: socket.username,
          thumbnail: data.thumbnail,
          isPlaying: data.isPlaying,
          currentTime: data.currentTime,
          duration: data.duration
        });
      } catch (error) {
        console.error('Error al procesar thumbnail:', error);
      }
    });

    // Desconexión
    socket.on('disconnect', () => {
      try {
        if (socket.username) {
          connectedUsers.delete(socket.id);
          userThumbnails.delete(socket.username);
          
          const usersList = Array.from(connectedUsers.values()).map(u => u.username);
          io.emit('users', { users: usersList });
          io.emit('quit', { msg: `QUITS ${socket.username}` });
        }

        // Decrementar contador de conexiones por IP
        const currentConnections = ipConnections.get(clientIp) || 1;
        if (currentConnections <= 1) {
          ipConnections.delete(clientIp);
        } else {
          ipConnections.set(clientIp, currentConnections - 1);
        }
      } catch (error) {
        console.error('Error en desconexión:', error);
      }
    });
  });

  // Limpiar rate limits cada minuto
  setInterval(() => {
    const now = Date.now();
    for (const [ip, limit] of rateLimits.entries()) {
      if (now > limit.resetTime + 60000) {
        rateLimits.delete(ip);
      }
    }
  }, 60000);

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Servidor listo en http://${hostname}:${port}`);
    console.log(`> Socket.IO listo con protección contra ataques`);
  });
});
