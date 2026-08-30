// Supabase Edge Function: создаёт платёж в ЮKassa на фиксированную сумму Pro-доступа.
// Вызывается с клиента с JWT авторизованного пользователя.
// Секреты (задать: supabase secrets set YOOKASSA_SHOP_ID=... YOOKASSA_SECRET_KEY=...):
//   YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY — из личного кабинета ЮKassa
//   SITE_URL — адрес сайта, куда вернуть человека после оплаты (https://xoppop888.github.io)

import { createClient } from "npm:@supabase/supabase-js@2";

const PRO_PRICE_RUB = 990; // разовая цена Pro — поменять на своё значение

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });

  const shopId = Deno.env.get("YOOKASSA_SHOP_ID")!;
  const secretKey = Deno.env.get("YOOKASSA_SECRET_KEY")!;
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://xoppop888.github.io";
  const idempotenceKey = crypto.randomUUID();

  const res = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotence-Key": idempotenceKey,
      Authorization: "Basic " + btoa(`${shopId}:${secretKey}`),
    },
    body: JSON.stringify({
      amount: { value: PRO_PRICE_RUB.toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: siteUrl },
      description: "Монета · Pro-доступ (навсегда)",
      metadata: { user_id: user.id }, // по этому полю webhook найдёт, кому выдать доступ
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return new Response(JSON.stringify({ error: "Ошибка ЮKassa", details: text }), { status: 502 });
  }

  const payment = await res.json();
  return new Response(JSON.stringify({ confirmationUrl: payment.confirmation?.confirmation_url, paymentId: payment.id }), {
    headers: { "Content-Type": "application/json" },
  });
});
