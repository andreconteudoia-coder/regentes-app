import React, { useEffect, useState } from 'react';
import { auth, db } from '../../firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';

interface Commitment {
  id: string;
  date: string;
  description: string;
  createdAt?: Timestamp;
}

interface CommitmentsViewProps {
  setView: (v: string) => void;
}

export const CommitmentsView: React.FC<CommitmentsViewProps> = ({ setView }) => {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const today = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const commitmentsRef = collection(db, `users/${user.uid}/commitments`);
    const q = query(commitmentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Commitment[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          date: data.date || '',
          description: data.description || '',
          createdAt: data.createdAt,
        };
      });

      setCommitments(items);
    });

    return () => unsubscribe();
  }, []);

  const handleAdd = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert('Usuário não autenticado.');
      return;
    }

    if (!description.trim()) return;

    try {
      setSaving(true);

      const commitmentsRef = collection(db, `users/${user.uid}/commitments`);

      await addDoc(commitmentsRef, {
        date: today,
        description: description.trim(),
        createdAt: Timestamp.now(),
      });

      setDescription('');
    } catch (error) {
      console.error('Erro ao salvar compromisso:', error);
      alert('Erro ao salvar compromisso.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 min-h-[60vh] flex flex-col bg-gray-900 text-white">
      <button
        onClick={() => setView('home')}
        className="mb-6 text-blue-400 font-bold hover:text-blue-300 transition"
      >
        ← Voltar
      </button>

      <h2 className="text-3xl font-bold mb-4 text-center">Compromissos</h2>

      <div className="flex flex-col gap-4 items-center">
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
            onChange={(e) => setDescription(e.target.value)}
          />

          <button
            className="mt-2 px-4 py-2 rounded bg-blue-500 text-white font-bold hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAdd}
            disabled={!description.trim() || saving}
          >
            {saving ? 'Salvando...' : 'Adicionar compromisso'}
          </button>
        </div>

        <div className="mt-8 w-full max-w-lg">
          <h3 className="text-xl font-bold mb-2">Compromissos salvos</h3>

          {commitments.length === 0 ? (
            <div className="text-gray-400">Nenhum compromisso adicionado.</div>
          ) : (
            <ul className="space-y-2">
              {commitments.map((c) => (
                <li
                  key={c.id}
                  className="bg-blue-500/10 border border-blue-400/20 rounded p-3"
                >
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