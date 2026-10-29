// ponytail: three sources per batch; a shared provider queue is needed if replicas require a global limit.
export async function collectInParallel(items, collect) {
  const running = new Set();
  const failures = [];
  let next = 0;
  while (next < items.length || running.size) {
    while (!failures.length && next < items.length && running.size < 3) {
      const index = next++;
      const task = Promise.resolve().then(() => collect(items[index], index))
        .catch(error => { failures.push(error); }).finally(() => running.delete(task));
      running.add(task);
    }
    if (!running.size) break;
    await Promise.race(running);
  }
  if (failures.length) throw failures[0];
}
