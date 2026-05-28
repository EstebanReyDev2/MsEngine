// 📂 /app/api/gemini/insights/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

// Initialize the real Gemini client on the server side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export async function POST(req: NextRequest) {
  try {
    const { scores, streak, rank } = await req.json();

    const gamesPlayed = scores?.length || 0;
    const avgScore = scores?.reduce((sum: number, s: any) => sum + s.score, 0) / (gamesPlayed || 1);
    const maxLevel = scores?.reduce((max: number, s: any) => s.level_reached > max ? s.level_reached : max, 1) || 1;

    // Direct check for missing API Key to bypass the model loading crash
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      return NextResponse.json(generateStaticFallback(avgScore, maxLevel, streak));
    }

    const prompt = `Actúas como un experto Neuro-Científico Cognitivo y Guía del Mental Sanctuary.
Analiza las estadísticas del usuario:
- Rango: ${rank}
- Juegos Completados: ${gamesPlayed}
- Puntuación Promedio de Agilidad: ${avgScore.toFixed(0)}
- Nivel Máximo Alcanzado: ${maxLevel}
- Racha de días jugados: ${streak}

Genera un reporte personalizado de bienestar mental en formato JSON. Devuelve los siguientes campos exactos:
- agilidadSummary: Un resumen poético, científico y alentador sobre el estado actual de su enfoque y memoria espacial (2-3 líneas).
- ejercicioRecomendado: Cuál debería ser su próximo objetivo de práctica para potenciar sus sinapsis (memoria, velocidad o flexibilidad).
- afirmacionDelDia: Una afirmación zen de una sola línea, elegante y minimalista.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            agilidadSummary: {
              type: Type.STRING,
              description: 'Scientific and encouraging analysis of focus metrics.'
            },
            ejercicioRecomendado: {
              type: Type.STRING,
              description: 'Recommended custom training goal.'
            },
            afirmacionDelDia: {
              type: Type.STRING,
              description: 'One-line Zen cognitive affirmation.'
            }
          },
          required: ['agilidadSummary', 'ejercicioRecomendado', 'afirmacionDelDia']
        }
      }
    });

    const text = response.text;
    if (text) {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    }

    return NextResponse.json(generateStaticFallback(avgScore, maxLevel, streak));
  } catch (err) {
    // Graceful error fallback
    return NextResponse.json(generateStaticFallback(120, 3, 1));
  }
}

function generateStaticFallback(avgScore: number, maxLevel: number, streak: number) {
  let agilidadSummary = 'Tus métricas sinápticas muestran un potencial estable. Has establecido una firma mental de calma activa, ideal para tareas que involucran planeación visoespacial profunda.';
  let ejercicioRecomendado = 'Prueba incrementar tu constancia en "Pattern Recall" para potenciar el lóbulo parietal y el almacenamiento corto plazo.';
  let afirmacionDelDia = 'Cada conexión se fortalece con el silencio del pensamiento.';

  if (avgScore > 200) {
    agilidadSummary = 'Excelente retención espacial. Tu corteza prefrontal demuestra un alto grado de plasticidad para aislar ruido periférico y capturar patrones geométricos en microsegundos.';
    ejercicioRecomendado = 'Desafía tu velocidad en niveles avanzados (Nivel 4+) para forzar la agilidad sin perder precisión.';
    afirmacionDelDia = 'Encuentro el equilibrio absoluto en el centro de mi enfoque.';
  }

  return {
    agilidadSummary,
    ejercicioRecomendado,
    afirmacionDelDia
  };
}
