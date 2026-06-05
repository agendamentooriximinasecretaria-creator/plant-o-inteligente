export const LOGO_ORIXIMINA_PATH = "https://lovable-project-assets.s3.amazonaws.com/495f80d9-ad05-4b0f-900f-0e9ef4f4f9ea.jpg";
export const LOGO_SMS_PATH = "https://lovable-project-assets.s3.amazonaws.com/175885bb-96b7-466d-ae6c-4089325129eb.png";

/** Converte a logo em DataURL (necessário para embutir em jsPDF). */
export async function getLogoSmsDataUrl(): Promise<string | null> {
  return await fetchAsDataUrl(LOGO_SMS_PATH);
}

export async function getLogoOriximinaDataUrl(): Promise<string | null> {
  return await fetchAsDataUrl(LOGO_ORIXIMINA_PATH);
}

/** Marca HTML <img> da logo no formato redondo padrão para impressões em janela. */
export function logoSmsImgHtml(sizePx = 55): string {
  return `<img src="${LOGO_SMS_PATH}" alt="SMS Oriximiná" style="width:${sizePx}px;height:${sizePx}px;border-radius:50%;object-fit:cover;display:block;border:1px solid #e5e7eb;background:#fff" />`;
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
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


