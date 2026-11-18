import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const MAX_CONCURRENT_PYTHON_JOBS =
  Number(process.env.MAX_CONCURRENT_PYTHON_JOBS) || 2;

/**
 * Queue to limit concurrent heavy Python processes (EasyOCR, OpenCV, PyAV, Faster-Whisper)
 */
class PythonQueue {
  constructor(concurrency = MAX_CONCURRENT_PYTHON_JOBS) {
    this.concurrency = concurrency;
    this.activeJobs = 0;
    this.queue = [];
  }

  get maxConcurrent() {
    return this.concurrency;
  }

  drain() {
    this.queue = [];
  }

  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.dequeue();
    });
  }

  async dequeue() {
    if (this.activeJobs >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const { fn, resolve, reject } = this.queue.shift();
    this.activeJobs++;

    try {
      const result = await fn();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.activeJobs--;
      this.dequeue();
    }
  }

  getActiveJobCount() {
    return this.activeJobs;
  }

  getQueueLength() {
    return this.queue.length;
  }
}

export const pythonProcessQueue = new PythonQueue();

/**
 * Spawns a Python child process inside its own process group,
 * enforces memory/CPU env caps, applies single settle timeout guard with SIGKILL,
 * and executes via spawn with array arguments (never shell).
 * 
 * @param {string} scriptPath
 * @param {string[]} args
 * @param {object} options
 * @returns {Promise<{ stdout: string, stderr: string, parsed: any }>}
 */
export function runPythonProcess(scriptPath, args = [], options = {}) {
  const timeoutMs = options.timeoutMs || 30000;
  const isWin = process.platform === 'win32';

  return pythonProcessQueue.enqueue(() => {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;

      // Ensure args is strictly an array
      const safeArgs = Array.isArray(args) ? args : [String(args)];

      // Spawn with shell: false to guarantee user strings can never be shell-interpreted
      const child = spawn(
        'python',
        [scriptPath, ...safeArgs],
        {
          shell: false,
          detached: !isWin, // On POSIX creates a separate process group
          env: {
            ...process.env,
            PYTHONHASHSEED: 'random',
            PYTHONUNBUFFERED: '1',
            MALLOC_ARENA_MAX: '2', // Cap glibc memory arenas
            OMP_NUM_THREADS: '2', // Cap OpenMP/OpenCV CPU worker threads
            MAX_IMAGE_PIXELS: String(options.maxImagePixels || 25000000),
            MAX_IMAGE_WIDTH: String(options.maxImageWidth || 8192),
            MAX_IMAGE_HEIGHT: String(options.maxImageHeight || 8192),
            MAX_VIDEO_DURATION_SECONDS: String(options.maxVideoDuration || 1800),
            MAX_VIDEO_WIDTH: String(options.maxVideoWidth || 3840),
            MAX_VIDEO_HEIGHT: String(options.maxVideoHeight || 2160),
            MAX_VIDEO_FRAME_COUNT: String(options.maxVideoFrames || 100000),
            ...(options.env || {}),
          },
        }
      );

      let stdout = '';
      let stderr = '';
      const MAX_OUTPUT_BYTES = 15 * 1024 * 1024; // 15 MB output cap

      child.stdout.on('data', (chunk) => {
        if (stdout.length < MAX_OUTPUT_BYTES) {
          stdout += chunk.toString();
        }
      });

      child.stderr.on('data', (chunk) => {
        if (stderr.length < MAX_OUTPUT_BYTES) {
          stderr += chunk.toString();
        }
      });

      const killProcessTree = async () => {
        if (!child.pid) return;
        if (isWin) {
          try {
            await execAsync(`taskkill /pid ${child.pid} /T /F`);
          } catch (e) {
            // Process may already have terminated cleanly
          }
        } else {
          try {
            // Kill entire process group on POSIX
            process.kill(-child.pid, 'SIGKILL');
          } catch (e) {
            try {
              child.kill('SIGKILL');
            } catch (e2) {}
          }
        }
      };

      timer = setTimeout(async () => {
        if (!settled) {
          settled = true;
          await killProcessTree();
          reject(new Error(`Python process timed out after ${timeoutMs}ms.`));
        }
      }, timeoutMs);

      child.on('error', async (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          await killProcessTree();
          reject(err);
        }
      });

      child.on('close', (code) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);

          if (code !== 0) {
            let errorMsg = stderr.trim() || `Python process exited with code ${code}`;
            let parsed = null;
            try {
              parsed = JSON.parse(stdout);
              if (parsed && parsed.error) errorMsg = parsed.error;
            } catch (e) {}
            return reject(new Error(errorMsg));
          }

          let parsed = null;
          try {
            parsed = JSON.parse(stdout);
          } catch (e) {}

          resolve({ stdout, stderr, parsed });
        }
      });
    });
  });
}
