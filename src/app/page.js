'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer';
import Chat from '@/components/Chat';
import P2PManager from '@/components/P2PManager';
import { io } from 'socket.io-client';

export default function Home() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [socket, setSocket] = useState(null);
  const [peers, setPeers] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [watchingUser, setWatchingUser] = useState(null);
  const [isCapturingStream, setIsCapturingStream] = useState(false);
  const videoPlayerRef = useRef(null);
  const p2pManagerRef = useRef(null);
  const [stats, setStats] = useState({
    http: 0,
    p2p: 0
  });

  // URLs de ejemplo - usando proxy del servidor
  const exampleVideos = [
    {
      name: 'RTVE - La 1',
      url: '/api/stream/rtve-la1'
    },
    {
      name: 'RTVE - La 2',
      url: '/api/stream/rtve-la2'
    },
    {
      name: 'RTVE - 24H',
      url: '/api/stream/rtve-24h'
    }
  ];

  useEffect(() => {
    // Obtener URL del parámetro de búsqueda
    const urlParam = searchParams.get('url');
    if (urlParam) {
      setVideoUrl(urlParam);
    } else {
      setVideoUrl(exampleVideos[0].url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleVideoStats = useCallback((data) => {
    setStats(prev => ({
      ...prev,
      http: prev.http + (data.bytes || 0)
    }));
  }, []);

  const handlePeerStats = useCallback((data) => {
    // Actualizar estadísticas P2P - usar los deltas que envía el componente
    setStats(prev => ({
      ...prev,
      p2p: prev.p2p + (data.downloadSpeed || 0) * 5 // velocidad * 5 segundos = bytes descargados en este intervalo
    }));
  }, []);

  const handleSocketReady = useCallback((socketInstance) => {
    console.log('🔌 Socket listo para P2P');
    setSocket(socketInstance);
  }, []);

  const handlePeersUpdate = useCallback((peersList) => {
    setPeers(peersList);
  }, []);

  const captureLocalStream = useCallback(() => {
    if (isCapturingStream) {
      console.log('⏳ Ya se está capturando stream, esperando...');
      return;
    }
    
    if (!videoPlayerRef.current) {
      console.error('❌ No hay referencia al video player');
      return;
    }
    
    setIsCapturingStream(true);
    const video = videoPlayerRef.current.querySelector('video');
    
    if (!video) {
      console.error('❌ No se encontró elemento video en el DOM');
      setIsCapturingStream(false);
      return;
    }

    console.log('🎥 Intentando capturar stream del video...');
    
    try {
      let stream = null;
      if (video.captureStream) {
        stream = video.captureStream();
      } else if (video.mozCaptureStream) {
        stream = video.mozCaptureStream();
      }
      
      if (stream && stream.getTracks().length > 0) {
        console.log('✅ Stream local capturado exitosamente');
        console.log('Tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));
        setLocalStream(stream);
      } else {
        console.error('❌ No se pudo capturar el stream o no tiene tracks');
        setIsCapturingStream(false);
      }
    } catch (err) {
      console.error('❌ Error capturando stream:', err);
      setIsCapturingStream(false);
    } finally {
      // Resetear la bandera después de un timeout
      setTimeout(() => setIsCapturingStream(false), 2000);
    }
  }, [isCapturingStream]);

  const handleRemoteStream = useCallback((fromUser, stream) => {
    console.log('📺 Stream remoto recibido de:', fromUser);
    setRemoteStream(stream);
    setWatchingUser(fromUser);
  }, []);

  const handleWatchUser = useCallback((targetUser) => {
    // Validar que no sea el mismo usuario
    if (targetUser === username) {
      console.error('❌ No puedes ver tu propio stream');
      alert('No puedes ver tu propio stream. Conéctate desde otro navegador o dispositivo.');
      return;
    }
    
    console.log('👁️ Solicitando ver a:', targetUser);
    console.log('Estado actual:', {
      socket: !!socket,
      socketConnected: socket?.connected,
      p2pManager: !!p2pManagerRef.current,
      hasRequestPeer: !!p2pManagerRef.current?.requestPeer,
      watchingUser,
      remoteStream: !!remoteStream,
      targetUser,
      myUsername: username
    });
    
    setWatchingUser(targetUser);
    setRemoteStream(null);
    
    // Usar el P2PManager para iniciar la conexión
    if (p2pManagerRef.current && p2pManagerRef.current.requestPeer) {
      console.log('✅ Llamando a requestPeer para:', targetUser);
      p2pManagerRef.current.requestPeer(targetUser);
    } else {
      console.error('❌ No hay P2PManager o requestPeer disponible');
    }
  }, [socket, watchingUser, remoteStream, username]);

  const handleStopWatching = useCallback(() => {
    setWatchingUser(null);
    setRemoteStream(null);
  }, []);

  const loadCustomUrl = () => {
    if (customUrl.trim()) {
      // Si la URL es externa, usar el proxy
      const url = customUrl.trim();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        setVideoUrl(`/api/proxy?url=${encodeURIComponent(url)}`);
      } else {
        setVideoUrl(url);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                P2P Media Streaming
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Streaming de video con tecnología P2P y chat en tiempo real
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">WebRTC Activo</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Principal - Video */}
          <div className="lg:col-span-2 space-y-6">
            {/* Banner de stream remoto */}
            {watchingUser && (
              <div className="bg-purple-100 border-2 border-purple-500 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">📺</span>
                    <div>
                      <h3 className="text-lg font-bold text-purple-900">
                        Viendo el reproductor de {watchingUser}
                      </h3>
                      <p className="text-sm text-purple-700">
                        {remoteStream ? '🟢 Conectado' : '🟡 Conectando...'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleStopWatching}
                    className="bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    ✕ Cerrar
                  </button>
                </div>
              </div>
            )}
            
            {/* URL personalizada */}
            {!watchingUser && (
              <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-3">URL de Video Personalizada</h3>
              <p className="text-xs text-gray-500 mb-2">
                💡 Las URLs externas se procesan a través de nuestro proxy para evitar problemas de CORS
              </p>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://ejemplo.com/stream.m3u8"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={loadCustomUrl}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-2 rounded-lg transition-colors"
                >
                  Cargar
                </button>
              </div>
              
              {/* Videos de ejemplo */}
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Videos de ejemplo:</p>
                <div className="flex flex-wrap gap-2">
                  {exampleVideos.map((video, index) => (
                    <button
                      key={index}
                      onClick={() => setVideoUrl(video.url)}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-full transition-colors"
                    >
                      {video.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            )}

            {/* Video Player */}
            <div className="bg-white rounded-lg shadow-lg p-4" ref={videoPlayerRef}>
              {watchingUser ? (
                // Modo watching: mostrar stream remoto o mensaje de carga
                remoteStream ? (
                  <VideoPlayer
                    isRemoteStream={true}
                    remoteStream={remoteStream}
                    socket={socket}
                    username={username}
                    peers={peers}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg p-12 min-h-[400px]">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mb-4"></div>
                    <h3 className="text-2xl font-bold text-purple-900 mb-2">
                      Conectando con {watchingUser}...
                    </h3>
                    <p className="text-purple-700 text-center">
                      Estableciendo conexión P2P
                    </p>
                    <button
                      onClick={handleStopWatching}
                      className="mt-6 bg-red-500 hover:bg-red-600 text-white font-medium px-6 py-2 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                )
              ) : (
                // Modo normal: video propio
                <VideoPlayer 
                  key={videoUrl}
                  url={videoUrl} 
                  onStats={handleVideoStats}
                  socket={socket}
                  username={username}
                  peers={peers}
                />
              )}
            </div>


          </div>

          {/* Columna Lateral - Chat */}
          <div className="space-y-6">
            {/* P2P Manager (oculto) */}
            <div className="hidden">
              <P2PManager 
                ref={p2pManagerRef}
                socket={socket}
                username={username}
                onPeerStats={handlePeerStats}
                onPeersUpdate={handlePeersUpdate}
                localStream={localStream}
                onRemoteStream={handleRemoteStream}
                onNeedStream={captureLocalStream}
              />
            </div>

            {/* Chat */}
            <div className="h-full">
              <Chat 
                username={username}
                onUsernameChange={setUsername}
                onSocketReady={handleSocketReady}
                onWatchUser={handleWatchUser}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white shadow-md mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-gray-600 text-sm">
            <p className="font-semibold mb-2">P2P Media Streaming Platform</p>
            <p>Desarrollado con Next.js, Socket.IO, WebRTC y HLS.js</p>
            <p className="mt-2 text-xs text-gray-500">
              © 2025 - Streaming P2P sin WebTorrent | Servidor STUN: manalejandro.com:3478
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
