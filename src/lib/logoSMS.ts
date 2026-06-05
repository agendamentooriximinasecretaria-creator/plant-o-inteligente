export const LOGO_ORIXIMINA_PATH = "/logo-prefeitura.jpg";
export const LOGO_SMS_PATH = "/logo-sms-oriximina.jpg";

/** Converte a logo em DataURL (necessário para embutir em jsPDF). */
export async function getLogoSmsDataUrl(): Promise<string | null> {
  return await fetchAsDataUrl(LOGO_SMS_PATH);
}

export async function getLogoOriximinaDataUrl(): Promise<string | null> {
  return await fetchAsDataUrl(LOGO_ORIXIMINA_PATH);
}

/** Marca HTML <img> da logo no formato redondo padrão para impressões em janela. */
export function logoSmsImgHtml(sizePx = 45): string {
  return `<img src="${LOGO_SMS_PATH}" alt="SMS Oriximiná" style="width:${sizePx}px;height:${sizePx}px;border-radius:50%;object-fit:cover;display:block;border:1px solid #e5e7eb;background:#fff" />`;
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    // Para caminhos locais (que começam com /), usamos fetch direto
    // Para URLs externas, usamos mode: 'cors'
    const finalUrl = url.startsWith('/') ? window.location.origin + url : url;
    const response = await fetch(finalUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Erro ao converter logo para DataURL", e);
    return null;
  }
}
