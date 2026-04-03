
import React from 'react';

interface NotesViewProps {
  setView: (v: string) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({ setView }) => {
  return (
    <div style={{ minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#222', color: '#fff', padding: 32 }}>
      <button style={{ background: '#ffe066', color: '#222', fontWeight: 'bold', padding: '12px 32px', borderRadius: 8, fontSize: 20, marginBottom: 24 }} onClick={() => alert('Botão funcionando!')}>Botão Teste</button>
      <div style={{ fontSize: 24, fontWeight: 'bold' }}>Componente NotesView renderizado!</div>
      <button style={{ marginTop: 32, color: '#ffe066', background: 'none', border: 'none', fontWeight: 'bold', fontSize: 18 }} onClick={() => setView('home')}>← Voltar</button>
    </div>
  );
};
