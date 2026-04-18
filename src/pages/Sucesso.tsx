import { useEffect } from "react";

export default function Sucesso() {
  useEffect(() => {
    async function check() {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");

      const res = await fetch(
        "https://regentify-app.vercel.app/api/check-subscription?email=" + email
      );

      const data = await res.json();

      if (data.active) {
        window.location.href = "https://regentify-app.vercel.app";
      } else {
        window.location.href = "/";
      }
    }

    check();
  }, []);

  return <h2>Confirmando pagamento...</h2>;
}
