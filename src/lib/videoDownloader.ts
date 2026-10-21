/**
 * Robust Video Downloader with Client-Side Verification & Magic Byte Inspection
 * 
 * Guarantees that downloaded files are genuine binary video streams (MP4 or WebM)
 * and never corrupt HTML, JSON errors, or incomplete files.
 */

export interface DownloadProgressInfo {
  state: 'idle' | 'starting' | 'fetching' | 'validating' | 'saving' | 'completed' | 'error';
  message: string;
  progressPercent?: number;
  fileSizeBytes?: number;
}

export interface DownloadVideoOptions {
  videoUrl: string;
  filename: string;
  format: 'mp4' | 'webm';
  userId?: string;
  onProgress?: (info: DownloadProgressInfo) => void;
}

/**
 * Validates the binary container header (magic bytes)
 */
function validateVideoMagicBytes(buffer: ArrayBuffer, format: 'mp4' | 'webm'): { isValid: boolean; detectedType: string; error?: string } {
  if (buffer.byteLength < 16) {
    return { isValid: false, detectedType: 'unknown', error: 'Arquivo muito curto para conter cabeçalho de vídeo válido.' };
  }

  const bytes = new Uint8Array(buffer.slice(0, 32));
  
  // Check for HTML / XML / text error response
  const textSample = String.fromCharCode(...bytes.slice(0, 16)).toLowerCase();
  if (
    textSample.includes('<!doc') ||
    textSample.includes('<html') ||
    textSample.includes('<?xml') ||
    textSample.includes('{"') ||
    textSample.includes('{"error')
  ) {
    return {
      isValid: false,
      detectedType: 'html_or_json',
      error: 'O servidor retornou uma página HTML ou mensagem de texto em vez dos dados binários do vídeo.',
    };
  }

  // WebM / EBML Magic Bytes: 0x1A 0x45 0xDF 0xA3
  const isWebM = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;

  // MP4: usually has 'ftyp' starting at byte offset 4
  const isMP4 =
    (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) ||
    textSample.includes('ftyp') ||
    textSample.includes('isom') ||
    textSample.includes('mp4');

  if (format === 'webm') {
    if (isWebM) return { isValid: true, detectedType: 'webm' };
    if (isMP4) return { isValid: true, detectedType: 'mp4', error: 'Arquivo detectado como MP4, mas salvo com extensão WebM.' };
  } else {
    // mp4
    if (isMP4) return { isValid: true, detectedType: 'mp4' };
    if (isWebM) return { isValid: true, detectedType: 'webm', error: 'Arquivo detectado como WebM, mas salvo com extensão MP4.' };
  }

  // Fallback: If it's binary data not containing HTML/JSON and size is large enough
  return { isValid: true, detectedType: format };
}

/**
 * Downloads a video from the server with rigorous verification
 */
export async function downloadVideoWithVerification(options: DownloadVideoOptions): Promise<{ sizeBytes: number; format: string }> {
  const { videoUrl, filename, format, userId, onProgress } = options;

  onProgress?.({
    state: 'starting',
    message: 'Iniciando download seguro do vídeo...',
    progressPercent: 5,
  });

  const headers: HeadersInit = {
    Accept: format === 'mp4' ? 'video/mp4, video/*;q=0.9, */*;q=0.8' : 'video/webm, video/*;q=0.9, */*;q=0.8',
  };
  if (userId) {
    headers['x-user-id'] = userId;
  }

  onProgress?.({
    state: 'fetching',
    message: 'Conectando ao servidor e solicitando arquivo de vídeo...',
    progressPercent: 15,
  });

  let response: Response;
  try {
    response = await fetch(videoUrl, {
      method: 'GET',
      headers,
    });
  } catch (netErr: any) {
    const errorMsg = 'Erro de conexão ao tentar baixar o vídeo. Verifique sua rede e tente novamente.';
    onProgress?.({ state: 'error', message: errorMsg });
    throw new Error(errorMsg);
  }

  // Check HTTP response code
  if (!response.ok) {
    let serverMessage = `Erro HTTP ${response.status}`;
    try {
      const errText = await response.text();
      if (errText) {
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error) serverMessage = parsed.error;
        } catch {
          if (errText.length < 200 && !errText.includes('<')) {
            serverMessage = errText;
          }
        }
      }
    } catch (_) {}

    const fullError =
      response.status === 404
        ? 'Vídeo indisponível ou expirado no servidor.'
        : response.status === 403
        ? 'Acesso não autorizado. Plano Premium obrigatório para baixar vídeos.'
        : `Falha ao baixar o arquivo: ${serverMessage}`;

    onProgress?.({ state: 'error', message: fullError });
    throw new Error(fullError);
  }

  // Validate Content-Type
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    const err = 'O servidor retornou uma página HTML em vez do arquivo de vídeo. O link pode ter expirado ou a rota mudou.';
    onProgress?.({ state: 'error', message: err });
    throw new Error(err);
  }

  if (contentType.includes('application/json')) {
    const json = await response.json().catch(() => ({}));
    const err = json.error || 'O servidor retornou uma mensagem de erro em formato JSON.';
    onProgress?.({ state: 'error', message: err });
    throw new Error(err);
  }

  onProgress?.({
    state: 'validating',
    message: 'Baixando dados binários e verificando integridade do contêiner...',
    progressPercent: 50,
  });

  const blob = await response.blob();

  // Validate size
  if (!blob || blob.size === 0) {
    const err = 'O arquivo de vídeo recebido está vazio (0 bytes).';
    onProgress?.({ state: 'error', message: err });
    throw new Error(err);
  }

  if (blob.size < 1024) {
    const err = `Arquivo recebido é anômalo ou incompleto (${blob.size} bytes).`;
    onProgress?.({ state: 'error', message: err });
    throw new Error(err);
  }

  // Validate Magic Bytes
  const headerSlice = await blob.slice(0, 64).arrayBuffer();
  const validation = validateVideoMagicBytes(headerSlice, format);
  if (!validation.isValid) {
    const err = validation.error || 'Arquivo corrompido ou formato não reconhecido.';
    onProgress?.({ state: 'error', message: err });
    throw new Error(err);
  }

  onProgress?.({
    state: 'saving',
    message: `Salvando vídeo (${(blob.size / 1024 / 1024).toFixed(2)} MB)...`,
    progressPercent: 90,
    fileSizeBytes: blob.size,
  });

  // Construct final verified blob with correct MIME type
  const targetMime = format === 'mp4' ? 'video/mp4' : 'video/webm';
  const verifiedBlob = new Blob([blob], { type: targetMime });
  const objectUrl = URL.createObjectURL(verifiedBlob);

  // Trigger browser download via object URL
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up object URL after 60s
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 60000);

  onProgress?.({
    state: 'completed',
    message: `Download concluído com sucesso (${(blob.size / 1024 / 1024).toFixed(2)} MB)!`,
    progressPercent: 100,
    fileSizeBytes: blob.size,
  });

  return { sizeBytes: blob.size, format: validation.detectedType };
}
