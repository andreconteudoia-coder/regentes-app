import React from 'react';

interface ExpirationBannerProps {
  expiresAt: string;
}

export const ExpirationBanner: React.FC<ExpirationBannerProps> = ({ expiresAt }) => {
  const date = new Date(expiresAt);
  return (
    <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded mb-4 text-center">
      Sua assinatura expira em: <b>{date.toLocaleDateString()}</b>
    </div>
  );
};
