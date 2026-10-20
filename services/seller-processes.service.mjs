import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, lstat, unlink, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { getPdfRoot } from './storage.service.mjs';
import { irKey, sealIr, openIr } from './ir-exemption-domain.mjs';

export const PROCESS_RUN_LIMIT = 200;
export const PROCESS_BATCH_LIMIT = 50;
const field = (object, name) => object?.[Object.keys(object || {}).find(key => key.toLowerCase() === name.toLowerCase())];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const invalid = () => { throw Object.assign(new Error('Processos salvos indisponíveis.'), { code: 'seller_processes_unavailable', status: 422 }); };
const key = env => irKey(env.AUDITA_PROFILE_ENCRYPTION_KEY || env.AUDITA_IR_ENCRYPTION_KEY);
const root = options => resolve(options.root || join(getPdfRoot(), 'seller-processes'));
export const processRecords = data => Array.isArray(field(data, 'processos')) ? field(data, 'processos') : [];

// Fixed, bounded encrypted chunks keep large responses out of audit polling and model context.
export async function saveSellerProcesses(data, auditId, options = {}) {
  const env = options.env || process.env, secret = key(env), records = processRecords(data);
  if (!secret || !/^[\w-]{1,100}$/.test(auditId)) invalid();
  await mkdir(root(options), { recursive: true, mode: 0o700 });
  const directoryStat=await lstat(root(options));
  if(!directoryStat.isDirectory()||directoryStat.isSymbolicLink()||await realpath(root(options))!==root(options))invalid();
  const collection = { version: 1, auditId, total: records.length,
    reportedTotal: Math.max(records.length, Number.isSafeInteger(Number(field(data, 'totalProcessos'))) ? Number(field(data, 'totalProcessos')) : 0), batches: [] };
  const created = [];
  const document = field(data, 'documentoConsultado');
  let group = [], size = 0, start = 0;
  async function flush() {
    if (!group.length) return;
    const payload = { documentoConsultado: document, processos: group };
    const storageName = `${randomUUID()}.enc`;
    await writeFile(join(root(options), storageName), sealIr(payload, secret, `seller-processes:${auditId}:${storageName}`), { flag: 'wx', mode: 0o600 });
    created.push(storageName);
    collection.batches.push({ storageName, start, count: group.length, sha256: hash(payload) });
    start += group.length; group = []; size = 0;
  }
  try {
    for (const original of records) {
      const record = field(original, 'segredoJustica') === true ? { segredoJustica: true } : JSON.parse(JSON.stringify(original,
        (name, value) => /token|senha|password|base64|urlcomprovante/i.test(name) ? undefined : value));
      const length = JSON.stringify(record).length;
      if (group.length && (group.length >= PROCESS_BATCH_LIMIT || size + length > 100000)) await flush();
      group.push(record); size += length;
    }
    await flush();
    return collection;
  } catch (error) {
    await Promise.all(created.map(name => unlink(join(root(options), name)).catch(() => {})));
    throw error;
  }
}

export async function readSellerProcessBatch(collection, batch, options = {}) {
  const secret = key(options.env || process.env);
  if (!secret || collection?.version !== 1 || !/^[\w-]{1,100}$/.test(collection.auditId || '')
    || !collection.batches?.some(item => item.storageName === batch?.storageName && item.sha256 === batch.sha256)
    || !/^[0-9a-f-]{36}\.enc$/.test(batch?.storageName || '')) invalid();
  const directory = root(options), path = join(directory, batch.storageName), stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024 * 1024 || await realpath(directory) !== directory || await realpath(path) !== path) invalid();
  const payload = openIr(await readFile(path, 'utf8'), secret, `seller-processes:${collection.auditId}:${batch.storageName}`);
  if (!Array.isArray(payload.processos) || payload.processos.length !== batch.count || hash(payload) !== batch.sha256) invalid();
  return payload;
}

export function processCoverage(sources, checkpoints = {}) {
  const collections = sources.filter(source => source.processCollection);
  if (!collections.length) return null;
  const total = collections.reduce((sum, source) => sum + source.processCollection.total, 0);
  const reportedTotal = collections.reduce((sum, source) => sum + source.processCollection.reportedTotal, 0);
  const analyzed = Object.values(checkpoints).filter(item => item.status === 'analyzed').reduce((sum, item) => sum + (item.processCount || 0), 0);
  return { total, reportedTotal, analyzed, remaining: Math.max(0, total - analyzed), complete: analyzed === total && total === reportedTotal, executionLimit: PROCESS_RUN_LIMIT };
}
