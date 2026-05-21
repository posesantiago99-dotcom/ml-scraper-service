const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const app = express();

app.get("/detalle", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url requerida" });

  try {
    const skuMatch = url.match(/MLU-?(\d+)/);
    if (!skuMatch) return res.status(400).json({ error: "SKU no encontrado" });

    const browser = await puppeteer.launch({
      headless: process.env.HEADLESS !== "false",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    try {
      await page.waitForSelector("#continue-button:not([disabled])", { timeout: 5000 });
      await page.click("#continue-button");
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
    } catch (e) {
      console.log("No hay challenge");
    }

    try {
      await page.waitForFunction(
        () => document.body.innerHTML.includes("Kilómetros") || document.body.innerHTML.includes("Marca"),
        { timeout: 35000 },
      );
      console.log("Atributos encontrados en el DOM");
    } catch (e) {
      console.log("Timeout esperando atributos, extrayendo del HTML cargado");
    }

    const html = await page.content();
    await browser.close();

    console.log("HTML LENGTH:", html.length);
    console.log("HTML COMPLETO:", html);
    const idxMarca = html.indexOf('"Marca"');
    console.log("POSICION Marca:", idxMarca);
    if (idxMarca > -1) console.log("CONTEXTO:", html.substring(idxMarca - 50, idxMarca + 200));

    const extraer = (nombre) => {
      const regex = new RegExp(`\\{"id":"${nombre}","text":"([^"]+)"\\}`);
      const match = html.match(regex);
      return match ? match[1] : null;
    };

    const kmTexto = extraer("Kilómetros");
    const kilometraje = kmTexto ? parseInt(kmTexto.replace(/\./g, "").replace(/\s*km/i, "")) : null;
    const anioTexto = extraer("Año");
    const anio = anioTexto ? parseInt(anioTexto) : null;
    const matchUbicacion = html.match(/"city_name":"([^"]+)"/);

    res.json({
      marca: extraer("Marca"),
      modelo: extraer("Modelo"),
      version: extraer("Versión"),
      anio,
      kilometraje,
      combustible: extraer("Tipo de combustible")?.toLowerCase() || null,
      transmision: extraer("Transmisión")?.toLowerCase() || null,
      color: extraer("Color"),
      puertas: extraer("Puertas") ? parseInt(extraer("Puertas")) : null,
      motor: extraer("Motor"),
      tipo_carroceria: extraer("Tipo de carrocería"),
      ubicacion: matchUbicacion ? matchUbicacion[1] : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
