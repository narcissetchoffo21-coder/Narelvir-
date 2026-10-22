import { createClient } from "npm:@supabase/supabase-js@2.84.0";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

const allowedOrigins = new Set([
  "https://narelvir.cm",
  "https://www.narelvir.cm",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.narelvir.cm",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-narelvir-webhook",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("AUTH_REQUIRED");

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) throw new Error("AUTH_REQUIRED");

  const { data: isAdmin, error: adminError } = await admin
    .rpc("webpush_verifier_admin", { p_user_id: userData.user.id });

  if (adminError || isAdmin !== true) throw new Error("ADMIN_REQUIRED");
  return userData.user;
}

async function getConfig(createIfMissing: boolean) {
  const { data, error } = await admin.rpc("webpush_config_obtenir");

  if (error) throw error;
  const existing = Array.isArray(data) ? data[0] : data;
  if (existing || !createIfMissing) return existing;

  const vapid = webpush.generateVAPIDKeys();
  const { data: inserted, error: insertError } = await admin
    .rpc("webpush_config_initialiser", {
      p_public_key: vapid.publicKey,
      p_private_key: vapid.privateKey,
      p_webhook_secret: crypto.randomUUID() + crypto.randomUUID(),
    });

  if (insertError) throw insertError;
  return Array.isArray(inserted) ? inserted[0] : inserted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Méthode non autorisée" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json(req, { error: "Configuration serveur incomplète" }, 500);

  try {
    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action ?? "");

    if (action === "broadcast") {
      const config = await getConfig(false);
      if (!config) return json(req, { ok: true, delivered: 0, configured: false });

      const suppliedSecret = req.headers.get("x-narelvir-webhook") ?? "";
      if (!suppliedSecret || suppliedSecret !== config.webhook_secret) {
        return json(req, { error: "Accès refusé" }, 403);
      }

      webpush.setVapidDetails(
        "mailto:notifications@narelvir.cm",
        config.vapid_public_key,
        config.vapid_private_key,
      );

      const { data: subscriptions, error: subscriptionsError } = await admin
        .rpc("webpush_lister_abonnements");

      if (subscriptionsError) throw subscriptionsError;

      let delivered = 0;
      let removed = 0;
      for (const sub of subscriptions ?? []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({
              title: String(payload?.title ?? "NARELVIR"),
              body: String(payload?.body ?? "Nouvelle activité"),
              url: String(payload?.url ?? "https://www.narelvir.cm/#connexion"),
              tag: String(payload?.tag ?? "narelvir-notification"),
              notification_id: payload?.notification_id ?? null,
            }),
            { TTL: 3600, urgency: "high" },
          );
          delivered += 1;
        } catch (error) {
          const statusCode = Number((error as { statusCode?: number })?.statusCode ?? 0);
          if (statusCode === 404 || statusCode === 410) {
            await admin.rpc("webpush_supprimer_abonnement_id", { p_id: sub.id });
            removed += 1;
          } else {
            console.error("Push delivery failed", statusCode, String(error));
          }
        }
      }

      return json(req, { ok: true, delivered, removed, configured: true });
    }

    const user = await requireAdmin(req);
    const config = await getConfig(true);
    if (!config) throw new Error("PUSH_CONFIG_MISSING");

    if (action === "public_key") {
      return json(req, { publicKey: config.vapid_public_key });
    }

    if (action === "subscribe") {
      const subscription = payload?.subscription;
      const endpoint = String(subscription?.endpoint ?? "").trim();
      const p256dh = String(subscription?.keys?.p256dh ?? "").trim();
      const auth = String(subscription?.keys?.auth ?? "").trim();
      if (!endpoint || !p256dh || !auth || endpoint.length > 4096) {
        return json(req, { error: "Abonnement invalide" }, 400);
      }

      const { error } = await admin.rpc("webpush_enregistrer_abonnement", {
        p_user_id: user.id,
        p_endpoint: endpoint,
        p_p256dh: p256dh,
        p_auth: auth,
        p_user_agent: (req.headers.get("user-agent") ?? "").slice(0, 500),
      });

      if (error) throw error;
      return json(req, { ok: true });
    }

    if (action === "unsubscribe") {
      const endpoint = String(payload?.endpoint ?? "").trim();
      if (endpoint) {
        const { error } = await admin.rpc("webpush_supprimer_abonnement", {
          p_user_id: user.id,
          p_endpoint: endpoint,
        });
        if (error) throw error;
      }
      return json(req, { ok: true });
    }

    return json(req, { error: "Action inconnue" }, 400);
  } catch (error) {
    const code = String((error as Error)?.message ?? error);
    if (code === "AUTH_REQUIRED") return json(req, { error: "Connexion requise" }, 401);
    if (code === "ADMIN_REQUIRED") return json(req, { error: "Accès administrateur requis" }, 403);
    console.error("narelvir-notifications", error);
    return json(req, { error: "Erreur serveur des notifications" }, 500);
  }
});
