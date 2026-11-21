import {normalizeMssv,recordId,decryptStudent} from './roster-crypto.mjs';

const form = document.querySelector('#verification');
const input = document.querySelector('#student');
const notice = document.querySelector('#notice');
const button = document.querySelector('#verify');
const result = document.querySelector('#result');
const resultTitle = document.querySelector('#result-title');
const download = document.querySelector('#download');
const resetBtn = document.querySelector('#reset');
const canvas = document.querySelector('#qr');

let manifestPromise;

function message(text) {
  notice.textContent = text;
  notice.hidden = !text;
  if (text) {
    input.setAttribute('aria-invalid', 'true');
  } else {
    input.removeAttribute('aria-invalid');
  }
}

function pending(value) {
  input.disabled = value;
  button.disabled = value;
  button.textContent = value ? 'Đang tra cứu…' : 'Lấy mã QR';
}

async function readJson(url) {
  const response = await fetch(url, {cache: 'no-cache'});
  if (!response.ok) throw Error('HTTP ' + response.status);
  return response.json();
}

async function lookup(mssv) {
  manifestPromise ??= readJson('./data/manifest.json').catch(error => {
    manifestPromise = undefined;
    throw error;
  });
  const manifest = await manifestPromise;
  if (manifest.version !== 1 ||
      manifest.algorithm !== 'AES-256-GCM/PBKDF2-SHA256' ||
      manifest.iterations !== 100000 ||
      !/^[a-f0-9]{24}$/.test(manifest.generation)) {
    throw Error('Unsupported roster');
  }
  const id = await recordId(mssv);
  const shard = await readJson('./data/' + manifest.generation + '/' + id.slice(0, 2) + '.json');
  if (!Object.hasOwn(shard, id)) return null;
  return decryptStudent(mssv, shard[id], manifest);
}

function draw(payload) {
  if (typeof qrcodegen === 'undefined') {
    throw Error('Thư viện tạo mã QR chưa sẵn sàng.');
  }
  const qr = qrcodegen.QrCode.encodeText(payload, qrcodegen.QrCode.Ecc.MEDIUM);
  const scale = 10;
  const border = 4;
  canvas.width = canvas.height = (qr.size + border * 2) * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.getModule(x, y)) {
        ctx.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
      }
    }
  }
}

input.addEventListener('input', () => message(''));

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;

  const raw = input.value.trim();
  const mssv = normalizeMssv(raw);
  if (!mssv) {
    message('Vui lòng nhập MSSV gồm 10 chữ số, ví dụ 52.01.000.001 hoặc 5201000001.');
    input.focus();
    return;
  }

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    message('Trình duyệt hoặc môi trường hiện tại không hỗ trợ Web Crypto bảo mật. Vui lòng truy cập qua HTTPS.');
    return;
  }

  pending(true);
  message('');

  try {
    const student = await lookup(mssv);
    if (!student) {
      message('Không tìm thấy mã số sinh viên hợp lệ. Vui lòng kiểm tra lại MSSV.');
      input.focus();
      return;
    }

    const payload = 'KSK|' + mssv + '|K52_1011_C|20261110';
    draw(payload);

    document.querySelector('#student-name').textContent = (student.order || '—') + ' – ' + student.name;
    document.querySelector('#student-result').textContent = 'MSSV: ' + mssv;
    document.querySelector('#student-birth').textContent = 'Ngày sinh: ' + (student.birthDate || '—');

    try {
      download.href = canvas.toDataURL('image/png');
      download.download = 'QR_KSK_' + mssv.replaceAll('.', '') + '.png';
      download.hidden = false;
    } catch (_) {
      download.hidden = true;
    }

    form.reset();
    form.hidden = true;
    result.hidden = false;
    resultTitle.focus();
  } catch (error) {
    console.error(error);
    message('Chưa thể tra cứu lúc này. Vui lòng kiểm tra kết nối mạng và thử lại.');
  } finally {
    pending(false);
  }
});

resetBtn.addEventListener('click', () => {
  result.hidden = true;
  for (const id of ['student-name', 'student-result', 'student-birth']) {
    document.getElementById(id).textContent = '';
  }
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  if (download) {
    download.hidden = true;
    download.removeAttribute('href');
  }
  form.hidden = false;
  message('');
  input.focus();
});

// Auto-lookup if MSSV is present in URL query or hash
try {
  const urlParams = new URLSearchParams(window.location.search);
  const hashRaw = window.location.hash.replace(/^#/, '').trim();
  const hashParams = new URLSearchParams(hashRaw);
  const candidate = urlParams.get('mssv') || hashParams.get('mssv') || hashRaw;
  if (candidate) {
    const norm = normalizeMssv(candidate);
    if (norm) {
      input.value = norm;
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}));
      }
    }
  }
} catch (_) {}
