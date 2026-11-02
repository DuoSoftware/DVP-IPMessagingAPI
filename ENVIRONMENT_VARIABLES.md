# Environment variables

Every environment variable DVP-IPMessagingAPI reads, with the values it accepts.

- The service maps config keys to these names in `config/custom-environment-variables.js`. The defaults are in `config/default.js`.
- **Default** is what the service uses when the variable is not set. Real hosts, URLs and secrets are never written here: `(environment-specific)` and `<secret>` stand in for them.
- **Required** is "yes" when the service has no usable default, and for every host, URL and secret.
- Names follow the Facetone naming standard. Whenever a variable is added, renamed or removed, or its meaning, values or default change, update this file in the same change. See `.claude/rules/environment-variables.md`.

## Service variables

Settings only this service reads (`HOST_IPMESSAGINGAPI_*`).

| Variable | Description | Type | Possible values | Default | Required | Secret |
| --- | --- | --- | --- | --- | --- | --- |
| `HOST_IPMESSAGINGAPI_ENCRYPTED_HEX` | Key used to encrypt chat payloads. | string | 1–16 hex characters | `<secret>` | yes | yes |
| `HOST_IPMESSAGINGAPI_PORT` | Port DVP-IPMessagingAPI listens on. | port | 1–65535 | 3002 | no | no |

## Shared variables

Infrastructure, other services' addresses and platform settings. Other services read them under the same names.

| Variable | Description | Type | Possible values | Default | Required | Secret |
| --- | --- | --- | --- | --- | --- | --- |
| `HOST_TOKEN` | Access token this service sends when it calls other services. | string | JWT | `<secret>` | yes | yes |
| `HOST_VERSION` | API version segment of this service's own routes (/DVP/API/\<version>/...). | version | version string, e.g. 1.0.0.0 | 1.0.0.0 | no | no |
| `SYS_ARDSLITESERVICE_HOST` | Host other services use to call DVP-ARDSLiteService. | host | host name or IP, e.g. ardsliteservice.internal | (environment-specific) | yes | no |
| `SYS_ARDSLITESERVICE_PORT` | Port of DVP-ARDSLiteService; added to the URL only when SYS_DYNAMIC_PORT_ENABLED is true. | port | 1–65535 | 8828 | no | no |
| `SYS_ARDSLITESERVICE_VERSION` | API version used in DVP-ARDSLiteService URLs. | version | version string, e.g. 1.0.0.0 | 1.0.0.0 | no | no |
| `SYS_INTERACTIONS_HOST` | Host other services use to call DVP-Interactions. | host | host name or IP, e.g. interactions.internal | (environment-specific) | yes | no |
| `SYS_INTERACTIONS_PORT` | Port of DVP-Interactions; added to the URL only when SYS_DYNAMIC_PORT_ENABLED is true. | port | 1–65535 | 3637 | no | no |
| `SYS_INTERACTIONS_VERSION` | API version used in DVP-Interactions URLs. | version | version string, e.g. 1.0.0.0 | 1.0.0.0 | no | no |
| `SYS_IPMESSAGING_BOT_ONLINE_USERS` | Redis key that holds online chat-bot users. | string | Redis key, e.g. ip_api_bot_online_users | ip_api_bot_online_users | no | no |
| `SYS_MONGO_DB` | MongoDB database name. | string | database name | facetone | no | no |
| `SYS_MONGO_HOST` | MongoDB host(s). | host | host name or IP; comma-separated list for a replica set | (environment-specific) | yes | no |
| `SYS_MONGO_PASSWORD` | MongoDB password. | string | password | `<secret>` | yes | yes |
| `SYS_MONGO_PORT` | MongoDB port. | port | 1–65535; leave empty for mongodb+srv | 27017 | no | no |
| `SYS_MONGO_REPLICA_SET` | MongoDB replica set name; used when SYS_MONGO_HOST lists several hosts. | string | replica set name | — | yes | no |
| `SYS_MONGO_USER` | MongoDB user. | string | user name | duo | no | no |
| `SYS_REDIS_DB` | Main Redis database index. | int | 0–15 | 2 | no | no |
| `SYS_REDIS_HOST` | Main Redis host. Also used for token checks (Security block). | host | host name or IP; comma-separated list in cluster mode | (environment-specific) | yes | no |
| `SYS_REDIS_MODE` | How to connect to the main Redis. | enum | instance \| cluster \| sentinel | instance | no | no |
| `SYS_REDIS_PASSWORD` | Main Redis password. | string | password | `<secret>` | yes | yes |
| `SYS_REDIS_PORT` | Main Redis port. | port | 1–65535 | 6379 | no | no |
| `SYS_REDIS_SENTINEL_HOSTS` | Sentinel hosts, when SYS_REDIS_MODE is sentinel. | list | comma-separated host names | (environment-specific) | no | no |
| `SYS_REDIS_SENTINEL_NAME` | Sentinel master name, when SYS_REDIS_MODE is sentinel. | string | sentinel master name | redis-cluster | no | no |
| `SYS_REDIS_SENTINEL_PORT` | Sentinel port, when SYS_REDIS_MODE is sentinel. | port | 1–65535 | 16389 | no | no |

## Reserved variables

Read straight from the environment by the logger, node-config or the service code. These names never change.

| Variable | Description | Type | Possible values | Default | Required | Secret |
| --- | --- | --- | --- | --- | --- | --- |
| `DEPLOYMENT_ENV` | docker turns off the log file, so the logger writes to the console only. | string | docker, or unset | unset: console and file | no | no |
| `HOST_NAME` | Name of the running instance. The logger sends it to Logstash as the app name. | string | host name | — | no | no |
| `LOG_LEVEL` | Lowest level the logger writes. | enum | error \| warn \| info \| verbose \| debug \| silly | debug | no | no |
| `LOG_PATH` | Folder for logger.log. Not used when DEPLOYMENT_ENV is docker. | path | folder path, e.g. /var/log/facetone | unset: logger.log in the working folder | no | no |
| `NODE_CONFIG_DIR` | Folder node-config reads its files from. | path | path to the config folder | ./config | no | no |
| `NODE_ENV` | node-config loads config/\<NODE_ENV>.js over config/default.js. Environment variables override both. | string | name of a file in config/, e.g. production | development | no | no |
| `SYS_LOG_HOST` | Logstash host that receives the logs over UDP. Logs are sent only when SYS_LOG_HOST and SYS_LOG_PORT are both set. | host | host name or IP, e.g. logstash.internal | unset: not sent | no | no |
| `SYS_LOG_PORT` | Logstash UDP port. Used with SYS_LOG_HOST. | port | 1–65535 | unset: not sent | no | no |
