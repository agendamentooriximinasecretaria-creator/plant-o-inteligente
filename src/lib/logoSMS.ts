// Logo oficial SMS Oriximiná - usada em todas as impressões e PDFs do sistema.
// Mantida em formato redondo (círculo padrão) com proporção 1:1.

export const LOGO_SMS_PATH = "/logo-sms-oriximina.jpg";

let _cachedDataUrl: string | null = null;

/** Converte a logo em DataURL (necessário para embutir em jsPDF). Cacheia em memória. */
export async function getLogoSmsDataUrl(): Promise<string | null> {
  if (_cachedDataUrl) return _cachedDataUrl;
  try {
    const res = await fetch(LOGO_SMS_PATH);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => {
        _cachedDataUrl = (r.result as string) || null;
        resolve(_cachedDataUrl);
      };
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Marca HTML <img> da logo no formato redondo padrão para impressões em janela. */
export function logoSmsImgHtml(sizePx = 64): string {
  return `<img src="${LOGO_SMS_PATH}" alt="SMS Oriximiná" style="width:${sizePx}px;height:${sizePx}px;border-radius:50%;object-fit:cover;display:block;border:1px solid #e5e7eb;background:#fff" />`;
}
