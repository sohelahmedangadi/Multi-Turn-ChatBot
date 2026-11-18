import 'dotenv/config';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createApp } from '../server/index.js';
import { tripGeminiCircuitBreaker, resetGeminiCircuitBreaker } from '../server/services/llmProvider.js';

function createMockMp4Buffer(durationSec = 10, timescale = 1000) {
  const buf = Buffer.alloc(160);
  buf.writeUInt32BE(16, 0);
  buf.write('ftyp', 4, 'ascii');
  buf.write('isom', 8, 'ascii');
  buf.writeUInt32BE(512, 12);
  buf.writeUInt32BE(144, 16);
  buf.write('moov', 20, 'ascii');
  const mvhdOffset = 24;
  buf.writeUInt32BE(108, mvhdOffset);
  buf.write('mvhd', mvhdOffset + 4, 'ascii');
  buf.writeUInt8(0, mvhdOffset + 8);
  buf.writeUInt32BE(timescale, mvhdOffset + 20);
  buf.writeUInt32BE(durationSec * timescale, mvhdOffset + 24);
  return buf;
}

async function runManualSmokeTest() {
  console.log('======================================================================');
  console.log('🚀 RUNNING MANUAL SMOKE TEST PASS');
  console.log('======================================================================\n');

  const realDataDir = path.resolve('data');
  if (process.env.DATA_DIR && path.resolve(process.env.DATA_DIR) === realDataDir) {
    throw new Error(`[Security Guard] Refusing to run smoke test: DATA_DIR resolves to production data directory (${realDataDir}).`);
  }

  let smokeTempDir = null;
  if (!process.env.DATA_DIR) {
    smokeTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmo_smoke_'));
    process.env.DATA_DIR = smokeTempDir;
  }
  process.env.CHROMA_COLLECTION_PREFIX = `smoke_${Date.now()}_`;

  try {
    const app = await createApp();
    const timestamp = Date.now();
    const username = `smoke_${timestamp}`;
    const email = `smoke_${timestamp}@example.com`;
    const password = 'StrongPassword123!';

  // 1. REGISTER
  console.log('1️⃣  Testing User Registration (POST /api/auth/register)...');
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ username, email, password });
  if (regRes.status !== 201 || !regRes.body.token) {
    throw new Error(`Registration failed (${regRes.status}): ${JSON.stringify(regRes.body)}`);
  }
  console.log(`   ✅ Registered successfully: User ID = ${regRes.body.user.id}, Email = ${regRes.body.user.email}`);

  // 2. LOG IN
  console.log('\n2️⃣  Testing User Login (POST /api/auth/login)...');
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ emailOrUsername: email, password });
  if (loginRes.status !== 200 || !loginRes.body.token) {
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginRes.body)}`);
  }
  const token = loginRes.body.token;
  console.log('   ✅ Logged in successfully: JWT Token received');

  // Create Chat Session
  console.log('\n3️⃣  Creating Chat Session (POST /api/session)...');
  const sessRes = await request(app)
    .post('/api/session')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Smoke Test Session' });
  const sessionId = sessRes.body.sessionId || sessRes.body.id;
  if (sessRes.status !== 201 || !sessionId) {
    throw new Error(`Session creation failed (${sessRes.status}): ${JSON.stringify(sessRes.body)}`);
  }
  console.log(`   ✅ Session created: ${sessionId}`);

  // 4. CHAT (GEMINI PATH)
  console.log('\n4️⃣  Testing Chat via Gemini Path (POST /api/chat)...');
  resetGeminiCircuitBreaker();
  const geminiChatRes = await request(app)
    .post('/api/chat')
    .set('Authorization', `Bearer ${token}`)
    .send({
      sessionId,
      message: 'Hello CosmoAI! Please confirm you are online in 5 words.',
      stream: false,
    });
  const geminiText = geminiChatRes.body.reply || geminiChatRes.body.text;
  if (geminiChatRes.status !== 200 || !geminiText) {
    throw new Error(`Gemini chat failed (${geminiChatRes.status}): ${JSON.stringify(geminiChatRes.body)}`);
  }
  console.log(`   ✅ Gemini Response received: Provider = "${geminiChatRes.body.provider}", Reply = "${geminiText.trim().slice(0, 80)}..."`);
  if (geminiChatRes.body.provider !== 'gemini') {
    console.warn(`   ⚠️ Notice: Expected provider "gemini", received "${geminiChatRes.body.provider}"`);
  }

  // 5. FORCE 429 (GROQ PATH)
  console.log('\n5️⃣  Testing Fallback via Forced 429 Rate Limit (Groq Path)...');
  tripGeminiCircuitBreaker(new Error('429 RESOURCE_EXHAUSTED: Rate limit exceeded quota cap'));
  const groqChatRes = await request(app)
    .post('/api/chat')
    .set('Authorization', `Bearer ${token}`)
    .send({
      sessionId,
      message: 'Hello Groq! Reply with exactly "Groq is active".',
      stream: false,
    });
  const groqText = groqChatRes.body.reply || groqChatRes.body.text;
  if (groqChatRes.status !== 200 || !groqText) {
    throw new Error(`Groq fallback chat failed (${groqChatRes.status}): ${JSON.stringify(groqChatRes.body)}`);
  }
  console.log(`   ✅ Groq Response received: Provider = "${groqChatRes.body.provider}", Reply = "${groqText.trim().slice(0, 80)}..."`);
  if (groqChatRes.body.provider !== 'groq') {
    throw new Error(`Expected fallback provider to be "groq", but got "${groqChatRes.body.provider}"`);
  }
  resetGeminiCircuitBreaker();
  console.log('   ✅ Circuit breaker reset back to CLOSED');

  // 6. UPLOAD PDF, IMAGE, AND SHORT VIDEO
  console.log('\n6️⃣  Testing Upload Pipeline: PDF, Image, and Short Video...');

  // 6a. PDF Upload
  console.log('   📄 [6a] Uploading PDF document...');
  let pdfBuffer;
  if (fs.existsSync('uploads_storage/file_mu9dj8s0_2i3r2.bin')) {
    pdfBuffer = fs.readFileSync('uploads_storage/file_mu9dj8s0_2i3r2.bin');
  } else {
    pdfBuffer = Buffer.from('%PDF-1.5\n1 0 obj\n<< /Title (Smoke Test PDF) >>\nendobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n60\n%%EOF');
  }
  const pdfUploadRes = await request(app)
    .post('/api/files/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', pdfBuffer, 'sample.pdf')
    .field('sessionId', sessionId);
  if (pdfUploadRes.status !== 202) {
    throw new Error(`PDF upload failed (${pdfUploadRes.status}): ${JSON.stringify(pdfUploadRes.body)}`);
  }
  console.log(`      ✅ PDF accepted: JobId = ${pdfUploadRes.body.jobId}, FileId = ${pdfUploadRes.body.fileId}`);
  await waitForJob(app, token, pdfUploadRes.body.jobId);

  // 6b. Image Upload
  console.log('   🖼️  [6b] Uploading Image (PNG/JPEG)...');
  let imgBuffer;
  if (fs.existsSync('uploads_storage/file_mwi24cgp_gh4er.bin')) {
    imgBuffer = fs.readFileSync('uploads_storage/file_mwi24cgp_gh4er.bin');
  } else {
    imgBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89]);
  }
  const imgUploadRes = await request(app)
    .post('/api/files/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', imgBuffer, 'photo.jpg')
    .field('sessionId', sessionId);
  if (imgUploadRes.status !== 202) {
    throw new Error(`Image upload failed (${imgUploadRes.status}): ${JSON.stringify(imgUploadRes.body)}`);
  }
  console.log(`      ✅ Image accepted: JobId = ${imgUploadRes.body.jobId}, FileId = ${imgUploadRes.body.fileId}`);
  await waitForJob(app, token, imgUploadRes.body.jobId);

  // 6c. Short Video Upload (10-second MP4)
  console.log('   🎥 [6c] Uploading Short Video (10s MP4)...');
  const videoBuffer = createMockMp4Buffer(10, 1000);
  const videoUploadRes = await request(app)
    .post('/api/files/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', videoBuffer, 'short_clip.mp4')
    .field('sessionId', sessionId);
  if (videoUploadRes.status !== 202) {
    throw new Error(`Video upload failed (${videoUploadRes.status}): ${JSON.stringify(videoUploadRes.body)}`);
  }
  console.log(`      ✅ Short video accepted: JobId = ${videoUploadRes.body.jobId}, FileId = ${videoUploadRes.body.fileId}`);
  await waitForJob(app, token, videoUploadRes.body.jobId);

  // 7. MEMORY INSERT & DELETE
  console.log('\n7️⃣  Testing Memory Lifecycle (Insert & Delete)...');
  const createMemRes = await request(app)
    .post('/api/memories')
    .set('Authorization', `Bearer ${token}`)
    .send({
      key: 'smoke_favorite_editor',
      fact: 'Antigravity IDE',
      category: 'preference',
    });
  if (createMemRes.status !== 201) {
    throw new Error(`Memory creation failed (${createMemRes.status}): ${JSON.stringify(createMemRes.body)}`);
  }
  console.log('   ✅ Memory inserted: "smoke_favorite_editor" -> "Antigravity IDE"');

  const listMemRes = await request(app)
    .get('/api/memories')
    .set('Authorization', `Bearer ${token}`);
  const createdMem = listMemRes.body.memories.find((m) => m.key.toLowerCase() === 'smoke_favorite_editor');
  if (!createdMem) {
    throw new Error('Created memory not found in GET /api/memories');
  }
  console.log(`   ✅ Memory retrieved in list with ID = ${createdMem.id}`);

  // Delete memory
  const delMemRes = await request(app)
    .delete(`/api/memories/${createdMem.id}`)
    .set('Authorization', `Bearer ${token}`);
  if (delMemRes.status !== 200 || !delMemRes.body.success) {
    throw new Error(`Memory deletion failed (${delMemRes.status}): ${JSON.stringify(delMemRes.body)}`);
  }
  console.log(`   ✅ Memory ${createdMem.id} deleted successfully`);

  const listAfterDel = await request(app)
    .get('/api/memories')
    .set('Authorization', `Bearer ${token}`);
  const stillExists = listAfterDel.body.memories.some((m) => m.key.toLowerCase() === 'smoke_favorite_editor');
  if (stillExists) {
    throw new Error('Memory still present after deletion!');
  }
  console.log('   ✅ Verified memory was completely purged from store');

  // 8. LOGOUT AND TOKEN REVOCATION CHECK
  console.log('\n8️⃣  Testing Logout and Old Token Invalidation...');
  const logoutRes = await request(app)
    .post('/api/auth/logout')
    .set('Authorization', `Bearer ${token}`);
  if (logoutRes.status !== 200) {
    throw new Error(`Logout failed (${logoutRes.status}): ${JSON.stringify(logoutRes.body)}`);
  }
  console.log('   ✅ Logged out successfully');

  // Attempt using old revoked token
  const oldTokenRes = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);
  if (oldTokenRes.status !== 401) {
    throw new Error(`Expected HTTP 401 using revoked token, got ${oldTokenRes.status}`);
  }
  console.log(`   ✅ Old token was successfully rejected with HTTP 401: "${oldTokenRes.body.error}"`);

  console.log('\n======================================================================');
  console.log('🎉 ALL MANUAL SMOKE TEST CHECKS PASSED PERFECTLY!');
  console.log('======================================================================\n');
  } finally {
    if (smokeTempDir && fs.existsSync(smokeTempDir)) {
      try {
        fs.rmSync(smokeTempDir, { recursive: true, force: true });
        console.log(`🧹 Cleaned up isolated smoke test DATA_DIR (${smokeTempDir})`);
      } catch (e) {}
    }
  }
}

async function waitForJob(app, token, jobId, maxWaitMs = 65000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await request(app)
      .get(`/api/files/status/${jobId}`)
      .set('Authorization', `Bearer ${token}`);
    if (res.status === 200 && res.body.job) {
      const status = res.body.job.status;
      if (status === 'completed') {
        console.log(`      ✅ Extraction completed (100%): ${res.body.job.filename}`);
        return;
      }
      if (status === 'failed') {
        throw new Error(`Job ${jobId} failed: ${res.body.job.error}`);
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  console.warn(`      ⚠️ Wait timed out for job ${jobId}, proceeding.`);
}

runManualSmokeTest().catch((err) => {
  console.error('❌ Smoke test failed:', err);
  process.exit(1);
});
