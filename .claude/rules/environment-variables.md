# Environment variables

`ENVIRONMENT_VARIABLES.md` at the repository root lists every environment variable DVP-IPMessagingAPI reads. Keep it exact.

## When to update it

Update `ENVIRONMENT_VARIABLES.md` in the same change whenever you:

- add, rename or remove a mapping in `config/custom-environment-variables.js`;
- change the default of a mapped key in `config/default.js`;
- add or remove a direct `process.env.<NAME>` read;
- change how the code uses a variable: its type, its allowed values, or whether the service can run without it.

When the code stops reading a config key, remove it from `config/custom-environment-variables.js`, `config/default.js` and the table, unless a dvp-* library still reads it. The libraries read the `DB`, `Mongo`, `Redis`, `Security`, `RabbitMQ`, `Services` and `Host` keys they need from this config.

## How to write a row

- Table columns: Variable, Description, Type, Possible values, Default, Required, Secret. Sort rows by name within each section.
- Sections: **Service variables** for `HOST_IPMESSAGINGAPI_*`; **Shared variables** for `SYS_*` and the generic `HOST_VERSION`, `HOST_TOKEN`, `HOST_PATH`; **Reserved variables** for the reserved names below.
- **Type**: one of `string`, `int`, `port`, `bool`, `enum`, `host`, `url`, `path`, `list`, `json`, `version`.
- **Possible values**: the allowed values separated by `\|`, a range such as `1–65535`, or a format with an example.
- **Default**: the value in `config/default.js`; when there is none and a library applies its own, that value; otherwise `—`. Never write a real host, IP, URL, password, token or key: write `(environment-specific)` for a host or URL, and `<secret>` in backticks for a secret.
- **Required**: `yes` when the service has no usable default, and for every host, URL and secret. Otherwise `no`.
- **Secret**: `yes` for passwords, tokens, keys and other credentials.
- Escape `|` inside a cell as `\|`, and `<` outside backticks as `\<`, so Markdown does not read it as an HTML tag.

## Naming a new variable

| Kind of value | Form | Example |
| --- | --- | --- |
| Shared infrastructure (databases, queues, mail, telephony) | `SYS_<TECH>_<ATTR>` | `SYS_REDIS_HOST` |
| Address of another service | `SYS_<SVC>_HOST`, `_PORT`, `_VERSION` | `SYS_FILESERVICE_HOST` |
| Platform setting read by two or more services | `SYS_<NAME>` | `SYS_DYNAMIC_PORT_ENABLED` |
| Attribute every service has | `HOST_<ATTR>` | `HOST_VERSION` |
| Setting owned by one service, including its own port | `HOST_<SVC>_<SETTING>` | `HOST_DIALERAPI_PREVIEW_TIMEOUT_SEC` |

- `<SVC>` for this repository is `IPMESSAGINGAPI`. Its own port is `HOST_IPMESSAGINGAPI_PORT`, and its own settings are `HOST_IPMESSAGINGAPI_<SETTING>`.
- Before adding a name, look for an existing name for the same setting in the [Facetone Environment Variables](https://claude.ai/artifact/SrRxNYzu9sg6tnxYQxTWYr) document and reuse it. One setting never gets two names, and two settings never share one.
- Booleans end in `_ENABLED` and take `true` or `false`. Durations end in their unit (`_SEC`, `_MS`, `_MIN`), and sizes in `_KB`.
- Use `_HOST` (never `_IP`), `_URL` only for a full URL, `_PORT`, `_USER`, `_PASSWORD`, `_DB` for a database name or Redis index, and `_MODE`.
- Rename only the variable name (the value in the mapping). Never rename the config key: the dvp-* libraries read the config keys.
- Never rename the reserved names: `LOG_LEVEL`, `LOG_PATH`, `DEPLOYMENT_ENV`, `SYS_LOG_HOST`, `SYS_LOG_PORT`, `HOST_NAME`, `NODE_ENV`, `NODE_CONFIG_DIR`, `NODE_OPTIONS`, `GO_CONFIG_DIR`.

## Changes that reach other services

A new, renamed or removed `SYS_*` name, or a changed meaning of one, affects other services and the deployment configs. Update the Facetone Environment Variables document too, or tell the user it needs the change. Deployment configs (CI/CD variables, Kubernetes/Helm values, .env and compose files) need the same change.
