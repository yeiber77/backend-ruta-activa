const DEFAULT_MODEL = 'gemini-2.5-flash';

function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

async function generarTextoGemini(systemPrompt, userMessage) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY no configurada en el servidor');
    err.code = 'GEMINI_NOT_CONFIGURED';
    throw err;
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.65,
      },
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      `Gemini respondió con HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = data;
    throw err;
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('Gemini no devolvió texto en la respuesta');
  }

  return text;
}

function buildSystemPrompt(retroalimentaciones) {
  const guias = (retroalimentaciones || [])
    .filter((r) => r.activo !== false)
    .map((r, i) => {
      const titulo = r.titulo?.trim() ? `Título: ${r.titulo.trim()}\n` : '';
      return `${i + 1}. ${titulo}${r.contenido.trim()}`;
    })
    .join('\n\n');

  return `Eres el asistente comunitario de Ruta Activa, un servicio de transporte/rutas comunitarias.
Tu rol es ayudar a choferes, representantes de comunidad, supervisores y otros usuarios con dudas sobre el servicio, horarios, rutas, procedimientos y la comunidad.

Reglas:
- Responde siempre en español, claro y breve (máximo 3 párrafos cortos).
- Si no sabes algo con certeza, dilo honestamente y sugiere contactar al coordinador.
- No inventes políticas ni horarios que no aparezcan en la guía del coordinador.
- Sé amable, profesional y orientado a la comunidad.

Guía oficial del coordinador (úsala como fuente principal):
${guias || '(Aún no hay guía del coordinador. Responde con cordialidad y recomienda consultar al coordinador para detalles específicos.)'}`;
}

module.exports = {
  geminiConfigured,
  generarTextoGemini,
  buildSystemPrompt,
  DEFAULT_MODEL,
};
