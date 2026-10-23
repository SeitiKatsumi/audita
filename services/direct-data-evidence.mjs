export function sanitizeSellerEvidence(data) {
  return JSON.stringify(data, (key, value) => {
    if (/token|senha|password|base64|urlcomprovante|documentoConsultado/i.test(key)) return undefined;
    if (value && typeof value === 'object' && Object.entries(value).some(([name, flag]) => name.toLowerCase() === 'segredojustica' && flag === true)) return { segredoJustica: true };
    if (typeof value === 'string' && /https?:\/\/\S*[?&](?:token|key|api_key|authorization|signature)=/i.test(value)) return '[URL privada omitida]';
    return value;
  });
}
