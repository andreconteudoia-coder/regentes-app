import { Button } from '../ui/button';
interface PlanScreenProps {}

const CHECKOUT_URLS = {
  monthly: 'https://regentify.vercel.app/', // Troque para sua URL real
  yearly: 'https://regentify.vercel.app/',   // Troque para sua URL real
};

export const PlanScreen: React.FC<PlanScreenProps> = () => {
  const handleCheckout = (plan: 'monthly' | 'yearly') => {
    window.location.href = CHECKOUT_URLS[plan];
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <h2 className="text-2xl font-bold">Escolha seu plano</h2>
      <div className="flex gap-4">
        <Button onClick={() => handleCheckout('monthly')}>Mensal</Button>
        <Button onClick={() => handleCheckout('yearly')}>Anual</Button>
      </div>
      <p className="text-gray-500">Após a compra, faça login com o mesmo e-mail para liberar o acesso.</p>
    </div>
  );
};
