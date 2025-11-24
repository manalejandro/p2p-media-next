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
    p2p: 0,
    uploadSpeed: 0,
    downloadSpeed: 0,
    peers: 0
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

  // Películas IPFS
  const ipfsMovies = [
    { name: 'A Magic Stick (2016)', url: '/ipfs/QmYM4LmQKoKj31qY2hdHDSvwRXURVfeadAv2Vggsn88BMR/index.m3u8' },
    { name: 'Attack the Block (2011)', url: '/ipfs/QmfAbJjE29Gr9DCnjhqbmLmXnhrcsxsusxMMn645U4n5Gb/index.m3u8' },
    { name: 'Barbarella (1967)', url: '/ipfs/QmVoHT7jGRStxRzKdBC1Y6jnW86UZuFC5t19a8xifB4ijG/index.m3u8' },
    { name: 'Bienvenidos a Marwen', url: '/ipfs/QmPdWaRUh5sDYBZXbbDo3G7AvNz9YHwJM8LXGc91dW1Efw/index.m3u8' },
    { name: 'Braveheart', url: '/ipfs/QmdP9Zf2UQmVFGp5qcqKUK7f38zv12mZYMZNaCFgm3MYaX/index.m3u8' },
    { name: 'Carmen y Lola (2018)', url: '/ipfs/QmbVAUnnDiLFmcF4ZVcoK7jkH3eQSnAGbJmEJSsSev6N2d/index.m3u8' },
    { name: 'Cementerio Viviente I (1989)', url: '/ipfs/QmcuzZLUAVz8dqCB1H2yPCDYg8vUTPqAnz7zAazfiyBMk4/index.m3u8' },
    { name: 'Cementerio Viviente II (1992)', url: '/ipfs/QmfG5umX5Kut28JVhrQv6WjdKposTxai8mWBJqTh4r7ydm/index.m3u8' },
    { name: 'Chinatown (1974)', url: '/ipfs/QmTgYVxeeNpwbZUwZgZcPxNky6ZwmLL7xhxyeTXMBkx8Em/index.m3u8' },
    { name: 'Chuck Norris VS Communism (2015)', url: '/ipfs/QmSssP22RNkVf8VEdKHMfr8gLPQcXcYpLMVa8LvYVPFf6h/index.m3u8' },
    { name: 'Coco (2018)', url: '/ipfs/QmVhEiFmW4J4cwRcupNG4FJNr8GSt6cyTzXa2L1nBEc7Vb/index.m3u8' },
    { name: 'Computer Chess (2013)', url: '/ipfs/QmV6DAMJMqdtYwTaV4HmFJ2DcDx61PbpoqNWpq3xiekD8o/index.m3u8' },
    { name: 'Death Race 2000 (1975)', url: '/ipfs/QmSqfuRS5DBYH2evhjGvfSgkkmhoB8DPgieCNhdKxpdvaJ/index.m3u8' },
    { name: 'Deep Blue Sea 1 (1999)', url: '/ipfs/QmWW99xKNt6uk3thYLa1igszvdrARB6HyX1f18WbZCd5Wp/index.m3u8' },
    { name: 'Deep Blue Sea 2 (2018)', url: '/ipfs/QmVWxF8hfScW2CyYBHoYZVgkm32Sgh5aeJXDS5gdyJJC5z/index.m3u8' },
    { name: 'Drácula y las Mellizas (1971)', url: '/ipfs/Qmc1AxAb6c1Q8Yr4STHv14EJTncPDDryir73TuK3zDhGbx/index.m3u8' },
    { name: 'Dumbo (1941)', url: '/ipfs/QmQVTZ7y4xNaeFmJMn2s7aUH87yGYezxAqu6CMBxCMVnDP/index.m3u8' },
    { name: 'Eduardo Manostijeras', url: '/ipfs/QmXvibjRfAYKajpaASF2PhD6PKecd8Q37aAGSP41X1hgjb/index.m3u8' },
    { name: 'El Astronauta (1970)', url: '/ipfs/QmdqsVYuXgyKVULxkM81YeD1r4ngj2NZdcg12QkxF4fHkK/index.m3u8' },
    { name: 'El Beso Mortal (1955)', url: '/ipfs/QmZWkB6FiZU1mVknkcvbMPNDxGWGHorey18Aom1zpipYGq/index.m3u8' },
    { name: 'El Fabuloso Mundo del Circo (1964)', url: '/ipfs/QmVeCgye1vPpZegzyyChWvtjJSPQNZrmYkMa2HgU7xQfgy/index.m3u8' },
    { name: 'El Gordo y el Flaco (2019)', url: '/ipfs/QmVMX79smxDmF7AXHjbMV8uTMUF65a1QcaVpCAXCr46P4G/index.m3u8' },
    { name: 'El Robobo de la Jojoya (1991)', url: '/ipfs/QmYHzRXyXo1NDwki72gLzxgY1azk4hUAR5BaBunoPsTkub/index.m3u8' },
    { name: 'Fireworks - Luces en el Cielo (2018)', url: '/ipfs/QmUvQnfRm2fsEUg3SAxpDPzitSUi7eZYK7ehm5YghNR6yK/index.m3u8' },
    { name: 'Forrest Gump', url: '/ipfs/QmQNnKnhy4ufGmbjtS7hZWAxHFUhueKm4JmQXYi1UDoUev/index.m3u8' },
    { name: 'Funny Games (1997)', url: '/ipfs/QmXqCDfv8rDhL5pVQwoa6jqBNL4HX3sN6y2cqpWf8wW2b3/index.m3u8' },
    { name: 'Gremlins 1 (1984)', url: '/ipfs/QmPYFb7CV3MFr1mLmzzkRdTDjgmE6ECukjme7ptDkbgi25/index.m3u8' },
    { name: 'Gremlins 2 (1990)', url: '/ipfs/QmYi9gPbCUTK4UZLL6QPhA6Cq57fxkj5yDv2RMckQa2Ttn/index.m3u8' },
    { name: 'Guía del Autoestopista Galáctico (2005)', url: '/ipfs/QmbDcJhvGwZjBdkNQ7P4dVaDap7pjMBbYrbkBGBKpzQJoH/index.m3u8' },
    { name: 'Hardware - Programado para Matar (1990)', url: '/ipfs/QmYu5DaPLnKGeApSSmZ2JfMVn1JwCjpNZ21Mh4PfULoRqp/index.m3u8' },
    { name: 'Historia de un Detective (1944)', url: '/ipfs/QmUdZYZB57STK3ZLUZnzVL21D2N3Tjznv8LAQVRyr4Zb4T/index.m3u8' },
    { name: 'Holmes y Watson (2019)', url: '/ipfs/QmQMME6dHkMxeyXr24Z9NNKG6pjmhdioh4NWMxyUoZRXmd/index.m3u8' },
    { name: 'House of Wax (1953)', url: '/ipfs/QmZcycbiYiKowg7PDv21XbnQt3eTKnjQProDwyn7BG6nNY/index.m3u8' },
    { name: 'Johnny Cogió su Fusil (1971)', url: '/ipfs/QmVaR18UpgaxNxSByrsjGDraeGb6JpNeHHzni4QdagwbbX/index.m3u8' },
    { name: 'Juegos de Guerra 1 (1983)', url: '/ipfs/QmWce8JG4zxxrcEoHSLFx8ynESks62SduqPbnb53Yc982j/index.m3u8' },
    { name: 'Jurassic Park I (1993)', url: '/ipfs/QmWaQYMeApjYaaepPgp7PswtGRo5HRRFSmqvoocDbjKiVw/index.m3u8' },
    { name: 'Jurassic Park II - The Lost World', url: '/ipfs/QmUXSUAsMDUhjdNYDXc8PSdLyUnGQiRQkgb5UJPVdh3xog/index.m3u8' },
    { name: 'Jurassic Park III', url: '/ipfs/QmcGTV4yvTPUeuVCGwmszq7Up4NggbAHwCFwU3da9CZGKv/index.m3u8' },
    { name: 'Jurassic World I (2015)', url: '/ipfs/QmYwahhy3gSAnsUBFciKFqE8ApZCQA8Posy5hGCYzqo9Ey/index.m3u8' },
    { name: 'Jurassic World II (2018)', url: '/ipfs/QmXVznbNBKUE6U2Sira9MHifhc2v2HLaqHLLR1KEnrGKXJ/index.m3u8' },
    { name: 'Kung Fury (2015)', url: '/ipfs/QmU3TcE5CMFJhBxURcRRPwzvcxoCg1H8yguJ6nx2Yn5z4j/index.m3u8' },
    { name: 'La Vuelta al Mundo en 80 Días (1956)', url: '/ipfs/QmfHf54Y8qe1UYzJh6Tvz5dFeqhCXb5JdnXSaBYEFNvSiA/index.m3u8' },
    { name: 'Los Goonies', url: '/ipfs/QmZymJCuwEdwd4YAWDeANJjN7JzDaEU7C8ukHtk7v4vMtE/index.m3u8' },
    { name: 'Luis y los Alienígenas (2018)', url: '/ipfs/QmXRc6sqLUuzLaACTY2ikjoWz1mve6etz7HDgkQk4TxLi3/index.m3u8' },
    { name: 'Mary Shelley', url: '/ipfs/QmeaYvu2t2dcKy6KqZ4Jaxk6NAtLNfeygSwb2Up5yq73TZ/index.m3u8' },
    { name: 'Matar a Dios (2019)', url: '/ipfs/QmQqZ5k6q5ZDMgDK5KFNYppWu7hb5nB4AfdizwPeKeTb9n/index.m3u8' },
    { name: 'NightCrawler (2014)', url: '/ipfs/QmQdDXHTF8j7i9SJLgFUNfh1rDMLCnVqUCwtZ9D58Lcxnb/index.m3u8' },
    { name: 'Ovejas Asesinas (2006)', url: '/ipfs/QmZeZqHGb7fZS6Np6zNa8xhTaP6AYduPWa7SiJB3UesJsq/index.m3u8' },
    { name: 'Porco Rosso (1992)', url: '/ipfs/QmZXc5xBvFfgipS42Jhcc5Xmt55Tgj53c9EXWHTswzUnLa/index.m3u8' },
    { name: 'Print the Legend - La Revolución en 3D (2014)', url: '/ipfs/QmahV7ZHiaBN1Zi6BLryxdCh12K8k17QTKfbDSAVjW7GyT/index.m3u8' },
    { name: 'Selfie (2018)', url: '/ipfs/QmTQTap9p2YueooeJm7mFd9NrDbiKptAcTZwdEaksTyJHJ/index.m3u8' },
    { name: 'Sevilla Connection (1992)', url: '/ipfs/QmaBHGqoASFyDGG3moQ33zyLepCnqngdCYfigHv2p2nMLo/index.m3u8' },
    { name: 'Silvio - Y los Otros', url: '/ipfs/QmaTwBVBXizQAe1pjHxZKP5Jgki2dn6j1m8fRjpWVPanC6/index.m3u8' },
    { name: 'Solaris (1972)', url: '/ipfs/QmNTGQChgJt9QS77bHywd2NH94s2JFsJPha6dU3XaGp1Ak/index.m3u8' },
    { name: 'Solaris (2002)', url: '/ipfs/QmNQNCdP7vNuGnwDnRAUef37BZKMJ8mvVaS189jSovVqty/index.m3u8' },
    { name: 'SuperLópez (2018)', url: '/ipfs/QmX3GncXmRBKS1JtRQFxxQLoasAcSe6u3vY8XS8r2Bd3sJ/index.m3u8' },
    { name: 'Terminator 1', url: '/ipfs/QmZ3fwPc4DTjDpoNH4AUyd8fPCodX9ML6n8jamjohL7SKx/index.m3u8' },
    { name: 'Terminator 2 - El Juicio Final (Extendida)', url: '/ipfs/QmdDQVYsAm3WezWCdPTf3p2pJyndnqNgeRonrLTU1eB6Ak/index.m3u8' },
    { name: 'The Stuff - La Sustancia Maldita (1985)', url: '/ipfs/QmQRphx4xvL9e9hkTESGJ17xpJbbhE8Dr8b7fuBkP8Bb3j/index.m3u8' },
    { name: 'Tron (1982)', url: '/ipfs/Qme8VjL34Z1nnFpYjuKBpfjHH8hqDybMYdxgdUdqp1o3wk/index.m3u8' },
    { name: 'Viernes 13 - 1 (1980)', url: '/ipfs/QmQoQpBwcoZ15PsAxgGM4F3LjZWWVvdpze1ehcKNYwiMrt/index.m3u8' },
    { name: 'Viernes 13 - 2 (1981)', url: '/ipfs/QmYyppJW2XAUugsUohNxKZu9zcJWTPLDofRnk5bSHNKQUE/index.m3u8' },
    { name: 'Viernes 13 - 3 (1982)', url: '/ipfs/QmUQYceesd2KUxTiebn96JWBXuMGbckxdzRM5ATWyJDnee/index.m3u8' },
    { name: 'Wall-E (2008)', url: '/ipfs/QmarqndauKZUbRLm2afnr2MRw9aV8ZekYHtEBLmcinNpM8/index.m3u8' },
    { name: 'Zelig (1983)', url: '/ipfs/QmfQtc37HaUtviR8LYqmmdphJpwKYF64ajMersg7vnRCA4/index.m3u8' },
    { name: 'Zombeavers - Castores Zombies (2014)', url: '/ipfs/QmbKxETWn99mPVHybaTRmmzU1AnuLevZx8EscLeZvpxgVK/index.m3u8' },
    { name: 'Pitch Black (2000)', url: '/ipfs/QmZWJpmERTtPTPd6aRGisA1h7dxPTLzJ7xrW6FhDFcAkx4/index.m3u8' },
    { name: 'El Irlandés (2019)', url: '/ipfs/QmbZm3bq2LJtfM1k9aTvB8pKXYmrTja6X2Z83BsgkK3mEU/index.m3u8' },
    { name: 'Las Aventuras de Ford Fairlane', url: '/ipfs/QmSWwAHHrnH2v1xE2HpSy1n5p88TLLNrHNPnCTUAAnBESS/index.m3u8' },
    { name: 'HellBoy (2004)', url: '/ipfs/QmP3xWwi9TGgBeVqoCB9zyTuv8zuaudwCJbGYSAdMYA3UP/index.m3u8' },
    { name: 'Las Cloacas de Interior', url: '/ipfs/QmSZoghvM8YQkHBTibJqCA3TGhCZRasZRF2QWu5qAj4Sj1/index.m3u8' }
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
    // Actualizar estadísticas P2P completas
    setStats(prev => ({
      ...prev,
      p2p: prev.p2p + (data.downloadSpeed || 0) * 5,
      uploadSpeed: data.uploadSpeed || 0,
      downloadSpeed: data.downloadSpeed || 0,
      peers: data.peers || 0
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
            <div className="flex items-center space-x-4">
              {/* Estadísticas P2P */}
              {peers > 0 && (
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-600">👥</span>
                    <span className="font-semibold text-blue-600">{stats.peers}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-600">⬆️</span>
                    <span className="font-semibold text-green-600">
                      {(stats.uploadSpeed / 1024).toFixed(1)} KB/s
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-600">⬇️</span>
                    <span className="font-semibold text-purple-600">
                      {(stats.downloadSpeed / 1024).toFixed(1)} KB/s
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">WebRTC Activo</span>
              </div>
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
              <h3 className="text-lg font-bold text-gray-800 mb-3">Seleccionar Contenido</h3>
              
              {/* Select de películas IPFS */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🎬 Películas en IPFS
                </label>
                <select
                  onChange={(e) => setVideoUrl(e.target.value)}
                  value={videoUrl}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                >
                  <option value="">-- Selecciona una película --</option>
                  {ipfsMovies.map((movie, index) => (
                    <option key={index} value={movie.url}>
                      {movie.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📺 Canales en vivo
                </label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {exampleVideos.map((video, index) => (
                    <button
                      key={index}
                      onClick={() => setVideoUrl(video.url)}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        videoUrl === video.url
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {video.name}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🔗 URL Personalizada
                </label>
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
              </div>
            </div>
            )}

            {/* Panel de Estadísticas P2P */}
            {stats.peers > 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg shadow-lg p-4 border-2 border-blue-200">
                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">📊</span>
                  Estadísticas P2P en Tiempo Real
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 shadow">
                    <p className="text-xs text-gray-600 mb-1">👥 Peers Conectados</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.peers}</p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 shadow">
                    <p className="text-xs text-gray-600 mb-1">⬆️ Subida</p>
                    <p className="text-xl font-bold text-green-600">
                      {(stats.uploadSpeed / 1024).toFixed(1)}
                    </p>
                    <p className="text-xs text-gray-500">KB/s</p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 shadow">
                    <p className="text-xs text-gray-600 mb-1">⬇️ Descarga</p>
                    <p className="text-xl font-bold text-purple-600">
                      {(stats.downloadSpeed / 1024).toFixed(1)}
                    </p>
                    <p className="text-xs text-gray-500">KB/s</p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 shadow">
                    <p className="text-xs text-gray-600 mb-1">📦 Total P2P</p>
                    <p className="text-lg font-bold text-orange-600">
                      {(stats.p2p / 1024 / 1024).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">MB</p>
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

            {/* Chat - altura fija con scroll interno */}
            <div className="h-[calc(100vh-12rem)] min-h-[600px]">
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
