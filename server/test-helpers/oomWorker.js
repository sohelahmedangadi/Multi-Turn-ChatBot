import { parentPort } from 'worker_threads';
if (parentPort) {
  parentPort.once('message', () => {
    const arr = [];
    while (true) {
      arr.push(new Array(100000).fill('memory_bomb_data_string_filling_heap'));
    }
  });
}
