# Project instructions

This is a user-owned React/Vite application with a PHP/MySQL backend intended for Laragon and Apache hosting. Keep changes focused and preserve existing UI and data behavior.

## Runtime and deployment

- Run the local backend through Laragon's Apache and MySQL services.
- The PHP API is in `public/api/`; the app data schema is `database/schema.sql`.
- Keep database credentials in the ignored `public/api/config.local.php`. Never commit credentials.
- Build frontend assets with `npm run build`. Apache rewrites client-side routes to `index.html` and `/api` requests to the PHP API.
- Hosting must provide PHP 8.1+, `pdo_mysql`, `fileinfo`, MySQL/MariaDB, and Apache `mod_rewrite`.

## Conventions

- Reuse the frontend API wrapper in `src/api/localClient.js`.
- Enforce authentication and authorization in the PHP API, not only in React.
- Run the relevant checks from `package.json` before finishing code changes.
