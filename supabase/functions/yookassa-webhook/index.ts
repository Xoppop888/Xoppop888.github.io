// Supabase Edge Function: обработчик вебхука ЮKassa.
// URL этой функции указывается в личном кабинете ЮKassa → Настройки → HTTP-уведомления.
//
// ВАЖНО про безопасность: уведомления ЮKassa не подписаны секретом по умолчанию,
// поэтому теле запроса НЕ доверяем — получив payment.id, сами запрашиваем его
// статус напрямую у ЮKassa своим секретным ключом и действуем по этому ответу.
// Так поддельный вызов на этот URL ничего не даст — на нашей стороне решает
// только то, что реально подтвердит сама ЮKassa.

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body: { object?: { id?: string } };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const paymentId = body.object?.id;
  if (!paymentId) return new Response("no payment id", { status: 400 });

  const shopId = Deno.env.get("YOOKASSA_SHOP_ID")!;
  const secretKey = Deno.env.get("YOOKASSA_SECRET_KEY")!;

  // сверяем напрямую с ЮKassa — тело вебхука выше используем только как наводку на id
  const check = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: { Authorization: "Basic " + btoa(`${shopId}:${secretKey}`) },
  });
  if (!check.ok) return new Response("payment lookup failed", { status: 502 });
  const payment = await check.json();

  if (payment.status !== "succeeded") {
    // ждём succeeded; canceled/pending игнорируем молча
    return new Response("ok", { status: 200 });
  }

  const userId = payment.metadata?.user_id;
  if (!userId) return new Response("no user_id in metadata", { status: 400 });

  // service_role ключ — только на сервере, обходит RLS для записи is_pro/payments
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // идемпотентность: если этот платёж уже записан — второй раз ничего не делаем
  const { error: insertErr } = await supabase.from("payments").insert({
    id: payment.id,
    user_id: userId,
    status: payment.status,
    amount: Number(payment.amount?.value ?? 0),
    currency: payment.amount?.currency ?? "RUB",
  });
  if (insertErr && insertErr.code !== "23505") {
    // 23505 = дубликат (уже обработан ранее) — это нормально, остальное — реальная ошибка
    return new Response(JSON.stringify({ error: insertErr.message }), { status: 500 });
  }
  if (!insertErr) {
    await supabase.from("profiles").update({ is_pro: true }).eq("id", userId);
  }

  return new Response("ok", { status: 200 });
});
