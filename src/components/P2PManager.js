'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import SimplePeer from 'simple-peer';

/**
 * Configuración de servidores ICE
 * Usando el servidor STUN personalizado
 */
const ICE_SERVERS = {
  iceServers: [
    {
      urls: [
        'turn:manalejandro.com:5349',
        'stun:manalejandro.com:3478'
      ],
      username: 'manalejandro',
      credential: 'manalejandro.com'
    },
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302'
      ]
    }
  ]
};

/**
 * Gestor de conexiones P2P con WebRTC y streaming de video
 */
const P2PManager = forwardRef(({ 
  socket, 
  username, 
  onPeerStats, 
  onPeersUpdate,
  localStream = null,
  onRemoteStream = null,
  onNeedStream = null
}, ref) => {
  const [peers, setPeers] = useState([]);
  const [stats, setStats] = useState({
    uploadSpeed: 0,
    downloadSpeed: 0,
    totalUploaded: 0,
    totalDownloaded: 0,
    connectedPeers: 0
  });
  
  const peersRef = useRef({});
  const statsInterval = useRef(null);
  const uploadBytes = useRef(0);
  const downloadBytes = useRef(0);
  const localStreamRef = useRef(null);
  
  // Buffer para señales que llegan antes de crear el peer
  const pendingSignalsRef = useRef({});
  
  // Almacenar streams remotos recibidos por cada peer
  const remoteStreamsRef = useRef({});
  
  // Refs para callbacks para evitar re-renders
  const onPeerStatsRef = useRef(onPeerStats);
  const onPeersUpdateRef = useRef(onPeersUpdate);
  const onRemoteStreamRef = useRef(onRemoteStream);
  const onNeedStreamRef = useRef(onNeedStream);

  // Actualizar refs cuando cambien las callbacks
  useEffect(() => {
    onPeerStatsRef.current = onPeerStats;
    onPeersUpdateRef.current = onPeersUpdate;
    onRemoteStreamRef.current = onRemoteStream;
    onNeedStreamRef.current = onNeedStream;
  }, [onPeerStats, onPeersUpdate, onRemoteStream, onNeedStream]);

  // Exponer métodos al componente padre
  useImperativeHandle(ref, () => ({
    requestPeer: (targetUser) => {
      return requestPeer(targetUser);
    }
  }));

  // Mantener referencia actualizada del stream local
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    if (!socket || !username) {
      return;
    }

    socket.emit('test-connection-request', { user: username });

    // Escuchar solicitud de watch (alguien quiere ver MI stream)
    socket.on('request-watch', (data) => {
      if (data && data.from) {
        if (!localStreamRef.current && onNeedStreamRef.current) {
          onNeedStreamRef.current();
        }
      }
    });

    // Escuchar solicitudes de peers (el viewer quiere vernos)
    socket.on('peer-requested', (data) => {
      if (!data || !data.from) return;
      
      // Verificar si ya existe un peer
      const existingPeer = peersRef.current[data.from];
      if (existingPeer) {
        if (existingPeer.connected && !existingPeer.destroyed) {
          return;
        } else {
          existingPeer.destroy();
          delete peersRef.current[data.from];
        }
      }
      
      // Función para iniciar el peer con stream
      const startPeerWithStream = () => {
        // Verificar nuevamente que no se haya creado mientras esperábamos
        if (peersRef.current[data.from]) {
          return;
        }
        
        if (localStreamRef.current) {
          // Responder como NO initiator pero CON stream
          initiatePeer(data.from, false, null, true);
        } else {
          // Responder de todas formas, aunque sea sin stream
          initiatePeer(data.from, false, null, false);
        }
      };
      
      // Primero, capturar stream si no lo tenemos
      if (!localStreamRef.current && onNeedStreamRef.current) {
        onNeedStreamRef.current();
        setTimeout(startPeerWithStream, 1500);
      } else if (localStreamRef.current) {
        setTimeout(startPeerWithStream, 200);
      } else {
        console.error('❌ No hay stream NI callback para capturarlo');
        setTimeout(startPeerWithStream, 200);
      }
    });

    // Escuchar señales de WebRTC
    socket.on('signal', (data) => {
      if (peersRef.current[data.from]) {
        try {
          peersRef.current[data.from].signal(data.signal);
        } catch (error) {
          console.error('❌ Error al procesar señal:', error);
          delete peersRef.current[data.from];
          setPeers(prev => prev.filter(p => p !== data.from));
        }
      } else {
        // Si no existe el peer, almacenar la señal para procesarla después
        if (!pendingSignalsRef.current[data.from]) {
          pendingSignalsRef.current[data.from] = [];
        }
        pendingSignalsRef.current[data.from].push(data.signal);
      }
    });

    // Usuario no encontrado
    socket.on('peer-not-found', (data) => {
      console.error(`❌ Usuario no encontrado: ${data.user} - ${data.message}`);
      alert(`No se puede conectar: ${data.message}`);
    });

    // Intervalo para calcular estadísticas
    statsInterval.current = setInterval(() => {
      const uploadSpeed = uploadBytes.current / 5;
      const downloadSpeed = downloadBytes.current / 5;
      
      setStats(prev => ({
        uploadSpeed,
        downloadSpeed,
        totalUploaded: prev.totalUploaded + uploadBytes.current,
        totalDownloaded: prev.totalDownloaded + downloadBytes.current,
        connectedPeers: Object.keys(peersRef.current).length
      }));

      if (onPeerStatsRef.current) {
        onPeerStatsRef.current({
          uploadSpeed,
          downloadSpeed,
          totalUploaded: uploadBytes.current,
          totalDownloaded: downloadBytes.current,
          peers: Object.keys(peersRef.current).length
        });
      }

      uploadBytes.current = 0;
      downloadBytes.current = 0;
    }, 5000);

    return () => {
      socket.off('request-watch');
      socket.off('peer-requested');
      socket.off('signal');
      socket.off('peer-not-found');
      
      Object.values(peersRef.current).forEach(peer => {
        if (peer) peer.destroy();
      });
      peersRef.current = {};
      pendingSignalsRef.current = {};
      remoteStreamsRef.current = {};
      
      if (statsInterval.current) {
        clearInterval(statsInterval.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, username]);

  const initiatePeer = (targetUser, initiator, initialSignal = null, includeStream = false) => {
    if (peersRef.current[targetUser]) {
      return;
    }

    const peerConfig = {
      initiator,
      trickle: true,
      config: ICE_SERVERS
    };

    if (includeStream && localStreamRef.current) {
      peerConfig.stream = localStreamRef.current;
    }

    const peer = new SimplePeer(peerConfig);

    peersRef.current[targetUser] = peer;

    // Procesar señales pendientes si las hay
    if (pendingSignalsRef.current[targetUser] && pendingSignalsRef.current[targetUser].length > 0) {
      const signals = pendingSignalsRef.current[targetUser];
      delete pendingSignalsRef.current[targetUser];
      
      signals.forEach((signal) => {
        try {
          peer.signal(signal);
        } catch (error) {
          console.error('❌ Error procesando señal pendiente:', error);
        }
      });
    }

    peer.on('signal', (signal) => {
      socket.emit('signal', {
        to: targetUser,
        signal: signal
      });
    });

    peer.on('connect', () => {
      console.log(`✅ Peer conectado con ${targetUser}`);
      setPeers(prev => {
        const newPeers = [...prev, targetUser];
        if (onPeersUpdateRef.current) onPeersUpdateRef.current(newPeers);
        return newPeers;
      });
      
      // Iniciar monitoreo de estadísticas WebRTC cada 1 segundo
      const statsMonitor = setInterval(async () => {
        if (!peer._pc || peer.destroyed) {
          clearInterval(statsMonitor);
          return;
        }
        
        try {
          const stats = await peer._pc.getStats();
          let bytesReceived = 0;
          let bytesSent = 0;
          
          stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
              bytesReceived += report.bytesReceived || 0;
            }
            if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
              bytesSent += report.bytesSent || 0;
            }
          });
          
          // Guardar stats anteriores para calcular delta
          if (!peer._lastStats) {
            peer._lastStats = { bytesReceived, bytesSent, timestamp: Date.now() };
          } else {
            const deltaTime = (Date.now() - peer._lastStats.timestamp) / 1000;
            const deltaReceived = bytesReceived - peer._lastStats.bytesReceived;
            const deltaSent = bytesSent - peer._lastStats.bytesSent;
            
            if (deltaTime > 0) {
              downloadBytes.current += deltaReceived;
              uploadBytes.current += deltaSent;
            }
            
            peer._lastStats = { bytesReceived, bytesSent, timestamp: Date.now() };
          }
        } catch (err) {
          // Ignorar errores de stats
        }
      }, 1000);
      
      // Guardar el interval en el peer para limpiarlo después
      peer._statsMonitor = statsMonitor;
    });

    peer.on('data', (data) => {
      downloadBytes.current += data.length;
    });

    peer.on('stream', (remoteStream) => {
      remoteStreamsRef.current[targetUser] = remoteStream;
      
      if (onRemoteStreamRef.current) {
        onRemoteStreamRef.current(targetUser, remoteStream);
      }
    });

    peer.on('close', () => {
      console.log(`🔌 Peer cerrado con ${targetUser}`);
      if (peer._statsMonitor) {
        clearInterval(peer._statsMonitor);
      }
      if (peersRef.current[targetUser] === peer) {
        delete peersRef.current[targetUser];
        delete remoteStreamsRef.current[targetUser];
        setPeers(prev => {
          const newPeers = prev.filter(p => p !== targetUser);
          if (onPeersUpdateRef.current) onPeersUpdateRef.current(newPeers);
          return newPeers;
        });
      }
    });

    peer.on('error', (err) => {
      console.error('❌ Error en peer', targetUser, ':', err.message || err);
      if (peer._statsMonitor) {
        clearInterval(peer._statsMonitor);
      }
      if (peersRef.current[targetUser] === peer) {
        delete peersRef.current[targetUser];
        delete remoteStreamsRef.current[targetUser];
        setPeers(prev => {
          const newPeers = prev.filter(p => p !== targetUser);
          if (onPeersUpdateRef.current) onPeersUpdateRef.current(newPeers);
          return newPeers;
        });
      }
    });

    if (initialSignal) {
      try {
        peer.signal(initialSignal);
      } catch (error) {
        console.error('❌ Error al procesar señal inicial:', error);
      }
    }
  };

  const requestPeer = (targetUser) => {
    const existingPeer = peersRef.current[targetUser];
    if (existingPeer) {
      if (existingPeer.connected && !existingPeer.destroyed) {
        const existingStream = remoteStreamsRef.current[targetUser];
        if (existingStream && onRemoteStreamRef.current) {
          onRemoteStreamRef.current(targetUser, existingStream);
        }
        return existingPeer;
      } else {
        existingPeer.destroy();
        delete peersRef.current[targetUser];
        delete remoteStreamsRef.current[targetUser];
        setTimeout(() => {
          socket.emit('request-peer', { to: targetUser });
          initiatePeer(targetUser, true, null, false);
        }, 100);
        return null;
      }
    }
    
    socket.emit('request-peer', { to: targetUser });
    initiatePeer(targetUser, true, null, false);
    return peersRef.current[targetUser];
  };

  const addStreamToPeers = (stream) => {
    Object.entries(peersRef.current).forEach(([user, peer]) => {
      try {
        if (peer && peer.connected) {
          peer.addStream(stream);
        }
      } catch (error) {
        console.error('❌ Error añadiendo stream a peer:', error);
      }
    });
  };

  const sendData = (data) => {
    let sent = 0;
    Object.values(peersRef.current).forEach(peer => {
      try {
        if (peer && peer.connected) {
          peer.send(data);
          sent++;
        }
      } catch (error) {
        console.error('❌ Error al enviar datos:', error);
      }
    });
    
    if (sent > 0) {
      uploadBytes.current += data.length * sent;
    }
    
    return sent;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4">Conexiones P2P</h3>
      
      {/* Estadísticas */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-50 rounded p-3">
          <p className="text-xs text-gray-600">Peers Conectados</p>
          <p className="text-2xl font-bold text-blue-600">{stats.connectedPeers}</p>
        </div>
        
        <div className="bg-green-50 rounded p-3">
          <p className="text-xs text-gray-600">Subida</p>
          <p className="text-lg font-bold text-green-600">
            {(stats.uploadSpeed / 1024).toFixed(1)} KB/s
          </p>
          <p className="text-xs text-gray-500">
            Total: {(stats.totalUploaded / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
        
        <div className="bg-purple-50 rounded p-3">
          <p className="text-xs text-gray-600">Descarga</p>
          <p className="text-lg font-bold text-purple-600">
            {(stats.downloadSpeed / 1024).toFixed(1)} KB/s
          </p>
          <p className="text-xs text-gray-500">
            Total: {(stats.totalDownloaded / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
        
        <div className="bg-yellow-50 rounded p-3">
          <p className="text-xs text-gray-600">Configuración</p>
          <p className="text-xs font-medium text-yellow-800">STUN Server</p>
          <p className="text-xs text-gray-600">manalejandro.com:3478</p>
        </div>
      </div>

      {/* Lista de peers */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Peers Conectados:</h4>
        {peers.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Sin conexiones P2P activas</p>
        ) : (
          <div className="space-y-1">
            {peers.map((peer, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-700">{peer}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

P2PManager.displayName = 'P2PManager';

export default P2PManager;
