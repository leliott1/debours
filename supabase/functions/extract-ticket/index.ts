// ============================================================
//  Edge Function : extract-ticket
//  Reçoit la photo d'un ticket, appelle Google Gemini, et renvoie
//  les champs de la dépense en JSON (date, fournisseur, TTC, TVA, catégorie).
//  La clé Gemini reste SECRÈTE côté serveur (variable d'env GEMINI_API_KEY).
//
//  Déploiement (sans installer quoi que ce soit) :
//   Supabase Dashboard → Edge Functions → Deploy a new function
//   → nom "extract-ticket" → colle ce fichier → Deploy.
//   Puis Dashboard → Edge Functions → Secrets → ajoute GEMINI_API_KEY.
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PROMPT = `Tu es un assistant qui lit des tickets et justificatifs de frais professionnels (France).
Analyse l'image du ticket et extrais les informations de la dépense.
- date : date du ticket au format AAAA-MM-JJ (laisse "" si illisible).
- fournisseur : nom du commerçant / fournisseur (ex : SNCF, RATP, TOTAL, Leroy Merlin…).
- montant_ttc : montant TOTAL payé TTC, en nombre avec un point décimal.
- tva : montant de TVA en euros si indiqué, sinon 0.
- categorie : EXACTEMENT l'une de ces valeurs :
  - "train_sncf" : billet de train SNCF
  - "peage" : péage d'autoroute
  - "carburant" : essence / gazole
  - "fournitures" : fournitures ou matériel de chantier (quincaillerie, outillage, BTP…)
  - "divers" : tout le reste (RATP, métro, bus, taxi, parking, repas…)`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "Clé Gemini absente (GEMINI_API_KEY)." }, 500);

    const { image, mimeType } = await req.json();
    if (!image) return json({ error: "Aucune image reçue." }, 400);

    const base64 = String(image).includes(",")
      ? String(image).split(",")[1]
      : String(image);
    const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

    const payload = {
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType || "image/jpeg", data: base64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            date: { type: "STRING" },
            fournisseur: { type: "STRING" },
            montant_ttc: { type: "NUMBER" },
            tva: { type: "NUMBER" },
            categorie: {
              type: "STRING",
              enum: ["train_sncf", "peage", "carburant", "fournitures", "divers"],
            },
          },
          required: ["montant_ttc", "categorie"],
        },
      },
    };

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const data = await resp.json();
    if (!resp.ok) {
      return json({ error: "Gemini : " + (data?.error?.message || resp.status) }, 502);
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: "Réponse Gemini illisible." }, 502);
    }
    return json(parsed, 200);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
