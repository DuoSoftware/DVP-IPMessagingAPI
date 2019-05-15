/**
 * Created by Rajinda on 5/13/2015.
 */


var config=require('config');

var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;

var redis = require('ioredis');

var opt = {
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket'],
    allowUpgrades: false,
    cookie: false
};

var socketio = require('socket.io',opt);


var redisip = config.Redis.ip;
var redisport = config.Redis.port;
var redispass = config.Redis.password;
var redismode = config.Redis.mode;
var redisdb = config.Redis.db;



var redisSetting =  {
    port:redisport,
    host:redisip,
    family: 4,
    password: redispass,
    db: redisdb,
    retryStrategy: function (times) {
        var delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError: function (err) {

        return true;
    }
};

if(redismode == 'sentinel'){

    if(config.Redis.sentinels && config.Redis.sentinels.hosts && config.Redis.sentinels.port && config.Redis.sentinels.name){
        var sentinelHosts = config.Redis.sentinels.hosts.split(',');
        if(Array.isArray(sentinelHosts) && sentinelHosts.length > 2){
            var sentinelConnections = [];

            sentinelHosts.forEach(function(item){
                sentinelConnections.push({host: item, port:config.Redis.sentinels.port})
            });

            redisSetting = {
                sentinels:sentinelConnections,
                name: config.Redis.sentinels.name,
                password: redispass
            }
        }else{

            console.log("No enough sentinel servers found .........");
        }

    }
}

var redisClient = undefined;
var  pubclient = undefined;
var subclient = undefined;

if(redismode != "cluster") {

    redisClient = new redis(redisSetting);
    pubclient = new redis(redisSetting);
    subclient = new redis(redisSetting);
}
else{

    var redisHosts = redisip.split(",");
    if(Array.isArray(redisHosts)){


        redisSetting = [];
        redisHosts.forEach(function(item){
            redisSetting.push({
                host: item,
                port: redisport,
                family: 4,
                password: redispass});
        });

        redisClient = new redis.Cluster([redisSetting]);
        pubclient = new redis.Cluster([redisSetting]);
        subclient = new redis.Cluster([redisSetting]);

    }else{
        redisClient = new redis.Cluster([redisSetting]);
        pubclient = redis(redisSetting);
        subclient = redis(redisSetting);
    }
}

pubclient.on("error", function (err) {
    logger.error("Error ",  err);
});
pubclient.on("error", function (err) {
    logger.error("Error ",  err);
});
subclient.on("node error", function (err) {
    logger.error("Error ",  err);
});

pubclient.on("node error", function (err) {
    logger.error("Error ",  err);
});

module.exports.redisClient = redisClient;
module.exports.pubclient = pubclient;
module.exports.subclient = subclient;




