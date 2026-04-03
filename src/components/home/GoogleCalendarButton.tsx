// Exemplo de integração React para autenticar e buscar eventos do Google Calendar
import React, { useState } from 'react';

export const GoogleCalendarButton: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inicia o login Google (redireciona para o backend)
  const handleLogin = () => {
    window.location.href = '/api/google/login';
  };

  // Busca eventos do Google Calendar
  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/google/events');
      if (!res.ok) throw new Error('Não autenticado ou erro ao buscar eventos');
      const data = await res.json();
      setEvents(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Logout Google
  const handleLogout = async () => {
    await fetch('/api/google/logout');
    setEvents([]);
  };

  return (
    <div className="my-4 p-4 border rounded bg-white text-black">
      <button onClick={handleLogin} className="bg-blue-600 text-white px-4 py-2 rounded mr-2">Login com Google</button>
      <button onClick={fetchEvents} className="bg-green-600 text-white px-4 py-2 rounded mr-2">Buscar eventos</button>
      <button onClick={handleLogout} className="bg-gray-600 text-white px-4 py-2 rounded">Logout</button>
      {loading && <div>Carregando eventos...</div>}
      {error && <div className="text-red-600">{error}</div>}
      <ul className="mt-4">
        {events.map(ev => (
          <li key={ev.id}>
            <b>{ev.summary}</b> <br />
            {ev.start?.dateTime || ev.start?.date}
          </li>
        ))}
      </ul>
    </div>
  );
};
