import React, { useState } from 'react';

// 1. Definição das Interfaces (Obrigatório para o TypeScript)
interface Commitment {
  date: string;
  description: string;
}

interface CommitmentsViewProps {
  setView: (v: string) => void;
}

// 2. Componente Completo
export const CommitmentsView: React.FC<CommitmentsViewProps> = ({ setView }) => {
  // Seus estados
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [description, setDescription] = useState('');
  
  // Data de hoje formatada
const today = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');

  const handleAdd = () => {
    if (!description.trim()) return;
    
    // Adiciona o novo compromisso ao estado
    setCommitments([...commitments, { date: today, description }]);
    setDescription(''); // Limpa o campo de texto
  };

  // 3. O Return (O que será renderizado na tela)
  return (
    <div className="max-w-2xl mx-auto py-8 min-h-[60vh] flex flex-col bg-gray-900 text-white">
      {/* Botão de Voltar */}
      <button 
        onClick={() => setView('home')} 
        className="mb-6 text-blue-400 font-bold hover:text-blue-300 transition"
      >
        ← Voltar
      </button>

      <h2 className="text-3xl font-bold mb-4 text-center">Compromissos</h2>

      <div className="flex flex-col gap-4 items-center">
        {/* Formulário de Adição */}
        <div className="flex flex-col gap-2 w-full max-w-lg">
          <label className="font-bold">Data</label>
          <input 
            type="text" 
            value={today} 
            readOnly 
            className="rounded p-2 bg-gray-800 border border-blue-400/20 text-white focus:outline-none focus:border-blue-400" 
          />
          
          <label className="font-bold mt-2">Descrição</label>
          <textarea
            className="w-full min-h-[80px] rounded p-2 bg-gray-800 border border-blue-400/20 text-white focus:outline-none focus:border-blue-400"
            placeholder="Digite o compromisso..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          
          <button
            className="mt-2 px-4 py-2 rounded bg-blue-500 text-white font-bold hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAdd}
            disabled={!description.trim()}
          >
            Adicionar compromisso
          </button>
        </div>

        {/* Lista de Compromissos */}
        <div className="mt-8 w-full max-w-lg">
          <h3 className="text-xl font-bold mb-2">Compromissos de hoje</h3>
          
          {commitments.length === 0 ? (
            <div className="text-gray-400">Nenhum compromisso adicionado.</div>
          ) : (
            <ul className="space-y-2">
              {commitments.map((c, i) => (
                <li key={i} className="bg-blue-500/10 border border-blue-400/20 rounded p-3">
                  <div className="text-xs text-blue-300 mb-1">{c.date}</div>
                  <div>{c.description}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
