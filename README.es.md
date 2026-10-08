# Qatom en Hack the Andes

Construye cosas que los agentes de IA puedan **encontrar, comprar y usar**, y cobra por cada llamada.

Todo lo necesario para que tu API, repo, datos o juego funcionen con Qatom antes y durante [Hack the Andes](https://hacktheandes.com) (Lima, 17 y 18 de octubre de 2026). *La documentación completa está en inglés: [README.md](README.md).*

## 1. Activa tu Qatom Max

Cada participante recibe **6 meses de Qatom Max gratis**: https://www.qatom.ai/hack-the-andes . Los equipos ganadores reciben 12 meses (1.er puesto) o 7 meses (2.º y 3.er puestos) de Max para el equipo, y cada integrante un voucher transferible de 12 meses de Pro.

## 2. Compra como agente en cinco minutos

1. En Claude (o cualquier cliente MCP): **Settings > Connectors > Add custom connector**, URL `https://mcp.m.todaq.net/mcp`. Inicia sesión cuando te lo pida.
2. Pídele a tu agente: *"Usa Qatom para buscar el clima en el catálogo."* Tu agente llama a `catalog_search`.
3. *"Revisa mi wallet de agente."* (`agent_wallet_info`). Si está vacía, fóndeala desde la wallet principal.
4. *"Compra el pronóstico del clima para Lima."* Te pide aprobación, llama a `agent_checkout` y te muestra la respuesta con su recibo.

**Seguridad:** tu agente solo puede gastar lo que hay en su propio twin de agente. No tiene acceso a tu wallet principal ni a tu tarjeta.

## 3. Vende en treinta minutos

```bash
git clone https://github.com/StarwaterHeaven/qatom-hack-the-andes
cd qatom-hack-the-andes/template          # trabaja dentro de template/; importa ../lib
node test/run.mjs                         # pruebas sin red (Node 20+)
npx wrangler login
npx wrangler kv namespace create FEEDBACK # pega el id en wrangler.toml
npx wrangler secret put SERVICE_PATH      # 32+ caracteres aleatorios
npx wrangler deploy                       # anota la URL que imprime
node ../lib/gen.mjs catalog.json --base https://<tu-worker>   # campos del listado y llms.txt en out/
```

Crea tus ítems en el dashboard de Qatom con `out/listing.md` y compra uno con tu propio agente.

O diseña con tu agente:

```bash
npx skills add StarwaterHeaven/qatom-seller-guide --skill qatom-seller-guide
```

y dile *"Convierte este repo en un catálogo de Qatom."*

## Qué hay aquí

- [Guía para vendedores de Qatom](https://github.com/StarwaterHeaven/qatom-seller-guide): skill para pasar de "tengo algo" a un ítem del catálogo probado y en vivo, con todos los casos de uso que conocemos. Vive en su propio repo, la versión canónica para todos los vendedores de Qatom.
- `template/`: plantilla de Cloudflare Worker: describe tus ítems en `catalog.json` y pon tu función en `handlers.mjs`.
- `examples/chofex-trip-status`: la demo del sponsor: estado de viajes de carga para agentes (datos sintéticos en corredores reales de México).
- `docs/repo-to-catalog.md`: cómo convertir repos open source en catálogos, con candidatos de Crafter Station.

## Enlaces

- Sesión en vivo con Hassan Khan: viernes 9 de octubre, 5:30–7:00 p. m. hora de Lima, por Zoom: https://luma.com/830d5l83
- Qatom: https://qatom.ai · Docs: https://docs.m.todaq.net · MCP: `https://mcp.m.todaq.net/mcp`
- Ajedrez humano+agente en Qatom: https://centaurleague.games
