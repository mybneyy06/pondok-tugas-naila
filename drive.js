export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Gunakan metode POST." });
  }

  const gasUrl = process.env.GAS_WEB_APP_URL;
  const apiKey = process.env.DRIVE_API_KEY;

  if (!gasUrl || !apiKey) {
    return res.status(500).json({
      ok: false,
      error: "Environment variables GAS_WEB_APP_URL dan DRIVE_API_KEY belum diatur di Vercel."
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || typeof body.action !== "string") {
      return res.status(400).json({ ok: false, error: "Permintaan tidak valid." });
    }

    const upstream = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...body, apiKey })
    });

    const raw = await upstream.text();
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        ok: false,
        error: "Balasan Apps Script bukan JSON. Pastikan URL adalah URL Web App yang berakhiran /exec dan akses web app sudah diatur."
      });
    }

    if (result && result.ok === false) {
      return res.status(200).json(result);
    }

    let data = result && Object.prototype.hasOwnProperty.call(result, "data") ? result.data : result;
    for (let i = 0; i < 2 && data && data.data && !data.folder; i++) data = data.data;

    if (body.action === "getContents") {
      if (data && !data.folder && data.currentFolder) data.folder = data.currentFolder;
      if (data && !data.folder && data.id && data.name) {
        data = { ...data, folder: { id: data.id, name: data.name } };
      }
      if (!data || !data.folder || !data.folder.id) {
        return res.status(502).json({
          ok: false,
          error: "Apps Script merespons, tetapi data folder tidak sesuai. Pastikan backend Google Apps Script mengembalikan data folder yang benar."
        });
      }
      data.folders = Array.isArray(data.folders) ? data.folders : [];
      data.files = Array.isArray(data.files) ? data.files : [];
      result = { ok: true, data };
    } else if (result && !Object.prototype.hasOwnProperty.call(result, "data")) {
      result = { ok: true, data };
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "Tidak dapat menghubungi Apps Script: " + (error?.message || "kesalahan jaringan")
    });
  }
}
