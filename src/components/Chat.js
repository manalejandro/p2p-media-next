'use client';

import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * Componente de Chat en tiempo real con Socket.IO y thumbnails de video
 */
export default function Chat({ username, onUsernameChange, onSocketReady, onWatchUser }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [userThumbnails, setUserThumbnails] = useState({});
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [tempUsername, setTempUsername] = useState(username || '');
  const [hoveredUser, setHoveredUser] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll al final de los mensajes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Conectar a Socket.IO
  useEffect(() => {
    if (!username) return;

    const newSocket = io({
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('✅ Conectado a Socket.IO');
      setIsConnected(true);
      newSocket.emit('register', { user: username });
      // Notificar al padre que el socket está listo
      if (onSocketReady) {
        onSocketReady(newSocket);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Desconectado de Socket.IO');
      setIsConnected(false);
    });

    newSocket.on('users', (data) => {
      setUsers(data.users || []);
    });

    newSocket.on('adduser', (data) => {
      setUsers(prevUsers => [...prevUsers, data.user]);
    });

    newSocket.on('user-thumbnail', (data) => {
      if (data.user && data.thumbnail) {
        setUserThumbnails(prev => ({
          ...prev,
          [data.user]: {
            thumbnail: data.thumbnail,
            isPlaying: data.isPlaying,
            timestamp: Date.now()
          }
        }));
      }
    });

    newSocket.on('join', (data) => {
      setMessages(prev => [
        ...prev,
        {
          type: 'system',
          text: `${data.user} se ha unido`,
          timestamp: Date.now()
        }
      ]);
    });

    newSocket.on('msg', (data) => {
      setMessages(prev => [
        ...prev,
        {
          type: 'user',
          user: data.user,
          text: data.chat,
          timestamp: data.timestamp || Date.now()
        }
      ]);
    });

    newSocket.on('quit', (data) => {
      setMessages(prev => [
        ...prev,
        {
          type: 'system',
          text: data.msg,
          timestamp: Date.now()
        }
      ]);
    });

    newSocket.on('rejoin', (data) => {
      alert('Este nombre de usuario ya está en uso. Por favor elige otro.');
      if (onUsernameChange) {
        onUsernameChange('');
      }
    });

    newSocket.on('error', (error) => {
      console.error('Error del servidor:', error);
      setMessages(prev => [
        ...prev,
        {
          type: 'error',
          text: error,
          timestamp: Date.now()
        }
      ]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [username, onUsernameChange]);

  const sendMessage = (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !socket || !isConnected) return;

    // Añadir mensaje propio
    setMessages(prev => [
      ...prev,
      {
        type: 'own',
        user: username,
        text: inputMessage,
        timestamp: Date.now()
      }
    ]);

    // Enviar al servidor
    socket.emit('emit msg', { user: username, chat: inputMessage });
    setInputMessage('');
  };

  const handleUsernameSubmit = (e) => {
    e.preventDefault();
    if (tempUsername.trim().length >= 2) {
      if (onUsernameChange) {
        onUsernameChange(tempUsername.trim());
      }
    }
  };

  // Formulario de username si no está conectado
  if (!username) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-800">Únete al Chat</h3>
        <form onSubmit={handleUsernameSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de usuario
            </label>
            <input
              type="text"
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              placeholder="Ingresa tu nombre..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              minLength={2}
              maxLength={30}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Unirse
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Chat en Vivo</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="text-white text-sm">{isConnected ? 'Conectado' : 'Desconectado'}</span>
          </div>
        </div>
        <p className="text-white text-sm mt-1">Como: <span className="font-semibold">{username}</span></p>
      </div>

      {/* Usuarios conectados */}
      <div className="bg-gray-50 p-3 border-b">
        <h4 className="text-xs font-semibold text-gray-600 mb-2">
          USUARIOS CONECTADOS ({users.length})
        </h4>
        
        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
          {users.map((user, index) => {
            const isCurrentUser = user === username;
            const hasThumbnail = userThumbnails[user]?.thumbnail;
            const isHovered = hoveredUser === user;
            
            return (
              <div
                key={index}
                className="relative group"
                onMouseEnter={() => setHoveredUser(user)}
                onMouseLeave={() => setHoveredUser(null)}
              >
                <button
                  onClick={() => !isCurrentUser && onWatchUser && onWatchUser(user)}
                  disabled={isCurrentUser}
                  className={`w-full px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isCurrentUser
                      ? 'bg-green-100 text-green-800 cursor-default'
                      : 'bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{user}</span>
                    {hasThumbnail && !isCurrentUser && (
                      <span className="ml-1 text-red-500">🔴</span>
                    )}
                    {isCurrentUser && (
                      <span className="ml-1">👤</span>
                    )}
                  </div>
                </button>
                
                {/* Thumbnail preview en hover - FLOTANTE */}
                {isHovered && hasThumbnail && !isCurrentUser && (
                  <div className="fixed z-[9999] bg-white rounded-lg shadow-2xl border-4 border-blue-500 p-3" 
                       style={{
                         left: '50%',
                         top: '50%',
                         transform: 'translate(-50%, -50%)',
                         width: '400px',
                         maxWidth: '90vw'
                       }}>
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={userThumbnails[user].thumbnail}
                        alt={`Stream de ${user}`}
                        className="rounded w-full h-auto shadow-lg"
                      />
                      <div className="absolute bottom-2 left-2 bg-black bg-opacity-80 rounded px-2 py-1">
                        <span className="text-white text-sm font-bold">
                          {userThumbnails[user].isPlaying ? '▶️ Reproduciendo' : '⏸️ Pausado'}
                        </span>
                      </div>
                      <div className="absolute top-2 left-2 bg-blue-600 bg-opacity-90 rounded px-2 py-1">
                        <span className="text-white text-sm font-bold">
                          {user}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-center mt-3 font-bold text-blue-600 animate-pulse">
                      👆 Click para ver en vivo
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-center text-sm">No hay mensajes aún...</p>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`${
                msg.type === 'system' || msg.type === 'error'
                  ? 'text-center'
                  : msg.type === 'own'
                  ? 'flex justify-end'
                  : 'flex justify-start'
              }`}
            >
              {msg.type === 'system' && (
                <span className="text-xs text-gray-500 italic">{msg.text}</span>
              )}
              {msg.type === 'error' && (
                <span className="text-xs text-red-500 italic">{msg.text}</span>
              )}
              {(msg.type === 'user' || msg.type === 'own') && (
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 ${
                    msg.type === 'own'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-800 shadow'
                  }`}
                >
                  <p className={`text-xs font-semibold mb-1 ${
                    msg.type === 'own' ? 'text-blue-100' : 'text-blue-600'
                  }`}>
                    {msg.user}
                  </p>
                  <p className="text-sm break-words">{msg.text}</p>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de mensaje */}
      <form onSubmit={sendMessage} className="p-4 bg-white border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={500}
            disabled={!isConnected}
          />
          <button
            type="submit"
            disabled={!isConnected || !inputMessage.trim()}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium px-6 py-2 rounded-lg transition-colors"
          >
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
}
