import { parentPort } from 'worker_threads';
if (parentPort) {
  parentPort.once('message', () => {
    process.exit(1);
  });
} else {
  process.exit(1);
}
