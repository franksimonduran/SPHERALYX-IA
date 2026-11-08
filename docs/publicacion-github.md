# Preparación para GitHub — 0.3.0-rc1

El usuario confirmó que tiene derecho a publicar el código, la documentación y el logotipo, y autorizó su publicación en GitHub. La licencia del código y documentación no está decidida. No seleccionar una licencia por defecto ni asumir que la ausencia de licencia concede permisos. La revisión detallada de contribuciones y atribuciones de terceros permanece pendiente.

## Revisión previa obligatoria

1. Confirmar autoría y permiso de distribución de cada contribución, incluyendo código, textos y material generado o copiado; el titular decidirá si añade un archivo `LICENSE` y su contenido.
2. Documentar si `frontend/assets/logo.png` es el logotipo oficial, su origen y autoría. El usuario autorizó su publicación; el SHA-256 se encuentra en [licencias y atribuciones](licencias-atribuciones.md).
3. Revisar licencias y avisos de las dependencias, componentes binarios y fuentes, así como requisitos de citas y marca NASA/IPAC y del evento. El ZIP de `dist/` contiene la imagen de marca y es anterior a la documentación actual.
4. Revisar cada archivo candidato, posibles secretos, datos personales y binarios; los patrones automáticos no garantizan ausencia. Validar la presentación, las fuentes y la documentación en el entorno final.
5. Si se decide publicar sin el PNG, antes debe prepararse y probarse una distribución sin él: el empaquetador actual lo exige y la auditoría del frontend usa el recurso local. La alternativa visual del encabezado no equivale a una distribución comprobada sin el archivo.

## Estructura propuesta tras aprobar derechos

```text
README.md  VERSION  .gitignore  [LICENSE, si el titular lo autoriza]
backend/                API, astronomía y requisitos
frontend/               interfaz, pruebas y recursos autorizados
tests/                  pruebas backend
data/samples/           referencia sintética autorizada
docs/                   instalación, ciencia, resultados y entrega
tools/                  empaquetador de distribución
```

No incluir `.venv*`, `venv`, cachés, archivos temporales, secretos, `dist/`, ZIP, datos de usuario ni el `MANIFEST.sha256` local. El manifiesto del ZIP se genera dentro de cada distribución. `.gitignore` no limpia archivos previamente rastreados ni garantiza seguridad; revisar el índice y, si existe, el historial. No se ha establecido que todos los archivos propuestos tengan ya permiso de publicación.

## Comandos propuestos — solo después de obtener los permisos

Ejemplo para una copia nueva en PowerShell, desde su raíz. Revisar manualmente cada archivo antes del primer commit:

```powershell
git init -b main
git add .gitignore README.md VERSION backend frontend tests docs tools data/samples/astromotion-seed42.json
git status --short
git diff --cached --stat
git diff --cached
```

La lista de `git add` incluye el PNG autorizado y excluye cachés y temporales; no equivale a certificar los permisos de terceros.

Si el titular ha creado y autorizado un `LICENSE`, añadirlo explícitamente con `git add LICENSE`. Comprobar de nuevo todos los archivos preparados, licencias, secretos y que se incluyan solamente recursos autorizados. Si algo no se entiende, detenerse antes del commit. Después de aprobar el índice y obtener autorización para publicar:

```powershell
git status --short
git diff --cached --stat
git diff --cached
git commit -m "Prepare SPHERALYX AI 0.3.0-rc1"
git tag -a v0.3.0-rc1 -m "SPHERALYX AI 0.3.0-rc1"
```

Crear manualmente en GitHub un repositorio vacío solo cuando esté autorizado, sin README ni licencia inicial. Sustituir la URL por la del repositorio correcto y verificarla antes de subir:

```powershell
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git remote -v
git push -u origin main
git push origin v0.3.0-rc1
```

El `push` publica los archivos e historial al remoto seleccionado; comprobar su visibilidad y destinatarios antes de ejecutarlo. La versión `0.3.0-rc1` identifica una candidata, no un resultado científico validado ni un despliegue de producción.
