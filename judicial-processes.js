// Shared, bounded extraction. A certificate identifier or count is never a process number.
export function normalizedCnj(value) {
  if (typeof value !== 'string' || !/^[\d.\-\s]+$/.test(value)) return null;
  const number = value.replace(/\D/g, '');
  if (number.length !== 20 || /^(\d)\1+$/.test(number) || Number(number.slice(9,13)) < 1900
    || Number(number.slice(9,13)) > new Date().getFullYear()+1) return null;
  return BigInt(number.slice(0,7)+number.slice(9)+number.slice(7,9)) % 97n === 1n ? number : null;
}

export function processNumbers(value, limit = 200) {
  const numbers = new Set(); let visited = 0;
  function walk(item, key = '', depth = 0) {
    if (++visited > 20000 || depth > 12 || numbers.size >= limit) return;
    if (typeof item === 'string') {
      if (/numeroProcesso|numero_cnj|^cnj$|processNumbers|processosRelacionados|^processo$|^numero$|^codigo$/i.test(key)) {
        const number = normalizedCnj(item); if (number) numbers.add(number);
      }
      if (/numeroCertidao|numeroCertificado|codigoValidacao|codigoAutenticidade|codigoControle|token|senha|password|url/i.test(key)) return;
      for (const match of item.slice(0,1500000).matchAll(/(?<!\d)\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}(?!\d)/g)) {
        const number = normalizedCnj(match[0]); if (number) numbers.add(number);
        if (numbers.size >= limit) break;
      }
    } else if (Array.isArray(item)) {
      for (const entry of item) { walk(entry, key, depth+1); if (visited > 20000 || numbers.size >= limit) break; }
    } else if (item && typeof item === 'object') {
      if (Object.entries(item).some(([name, v]) => /^(segredoJustica|segredo_justica|sigiloso|sigilo)$/i.test(name) && (v === true || /^(true|sim|s|1)$/i.test(String(v))))) return;
      for (const [name, entry] of Object.entries(item)) {
        if (/numeroCertidao|numeroCertificado|codigoValidacao|codigoAutenticidade|codigoControle|token|senha|password|url/i.test(name)) continue;
        walk(entry, name, depth+1); if (visited > 20000 || numbers.size >= limit) break;
      }
    }
  }
  walk(value); return [...numbers];
}
