import React, { useState } from 'react';
import { auth } from '../../firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { Button } from '../ui/button';

export const LoginView = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setErro(error.message);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (error: any) {
      setErro(error.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <h2 className="text-3xl font-bold text-white font-maestra">Bem-vindo ao Regentify</h2>
      <p className="text-[#909296]">Faça login para sincronizar seus hinos na nuvem.</p>
      <Button onClick={handleGoogleLogin} className="bg-primary hover:bg-primary/90 text-white">
        Entrar com Google
      </Button>
      <form onSubmit={handleEmailLogin} className="flex flex-col gap-2 w-72 bg-white/10 p-4 rounded">
        <input
          type="email"
          placeholder="Seu e-mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="p-2 rounded bg-white/20 text-white"
          required
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          className="p-2 rounded bg-white/20 text-white"
          required
        />
        <Button type="submit" className="bg-primary hover:bg-primary/90 text-white mt-2">
          Entrar com e-mail
        </Button>
        {erro && <div className="text-red-400 text-xs mt-2">{erro}</div>}
      </form>
    </div>
  );
};
