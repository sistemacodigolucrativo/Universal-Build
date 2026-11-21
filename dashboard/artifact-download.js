/* Minimal ZIP reader: extract one APK/AAB from a GitHub Actions artifact when supported.
   Does not execute archive paths or load scripts from ZIP. Browser may fall back to ZIP. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UniversalArtifactDownload = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const MAX_ZIP = 300 * 1024 * 1024;
  const MAX_OUTPUT = 300 * 1024 * 1024;
  const text = new TextDecoder("utf-8");
  const baseName = name => String(name || "artifact").replace(/[^a-z0-9._-]+/gi, "_").slice(0, 100);
  function entries(buffer) {
    const view = new DataView(buffer);
    let end = -1;
    for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw new Error("Arquivo de artefato não é um ZIP válido.");
    const count = view.getUint16(end + 10, true);
    const directory = view.getUint32(end + 16, true);
    if (count > 200 || directory > buffer.byteLength) throw new Error("ZIP fora do limite permitido.");
    let cursor = directory;
    const found = [];
    for (let i = 0; i < count; i++) {
      if (cursor + 46 > buffer.byteLength || view.getUint32(cursor, true) !== 0x02014b50)
        throw new Error("Diretório ZIP inválido.");
      const flags = view.getUint16(cursor + 8, true);
      const method = view.getUint16(cursor + 10, true);
      const compressed = view.getUint32(cursor + 20, true);
      const size = view.getUint32(cursor + 24, true);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const local = view.getUint32(cursor + 42, true);
      if (cursor + 46 + nameLength + extraLength + commentLength > buffer.byteLength)
        throw new Error("Diretório ZIP truncado.");
      const name = text.decode(new Uint8Array(buffer, cursor + 46, nameLength));
      cursor += 46 + nameLength + extraLength + commentLength;
      if (!/\.(apk|aab)$/i.test(name) || name.includes("..") || name.startsWith("/") ||
          name.includes("\\") || (flags & 1) || size > MAX_OUTPUT ||
          compressed === 0xffffffff || size === 0xffffffff) continue;
      if (local + 30 > buffer.byteLength || view.getUint32(local, true) !== 0x04034b50)
        throw new Error("Cabeçalho ZIP inválido.");
      const data = local + 30 + view.getUint16(local + 26, true) +
        view.getUint16(local + 28, true);
      if (data + compressed > buffer.byteLength) throw new Error("Arquivo ZIP incompleto.");
      found.push({ name: name.split("/").at(-1), method, size, start: data, compressed });
    }
    return found;
  }
  async function prepare(buffer, artifactName) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > MAX_ZIP)
      throw new Error("Artefato excede o limite de download direto no navegador.");
    const zip = new Blob([buffer], { type: "application/zip" });
    const fallback = { blob: zip, filename: baseName(artifactName) + ".zip", archive: true };
    let files;
    try { files = entries(buffer); } catch (_) { return fallback; }
    if (files.length !== 1) return fallback;
    const file = files[0];
    try {
      const data = buffer.slice(file.start, file.start + file.compressed);
      let raw;
      if (file.method === 0) raw = data;
      else if (file.method === 8 && typeof DecompressionStream === "function") {
        const inflated = new Blob([data]).stream()
          .pipeThrough(new DecompressionStream("deflate-raw"));
        raw = await new Response(inflated).arrayBuffer();
      } else return fallback;
      if (raw.byteLength !== file.size || raw.byteLength > MAX_OUTPUT) return fallback;
      return {
        blob: new Blob([raw], { type: "application/octet-stream" }),
        filename: baseName(file.name),
        archive: false
      };
    } catch (_) {
      return fallback;
    }
  }
  return { prepare, entries, MAX_ZIP };
});
