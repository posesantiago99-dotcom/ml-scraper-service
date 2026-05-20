const express = require("express");
const fetch = require("node-fetch");
const app = express();

app.get("/detalle", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url requerida" });

  try {
    const skuMatch = url.match(/MLU-?(\d+)/);
    if (!skuMatch) return res.status(400).json({ error: "SKU no encontrado" });
    const itemId = "MLU" + skuMatch[1];

    const response = await fetch(`https://auto.mercadolibre.com.uy/${itemId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "es-UY,es;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const html = await response.text();

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
