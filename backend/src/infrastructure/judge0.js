import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const JUDGE0_URL = process.env.JUDGE0_URL;
const JUDGE0_KEY = process.env.JUDGE0_KEY;
const JUDGE0_HOST = process.env.JUDGE0_HOST;

if (!JUDGE0_URL) {
  throw new Error('Server misconfiguration: JUDGE0_URL not set');
}

// Basic language mapping for dropdown keys -> Judge0 language_id
export const languageKeyToId = {
  python: 71,       // Python 3.8.1
  javascript: 63,   // JavaScript (Node.js 12.14.0)
  java: 62,         // Java (OpenJDK 13.0.1)
  cpp: 54           // C++ (GCC 9.2.0)
};

export async function runCodeViaJudge0({ languageKey, sourceCode, stdin }) {
  console.log('=== JUDGE0 REQUEST DEBUG ===');
  const language_id = languageKeyToId[languageKey];
  if (!language_id) throw new Error('Unsupported language');

  const payload = {
    language_id,
    source_code: sourceCode,
    stdin
  };

  const headers = {
    'content-type': 'application/json',
    ...(JUDGE0_KEY ? { 'X-Auth-Token': JUDGE0_KEY } : {}),
    ...(JUDGE0_HOST ? { 'X-Auth-Host': JUDGE0_HOST } : {})
  };

  // Use async flow: create submission, then poll by token. Avoids wait=true issues on some deployments.
  const createUrl = `${JUDGE0_URL}/submissions?base64_encoded=false`;
  console.log('Judge0 Create URL:', createUrl);
  console.log('Judge0 Headers:', headers);
  console.log('Judge0 Payload:', payload);

  try {
    const createRes = await axios.post(createUrl, payload, { headers });
    const token = createRes?.data?.token;
    if (!token) {
      console.log('Judge0 create response missing token:', createRes?.data);
      throw new Error('Judge0 did not return a token');
    }

    const fetchUrl = `${JUDGE0_URL}/submissions/${token}?base64_encoded=false`;
    const startedAt = Date.now();
    const timeoutMs = 20000; // 20s total timeout
    const pollDelayMs = 500; // poll every 500ms

    while (true) {
      const res = await axios.get(fetchUrl, { headers });
      const data = res?.data;
      const statusId = data?.status?.id;
      // 1=In Queue, 2=Processing, 3=Accepted/Finished
      if (statusId && statusId >= 3) {
        console.log('Judge0 Final Response:', data);
        return data;
      }
      if (Date.now() - startedAt > timeoutMs) {
        console.log('Judge0 polling timed out for token:', token);
        throw new Error('Judge0 polling timed out');
      }
      await new Promise(r => setTimeout(r, pollDelayMs));
    }
  } catch (error) {
    // Enrich logging for network errors without response
    const enriched = {
      message: error.message,
      code: error.code,
      requestPath: error.request?.path,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    };
    console.log('Judge0 Error Details:', enriched);
    throw error;
  }
}
