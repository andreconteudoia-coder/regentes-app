import React from 'react';
import { auth } from '../../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Button } from '../ui/button';

export const LoginView = () => {
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Erro ao fazer login:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <h2 className="text-3xl font-bold text-white font-maestra">Bem-vindo ao Maestra Coral</h2>
      <p className="text-[#909296]">Faça login para sincronizar seus hinos na nuvem.</p>
      <Button onClick={handleGoogleLogin} className="bg-primary hover:bg-primary/90 text-white">
        Entrar com Google
      </Button>
    </div>
  );
};
