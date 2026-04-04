import React, { useState } from 'react';

interface CommitmentsViewProps {
  setView: (v: string) => void;
}

interface Commitment {
  date: string;
  description: string;
}

export const CommitmentsView: React.FC<CommitmentsViewProps> = ({ setView }) => {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [description, setDescription] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const handleAdd = () => {
    if (!description.trim()) return;
    setCommitments([...commitments, { date: today, description }]);
    setDescription('');
  };

  return (
    <div className="max-w-2xl mx-auto py-8 min-h-[60vh] flex flex-col bg-[var(--bg-color)] text-[var(--text-color)]">
      <button onClick={() => setView('home')} className="mb-6 text-blue-400 font-bold">← Voltar</button>
      <h2 className="text-3xl font-bold mb-4">Compromissos</h2>
      <div className="flex flex-col gap-4 items-center">
        <div className="flex flex-col gap-2 w-full max-w-lg">
          <label className="font-bold">Data</label>
          <input type="text" value={today} readOnly className="rounded p-2 bg-[var(--color-bg-card)] border border-blue-400/20 text-[var(--text-color)]" />
          <label className="font-bold mt-2">Descrição</label>
          <textarea
            className="w-full min-h-[80px] rounded p-2 bg-[var(--color-bg-card)] border border-blue-400/20 text-[var(--text-color)]"
            placeholder="Digite o compromisso..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <button
            className="mt-2 px-4 py-2 rounded bg-blue-400 text-black font-bold hover:bg-blue-300 transition"
            onClick={handleAdd}
            disabled={!description.trim()}
          >Adicionar compromisso</button>
        </div>
        <div className="mt-8 w-full max-w-lg">
          <h3 className="text-xl font-bold mb-2">Compromissos de hoje</h3>
          {commitments.length === 0 ? (
            <div className="text-[#909296]">Nenhum compromisso adicionado.</div>
          ) : (
            <ul className="space-y-2">
              {commitments.map((c, i) => (
                <li key={i} className="bg-blue-400/10 border border-blue-400/20 rounded p-3 text-blue-100">
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