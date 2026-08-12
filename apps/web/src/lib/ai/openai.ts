export class ClinicalAiConfigError extends Error {
  constructor(message = 'Configurá OPENAI_API_KEY para usar IA clínica') {
    super(message);
    this.name = 'ClinicalAiConfigError';
  }
}

export function isClinicalAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getClinicalAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
}

export async function completeClinicalAiJson(
  system: string,
  user: string
): Promise<{ text: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ClinicalAiConfigError();
  }

  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(
    /\/$/,
    ''
  );
  const model = getClinicalAiModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ClinicalAiConfigError('La clave de IA no es válida');
      }
      throw new Error('El proveedor de IA no respondió. Probá de nuevo.');
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const text = payload.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) {
      throw new Error('La IA no devolvió contenido');
    }

    return { text, model: payload.model?.trim() || model };
  } catch (error) {
    if (error instanceof ClinicalAiConfigError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La IA tardó demasiado. Probá de nuevo.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
