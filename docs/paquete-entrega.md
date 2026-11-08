# Inventario y enlaces para entrega — 0.3.0-rc1

## Contenido previsto del ZIP

El paquete se genera con `tools/package_release.py`, que incluye solo archivos explícitos y patrones de código fuente de estas ubicaciones:

| Ruta | Contenido |
| --- | --- |
| `README.md`, `VERSION`, `.gitignore` | Guía principal, versión y exclusiones Git. |
| `backend/` | API, astronomía, dependencias con rangos y lock de Windows/Python 3.12. |
| `frontend/` | HTML, CSS, JavaScript, auditoría y `assets/logo.png` sin modificación por esta revisión; autenticidad y permisos del archivo actual pendientes. |
| `tests/` | Pruebas automatizadas backend. |
| `data/samples/astromotion-seed42.json` | Resultado sintético documentado; no es un FITS real. |
| `docs/` | Metodología, limitaciones, guías de jueces, guion, presentación y licencias. |
| `tools/package_release.py` | Empaquetador reproducible. |
| `MANIFEST.sha256` | Lista de archivos incluidos y su SHA-256; generado dentro del ZIP. |

El paquete **no incluye** entornos virtuales, cachés, paquetes instalados, credenciales ni el contenido arbitrario de `data/processed/`. No se han borrado datos locales. No se conserva ningún FITS ni PNG de la consulta real documentada; no inferir su existencia a partir del registro histórico.

## Crear y verificar

```powershell
.\.venv312\Scripts\python.exe tools/package_release.py
Get-FileHash -Algorithm SHA256 dist/SPHERALYX-AI-0.3.0-rc1.zip
```

El empaquetador no sobrescribe un ZIP existente; elige `--output` con otra ruta si existe. Ordena entradas y fija fechas y permisos ZIP; al usar el mismo Python, zlib y contenidos produce los mismos bytes. Cambios en contenido, intérprete o compresión pueden cambiar el hash. Verificar `MANIFEST.sha256` tras extraer y revisar manualmente los permisos de redistribución antes de subirlo.

## Enlaces de entrega

- [Inicio e instalación](../README.md) · [Instrucciones para jueces](instrucciones-jueces.md) · [Demostración](guia-demostracion.md).
- [Ficha y resultados](ficha-resultados.md) · [Presentación de siete diapositivas](presentacion.md) · [Guion de vídeo](guion-video.md).
- [Pruebas](informe-pruebas.md) · [Lista de verificación](lista-verificacion.md) · [Licencias y atribuciones](licencias-atribuciones.md).
- IRSA: [SIA2](https://irsa.ipac.caltech.edu/ibe/sia.html), [SPHEREx Quick Release](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html), [productos y calibración](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/).

Antes de enviar la candidatura: decidir la licencia del código y revisar procedencia del logo, permisos de terceros, atribuciones, requisitos oficiales del evento, secretos y prueba offline en el equipo definitivo. Este proyecto no es oficial de NASA ni apto para producción pública. El usuario autorizó publicar el código, la documentación y el logotipo en GitHub.
