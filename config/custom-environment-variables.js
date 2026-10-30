module.exports = {
  Host: {
    port: "HOST_IPMESSAGINGAPI_PORT",
    version: "HOST_VERSION",
    token: "HOST_TOKEN",
    encryptedhex: "HOST_IPMESSAGINGAPI_ENCRYPTED_HEX",
    botclientusers: "SYS_IPMESSAGING_BOT_ONLINE_USERS"
  },
  Mongo: {
    ip: "SYS_MONGO_HOST",
    port: "SYS_MONGO_PORT",
    dbname: "SYS_MONGO_DB",
    password: "SYS_MONGO_PASSWORD",
    user: "SYS_MONGO_USER",
    replicaset: "SYS_MONGO_REPLICA_SET"
  },
  Redis: {
    mode: "SYS_REDIS_MODE",
    ip: "SYS_REDIS_HOST",
    port: "SYS_REDIS_PORT",
    db: "SYS_REDIS_DB",
    password: "SYS_REDIS_PASSWORD",
    sentinels: {
      hosts: "SYS_REDIS_SENTINEL_HOSTS",
      port: "SYS_REDIS_SENTINEL_PORT",
      name: "SYS_REDIS_SENTINEL_NAME"
    }
  },
  Security: {
    ip: "SYS_REDIS_HOST",
    port: "SYS_REDIS_PORT",
    password: "SYS_REDIS_PASSWORD",
    mode: "SYS_REDIS_MODE",
    sentinels: {
      hosts: "SYS_REDIS_SENTINEL_HOSTS",
      port: "SYS_REDIS_SENTINEL_PORT",
      name: "SYS_REDIS_SENTINEL_NAME"
    }
  },
  Services: {
    interactionurl: "SYS_INTERACTIONS_HOST",
    interactionport: "SYS_INTERACTIONS_PORT",
    interactionversion: "SYS_INTERACTIONS_VERSION",
    ardsliteservice: "SYS_ARDSLITESERVICE_HOST",
    ardsliteport: "SYS_ARDSLITESERVICE_PORT",
    ardsliteversion: "SYS_ARDSLITESERVICE_VERSION"
  }
};
