'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export default function VideoPlayer({ 
  url, 
  onStats, 
  socket, 
  peers = [], 
  username,
  isRemoteStream = false,
  remoteStream = null
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);
  const isInitializedRef = useRef(false);
  const segmentCache = useRef(new Map());
  const canvasRef = useRef(null);
  const thumbnailIntervalRef = useRef(null);

  // Efecto para manejar stream remoto
  useEffect(() => {
    if (!isRemoteStream || !remoteStream || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    video.srcObject = remoteStream;
    video.play().catch(err => {
      console.error('❌ Error reproduciendo stream remoto:', err);
    });

    return () => {
      if (video.srcObject) {
        video.srcObject = null;
      }
    };
  }, [isRemoteStream, remoteStream]);

  // Efecto para capturar thumbnails (solo thumbnails, NO stream automático)
  useEffect(() => {
    if (!videoRef.current || !socket || !username || isRemoteStream) return;

    const video = videoRef.current;
    let canvas = canvasRef.current;
    
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }

    // Capturar thumbnail del video cada 3 segundos
    thumbnailIntervalRef.current = setInterval(() => {
      if (video.readyState >= 2 && !video.paused) {
        try {
          canvas.width = 160;
          canvas.height = 90;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.5);
          
          // Emitir thumbnail al servidor
          socket.emit('video-thumbnail', {
            thumbnail,
            isPlaying: !video.paused,
            currentTime: video.currentTime,
            duration: video.duration
          });
        } catch (err) {
          console.error('Error capturando thumbnail:', err);
        }
      }
    }, 3000);

    return () => {
      if (thumbnailIntervalRef.current) {
        clearInterval(thumbnailIntervalRef.current);
      }
    };
  }, [socket, username, isRemoteStream]);

  useEffect(() => {
    if (isInitializedRef.current) return;
    if (!url || !videoRef.current || isRemoteStream) return;

    isInitializedRef.current = true;

    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        backBufferLength: 90,
        maxBufferLength: 30,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
        const segmentUrl = data.frag.url;
        const segmentData = data.frag.data;

        if (segmentData && segmentUrl) {
          segmentCache.current.set(segmentUrl, segmentData);
          
          if (segmentCache.current.size > 50) {
            const firstKey = segmentCache.current.keys().next().value;
            segmentCache.current.delete(firstKey);
          }
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setError('Error al cargar el video');
        }
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      if (socket) {
        socket.on('request-segment', (data) => {
          const segment = segmentCache.current.get(data.segmentUrl);
          if (segment) {
            socket.emit('segment-response', {
              to: data.from,
              segmentUrl: data.segmentUrl,
              data: Array.from(new Uint8Array(segment))
            });
          }
        });
      }

      return () => {
        if (socket) socket.off('request-segment');
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        segmentCache.current.clear();
        isInitializedRef.current = false;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      return () => {
        isInitializedRef.current = false;
      };
    } else {
      setError('Tu navegador no soporta HLS');
    }
  }, [url, socket]);

  return (
    <div className="relative w-full">
      {error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            className="w-full rounded-lg shadow-xl"
            controls
            playsInline
            autoPlay
            muted={!isRemoteStream}
            crossOrigin="anonymous"
          />
          {isRemoteStream && (
            <div className="absolute top-2 left-2 bg-purple-600 bg-opacity-90 rounded px-3 py-2">
              <p className="text-white text-sm font-bold">
                📡 Stream Remoto
              </p>
            </div>
          )}
          {!isRemoteStream && peers && peers.length > 0 && (
            <div className="absolute top-2 left-2 bg-black bg-opacity-70 rounded px-2 py-1">
              <p className="text-white text-xs font-medium">
                <span className="text-green-400">🔗 {peers.length} peers</span>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
