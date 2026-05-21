const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const app = express();

app.get("/detalle", async (req, res) => {
  const { url, cookies: cookiesParam } = req.query;
  if (!url) return res.status(400).json({ error: "url requerida" });

  let browser;
  try {
    const skuMatch = url.match(/MLU-?(\d+)/);
    if (!skuMatch) return res.status(400).json({ error: "SKU no encontrado" });

    browser = await puppeteer.launch({
      headless: process.env.HEADLESS !== "false",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (["image", "stylesheet", "font", "media"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    if (cookiesParam) {
      let cookies;
      try {
        cookies = JSON.parse(cookiesParam);
        if (!Array.isArray(cookies)) cookies = [cookies];
      } catch {
        await browser.close();
        return res.status(400).json({ error: "cookies debe ser un JSON válido (array de objetos cookie)" });
      }

      const targetUrl = new URL(url);
      const normalized = cookies.map((c) => ({
        name: c.name,
        value: String(c.value),
        domain: c.domain || targetUrl.hostname,
        path: c.path || "/",
        ...(c.expires != null && { expires: c.expires }),
        ...(c.httpOnly != null && { httpOnly: c.httpOnly }),
        ...(c.secure != null && { secure: c.secure }),
        ...(c.sameSite != null && { sameSite: c.sameSite }),
      }));

      await page.setCookie(...normalized);
      console.log(`Cookies inyectadas: ${normalized.length}`);
    }

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    try {
      await page.waitForSelector("#continue-button:not([disabled])", { timeout: 5000 });
      await page.click("#continue-button");
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
    } catch {
      console.log("No hay challenge");
    }

    try {
      await page.waitForFunction(
        () => document.body.innerHTML.includes("Kilómetros") || document.body.innerHTML.includes("Marca"),
        { timeout: 35000 },
      );
      console.log("Atributos encontrados en el DOM");
    } catch {
      console.log("Timeout esperando atributos, extrayendo del HTML cargado");
    }

    const html = await page.content();
    await browser.close();

    const extraer = (nombre) => {
      const regex = new RegExp(`\\{"id":"${nombre}","text":"([^"]+)"\\}`);
      const match = html.match(regex);
      return match ? match[1] : null;
    };

    const kmTexto = extraer("Kilómetros");
    const kilometraje = kmTexto ? parseInt(kmTexto.replace(/\./g, "").replace(/\s*km/i, "")) : null;
    const anioTexto = extraer("Año");
    const anio = anioTexto ? parseInt(anioTexto) : null;
    const transmision = extraer("Transmisión")?.toLowerCase() || null;

    res.json({ anio, kilometraje, transmision });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
