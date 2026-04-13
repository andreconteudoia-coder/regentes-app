
import { Button } from '../ui/button';

interface PlanScreenProps {
  creationDate?: string; // data de criação do plano (ISO string)
}

const CHECKOUT_URLS = {
  monthly: 'https://regentify.vercel.app/', // Troque para sua URL real
  yearly: 'https://regentify.vercel.app/',   // Troque para sua URL real
};

export const PlanScreen: React.FC<PlanScreenProps> = ({ creationDate }) => {
  // Cálculo de datas
  let infoBlock = null;
  if (creationDate) {
    const created = new Date(creationDate);
    const expires = new Date(created);
    expires.setDate(created.getDate() + 30);
    const now = new Date();
    const msRestante = expires.getTime() - now.getTime();
    const diasRestantes = Math.max(0, Math.ceil(msRestante / (1000 * 60 * 60 * 24)));

    infoBlock = (
      <div className="bg-yellow-100 text-gray-800 px-4 py-2 rounded mb-2 text-center mt-4 text-sm">
        <div><b>Data de criação:</b> {created.toLocaleDateString()}</div>
        <div><b>Vencimento:</b> {expires.toLocaleDateString()}</div>
        <div><b>Dias restantes:</b> {diasRestantes} dia{diasRestantes === 1 ? '' : 's'}</div>
      </div>
    );
  }

  const handleCheckout = (plan: 'monthly' | 'yearly') => {
    window.location.href = CHECKOUT_URLS[plan];
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <h2 className="text-2xl font-bold">Escolha seu plano</h2>
      {infoBlock}
      <div className="flex gap-4">
        <Button onClick={() => handleCheckout('monthly')}>Mensal</Button>
        <Button onClick={() => handleCheckout('yearly')}>Anual</Button>
      </div>
      <p className="text-gray-500">Após a compra, faça login com o mesmo e-mail para liberar o acesso.</p>
    </div>
  );
};
