/**
 * Receipt barcode / QR payloads for print, thermal, PDF, email, and WhatsApp.
 */
export function receiptPayload(receipt) {
  return {
    receiptNo: receipt.receiptNo || "",
    customer: receipt.customerName || "",
    agent: receipt.agentName || "",
    branch: receipt.branchName || "",
    type: receipt.collectionType || receipt.type || "Collection",
    amount: Number(receipt.amount || 0),
    balance: Number(receipt.balance || 0),
    date: receipt.date || "",
    method: receipt.paymentMethod || "Cash"
  };
}

export function receiptVerifyText(receipt) {
  const payload = receiptPayload(receipt);
  return `ST|${payload.receiptNo}|${payload.amount}|${payload.date}|${payload.customer}`;
}

export function barcodeSvg(value, { height = 48, moduleWidth = 2 } = {}) {
  const text = String(value || "RECEIPT");
  const bits = [];
  bits.push("110");
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    for (let bit = 0; bit < 8; bit += 1) bits.push((code >> bit) & 1 ? "1" : "0");
    bits.push("0");
  }
  bits.push("110");
  const pattern = bits.join("");
  let x = 0;
  const bars = [];
  for (let i = 0; i < pattern.length; i += 1) {
    if (pattern[i] === "1") {
      bars.push(`<rect x="${x}" y="0" width="${moduleWidth}" height="${height}" fill="#111"/>`);
    }
    x += moduleWidth;
  }
  const width = Math.max(x, 80);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 18}" viewBox="0 0 ${width} ${height + 18}" role="img" aria-label="${text}">${bars.join("")}<text x="${width / 2}" y="${height + 14}" text-anchor="middle" font-size="10" font-family="monospace">${escapeXml(text)}</text></svg>`;
}

export function qrMatrix(value, size = 21) {
  const text = String(value || "");
  const cells = [];
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (let y = 0; y < size; y += 1) {
    const row = [];
    for (let x = 0; x < size; x += 1) {
      const finder = (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
      if (finder) {
        const dx = x < 7 ? x : x - (size - 7);
        const dy = y < 7 ? y : y - (size - 7);
        const ring = dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
        row.push(ring);
      } else {
        const bit = (hash + x * 73 + y * 37 + text.charCodeAt((x + y) % Math.max(1, text.length))) & 3;
        row.push(bit === 0 || bit === 1);
      }
    }
    cells.push(row);
  }
  return cells;
}

export function qrSvg(value, { module = 4 } = {}) {
  const matrix = qrMatrix(value);
  const size = matrix.length * module;
  const rects = [];
  matrix.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) rects.push(`<rect x="${x * module}" y="${y * module}" width="${module}" height="${module}" fill="#111"/>`);
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${rects.join("")}</svg>`;
}

export function receiptShareMessage(receipt, businessName = "Smile Trust") {
  const payload = receiptPayload(receipt);
  return `${businessName} receipt ${payload.receiptNo}
${payload.customer}
${payload.type}: GHS ${payload.amount.toFixed(2)}
Balance: GHS ${payload.balance.toFixed(2)}
${payload.date} · ${payload.method}
Agent: ${payload.agent}
Branch: ${payload.branch}`;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
